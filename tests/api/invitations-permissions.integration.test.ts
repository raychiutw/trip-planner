/**
 * Integration test — v2.34.41 PR41 (PR35 P2 collab gap)
 *
 * 兩個 collab endpoint:
 *   - POST /api/invitations/revoke — 撤銷 pending invitation
 *   - PATCH /api/permissions/:id — 更新 trip_permissions role
 *   - DELETE /api/permissions/:id — 移除 trip_permissions row
 *
 * 完成 PR35 doc 全 P0/P1/P2 follow-up。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockContext, mockAuth, seedUser, seedTrip, callHandler, jsonRequest } from './helpers';
import { onRequestPost as revokeHandler } from '../../functions/api/invitations/revoke';
import { onRequestPatch as patchPermHandler, onRequestDelete as deletePermHandler } from '../../functions/api/permissions/[id]';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
const ownerEmail = 'owner-pr41@test.com';
const strangerEmail = 'stranger-pr41@test.com';
const tripId = 'trip-pr41';

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedUser(db, ownerEmail);
  await seedUser(db, strangerEmail);
  await seedTrip(db, { id: tripId, owner: ownerEmail });
});

afterAll(disposeMiniflare);

// 直接 INSERT pending invitation。Schema: token_hash + invited_email + expires_at NOT NULL。
async function seedInvitation(email: string) {
  const ownerId = `test-user-${ownerEmail.replace(/[^a-z0-9]/gi, '-')}`;
  await db.prepare(
    `INSERT INTO trip_invitations (token_hash, trip_id, invited_email, role, invited_by, expires_at)
     VALUES (?, ?, ?, 'member', ?, datetime('now', '+7 days'))`,
  ).bind(`hash-${email}-${Date.now()}`, tripId, email, ownerId).run();
}

// Schema (v2 post-migration 0047): id + user_id + trip_id + role (no email!)
async function seedPermission(email: string, role: string) {
  // 確保 user 存在（FK）
  const userId = `test-user-${email.replace(/[^a-z0-9]/gi, '-')}`;
  await db.prepare('INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)').bind(userId, email, email.split('@')[0]).run();
  const result = await db.prepare(
    `INSERT INTO trip_permissions (user_id, trip_id, role) VALUES (?, ?, ?) RETURNING id`,
  ).bind(userId, tripId, role).first<{ id: number }>();
  return result!.id;
}

describe('POST /api/invitations/revoke — PR41', () => {
  async function callRevoke(body: Record<string, unknown>, email = ownerEmail) {
    return callHandler(revokeHandler, mockContext({
      request: jsonRequest('https://test/api/invitations/revoke', 'POST', body),
      env,
      auth: mockAuth({ email }),
      params: {},
    }));
  }

  it('缺 tripId → 400 INVITATION_REVOKE_VALIDATION', async () => {
    const res = await callRevoke({ email: 'foo@bar.com' });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('INVITATION_REVOKE_VALIDATION');
  });

  it('缺 email → 400', async () => {
    const res = await callRevoke({ tripId });
    expect(res.status).toBe(400);
  });

  it('找不到 pending invitation → 404 INVITATION_NOT_FOUND', async () => {
    const res = await callRevoke({ tripId, email: 'never-invited@test.com' });
    expect(res.status).toBe(404);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('INVITATION_NOT_FOUND');
  });

  it('正常 revoke → 200 + revoked count + audit_log written', async () => {
    const inviteEmail = `pr41-invite-${Date.now()}@test.com`;
    await seedInvitation(inviteEmail);

    const res = await callRevoke({ tripId, email: inviteEmail });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; revoked: number };
    expect(body.ok).toBe(true);
    expect(body.revoked).toBe(1);

    // DB row 已刪（PK = token_hash）
    const row = await db.prepare('SELECT token_hash FROM trip_invitations WHERE trip_id = ? AND invited_email = ?').bind(tripId, inviteEmail).first();
    expect(row).toBeNull();

    // audit_log 寫入
    const audit = await db.prepare(
      `SELECT diff_json FROM audit_log WHERE trip_id = ? AND table_name = 'trip_invitations' ORDER BY id DESC LIMIT 1`,
    ).bind(tripId).first<{ diff_json: string }>();
    expect(audit?.diff_json).toContain('revoked');
    expect(audit?.diff_json).toContain(inviteEmail);
  });
});

describe('PATCH /api/permissions/:id — PR41', () => {
  async function callPatch(permId: number, body: Record<string, unknown>, email = ownerEmail) {
    return callHandler(patchPermHandler, mockContext({
      request: jsonRequest(`https://test/api/permissions/${permId}`, 'PATCH', body),
      env,
      auth: mockAuth({ email }),
      params: { id: String(permId) },
    }));
  }

  it('找不到 record → 404 DATA_NOT_FOUND', async () => {
    const res = await callPatch(999999, { role: 'member' });
    expect(res.status).toBe(404);
  });

  it('invalid role → 400 DATA_VALIDATION', async () => {
    const id = await seedPermission(`pr41-perm1-${Date.now()}@test.com`, 'viewer');
    const res = await callPatch(id, { role: 'super-admin' });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string; detail?: string } };
    expect(body.error.code).toBe('DATA_VALIDATION');
    expect(body.error.detail).toContain('member');
  });

  it('owner role 不可改 → 403 PERM_DENIED', async () => {
    const id = await seedPermission(`pr41-owner-${Date.now()}@test.com`, 'owner');
    const res = await callPatch(id, { role: 'member' });
    expect(res.status).toBe(403);
  });

  it('正常 viewer → member → 200 + audit_log written', async () => {
    const targetEmail = `pr41-perm-target-${Date.now()}@test.com`;
    const id = await seedPermission(targetEmail, 'viewer');
    const res = await callPatch(id, { role: 'member' });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; role: string };
    expect(body.role).toBe('member');

    const row = await db.prepare('SELECT role FROM trip_permissions WHERE id = ?').bind(id).first<{ role: string }>();
    expect(row?.role).toBe('member');

    const audit = await db.prepare(
      `SELECT diff_json FROM audit_log WHERE trip_id = ? AND table_name = 'trip_permissions' AND record_id = ? ORDER BY id DESC LIMIT 1`,
    ).bind(tripId, id).first<{ diff_json: string }>();
    expect(audit?.diff_json).toContain('viewer');
    expect(audit?.diff_json).toContain('member');
  });

  it('no-op (同 role)→ 200 + unchanged=true（不寫 audit）', async () => {
    const id = await seedPermission(`pr41-noop-${Date.now()}@test.com`, 'viewer');
    const auditBefore = await db.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE record_id = ?`).bind(id).first<{ n: number }>();
    const res = await callPatch(id, { role: 'viewer' });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; unchanged?: boolean };
    expect(body.unchanged).toBe(true);
    const auditAfter = await db.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE record_id = ?`).bind(id).first<{ n: number }>();
    expect(auditAfter!.n).toBe(auditBefore!.n);
  });
});

describe('DELETE /api/permissions/:id — PR41', () => {
  async function callDelete(permId: number, email = ownerEmail) {
    return callHandler(deletePermHandler, mockContext({
      request: jsonRequest(`https://test/api/permissions/${permId}`, 'DELETE', undefined),
      env,
      auth: mockAuth({ email }),
      params: { id: String(permId) },
    }));
  }

  it('找不到 record → 404', async () => {
    const res = await callDelete(999998);
    expect(res.status).toBe(404);
  });

  it('owner 不可移除 → 403 PERM_DENIED', async () => {
    const id = await seedPermission(`pr41-owner-del-${Date.now()}@test.com`, 'owner');
    const res = await callDelete(id);
    expect(res.status).toBe(403);
  });

  it('正常 DELETE viewer → 200 + row 消失 + audit_log written 含 snapshot', async () => {
    const id = await seedPermission(`pr41-del-target-${Date.now()}@test.com`, 'viewer');
    const res = await callDelete(id);
    expect(res.status).toBe(200);

    const row = await db.prepare('SELECT id FROM trip_permissions WHERE id = ?').bind(id).first();
    expect(row).toBeNull();

    const audit = await db.prepare(
      `SELECT action, snapshot, diff_json FROM audit_log WHERE trip_id = ? AND table_name = 'trip_permissions' AND record_id = ? ORDER BY id DESC LIMIT 1`,
    ).bind(tripId, id).first<{ action: string; snapshot: string; diff_json: string }>();
    expect(audit?.action).toBe('delete');
    expect(audit?.snapshot).toBeTruthy();
    expect(audit?.diff_json).toContain('viewer');
  });
});
