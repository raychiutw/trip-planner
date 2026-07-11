/**
 * Integration test — PATCH /api/account/profile (v2.34.36 PR36)
 *
 * 涵蓋 v2.33.122 display_name lifecycle:
 *   - trim 後寫入
 *   - max 50 chars cap (51+ chars → 400)
 *   - null / empty string 視同 clear (display_name=NULL)
 *   - 欄位省略（未提供）→ 400 無有效欄位
 *   - 非 string 型別 → 400 validation
 *   - 200 response mirror /api/oauth/userinfo shape (camelCase)
 *   - audit_log 紀錄 (tableName='user' + diffJson 含 displayName)
 *   - unauthenticated → throws AUTH_REQUIRED
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockContext, mockAuth, seedUser, callHandler, jsonRequest } from './helpers';
import { onRequestPatch } from '../../functions/api/account/profile';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
const userEmail = 'profile-test@example.com';
let userId: string;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  userId = await seedUser(db, userEmail);
});

afterAll(disposeMiniflare);

async function callPatch(body: Record<string, unknown>, email = userEmail) {
  const ctx = mockContext({
    request: jsonRequest('https://test/api/account/profile', 'PATCH', body),
    env,
    auth: mockAuth({ email }),
    params: {},
  });
  return callHandler(onRequestPatch, ctx);
}

async function fetchUser() {
  return db
    .prepare('SELECT display_name, updated_at FROM users WHERE id = ?')
    .bind(userId)
    .first<{ display_name: string | null; updated_at: string | null }>();
}

async function fetchAuditRows() {
  const rs = await db
    .prepare(
      `SELECT action, table_name AS tableName, record_id AS recordId, changed_by AS changedBy, diff_json AS diffJson
       FROM audit_log WHERE table_name = 'user' ORDER BY id ASC`,
    )
    .all<{ action: string; tableName: string; recordId: number | null; changedBy: string; diffJson: string }>();
  return rs.results ?? [];
}

describe('PATCH /api/account/profile — restrict_trip containment（defense-in-depth）', () => {
  it('受限 token 改帳號名稱 → 403（不得以行程受限身份改擁有者資料）', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test/api/account/profile', 'PATCH', { displayName: 'hijack' }),
      env,
      auth: mockAuth({ email: userEmail, restrictTrip: 'some-trip' }),
      params: {},
    });
    const resp = await callHandler(onRequestPatch, ctx);
    expect(resp.status).toBe(403);
  });
});

describe('PATCH /api/account/profile — display_name lifecycle', () => {
  it('字串 → trim 後寫入', async () => {
    const res = await callPatch({ displayName: '  Ray Chiu  ' });
    expect(res.status).toBe(200);
    const body = await res.json() as { displayName: string };
    expect(body.displayName).toBe('Ray Chiu');
    const row = await fetchUser();
    expect(row!.display_name).toBe('Ray Chiu');
  });

  it('null → clear (display_name=NULL)', async () => {
    await callPatch({ displayName: 'will be cleared' });
    const res = await callPatch({ displayName: null });
    expect(res.status).toBe(200);
    const body = await res.json() as { displayName: string | null };
    expect(body.displayName).toBeNull();
    const row = await fetchUser();
    expect(row!.display_name).toBeNull();
  });

  it('empty string → clear (display_name=NULL)', async () => {
    await callPatch({ displayName: 'will be cleared' });
    const res = await callPatch({ displayName: '   ' });
    expect(res.status).toBe(200);
    const body = await res.json() as { displayName: string | null };
    expect(body.displayName).toBeNull();
  });

  it('50 chars 邊界 OK', async () => {
    const name = 'x'.repeat(50);
    const res = await callPatch({ displayName: name });
    expect(res.status).toBe(200);
    const body = await res.json() as { displayName: string };
    expect(body.displayName).toBe(name);
  });

  it('51 chars → 400 DATA_VALIDATION + detail 含 50', async () => {
    // AppError: error.message=generic, error.detail=specific(handler-supplied)
    const name = 'x'.repeat(51);
    const res = await callPatch({ displayName: name });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string; detail?: string } };
    expect(body.error.code).toBe('DATA_VALIDATION');
    expect(body.error.detail).toContain('50');
  });

  it('欄位省略（body 空）→ 400 無有效欄位可更新', async () => {
    const res = await callPatch({});
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('DATA_VALIDATION');
  });

  it('非 string 型別（number）→ 400', async () => {
    const res = await callPatch({ displayName: 123 });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('DATA_VALIDATION');
  });

  it('response mirror /api/oauth/userinfo shape (camelCase + emailVerified)', async () => {
    const res = await callPatch({ displayName: 'Test User' });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('email', userEmail);
    expect(body).toHaveProperty('emailVerified');
    expect(body).toHaveProperty('displayName', 'Test User');
    expect(body).toHaveProperty('avatarUrl');
    expect(body).toHaveProperty('createdAt');
    // snake_case 欄位不應出現
    expect(body).not.toHaveProperty('display_name');
    expect(body).not.toHaveProperty('email_verified_at');
    expect(body).not.toHaveProperty('avatar_url');
    expect(body).not.toHaveProperty('created_at');
  });

  it('audit_log 寫入 (tableName=user + action=update + diffJson 含 displayName)', async () => {
    const before = await fetchAuditRows();
    const res = await callPatch({ displayName: 'Audit Test' });
    expect(res.status).toBe(200);
    const after = await fetchAuditRows();
    expect(after.length).toBe(before.length + 1);
    const last = after[after.length - 1];
    expect(last.tableName).toBe('user');
    expect(last.action).toBe('update');
    expect(last.changedBy).toBe(userEmail);
    expect(last.diffJson).toContain('Audit Test');
  });
});
