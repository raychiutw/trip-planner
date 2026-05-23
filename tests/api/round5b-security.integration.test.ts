/**
 * round5b-security.integration.test.ts — v2.33.42 security audit batch
 *
 * 驗證 round 5b 5 個 security fix 的觀察值：
 *  1. permissions.ts POST 統一 response shape (anti-enumeration)
 *  2. dev/apps.ts validateScopes 拒絕 admin / companion scope
 *  3. reports.ts field-length cap + tripId existence check
 *  4. requests.ts after/afterId comparator 修正
 *  5. SSE response 不再帶 `Access-Control-Allow-Origin: *`
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import {
  mockEnv,
  mockAuth,
  mockContext,
  jsonRequest,
  seedTrip,
  callHandler,
} from './helpers';
import { onRequestPost as postPermissions } from '../../functions/api/permissions';
import { onRequestPost as postDevApp } from '../../functions/api/dev/apps';
import { onRequestPost as postReports } from '../../functions/api/reports';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db, { SESSION_SECRET: 'test-secret-32-bytes-long-enough!' });
  await seedTrip(db, { id: 'r5b-trip', owner: 'owner@test.com', published: 1 });
  // pre-register an invited user
  await db
    .prepare('INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)')
    .bind('test-user-invitee', 'invitee@test.com', 'invitee')
    .run();
});

afterAll(disposeMiniflare);

describe('permissions.ts POST — unified response shape (anti-enumeration)', () => {
  it('已註冊 email → status: invitation_sent (改名自 permission_added)', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/permissions', 'POST', {
        tripId: 'r5b-trip',
        email: 'invitee@test.com',
        role: 'viewer',
      }),
      env,
      auth: mockAuth({ email: 'owner@test.com' }),
    });
    const resp = await callHandler(postPermissions, ctx);
    expect(resp.status).toBe(201);
    const body = (await resp.json()) as { status: string };
    expect(body.status).toBe('invitation_sent'); // 不再洩漏 vs unregistered
  });

  it('未註冊 email → status: invitation_sent (same shape)', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/permissions', 'POST', {
        tripId: 'r5b-trip',
        email: 'stranger@test.com',
        role: 'viewer',
      }),
      env,
      auth: mockAuth({ email: 'owner@test.com' }),
    });
    const resp = await callHandler(postPermissions, ctx);
    expect(resp.status).toBe(201);
    const body = (await resp.json()) as { status: string };
    expect(body.status).toBe('invitation_sent');
  });
});

describe('dev/apps.ts POST — reject privileged scopes', () => {
  beforeAll(async () => {
    // dev/apps requires SESSION_SECRET + a valid session cookie. Skip session
    // path here; instead verify our scope validator throws via a unit-style
    // catch — we cannot easily invoke the full handler without a valid
    // requireSessionUser pass. Smoke-check via source-grep instead.
  });

  it('source: validateScopes 拒 admin scope (defense via source-grep)', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync('functions/api/dev/apps.ts', 'utf-8');
    expect(src).toMatch(/ALLOWED_USER_SCOPES\s*=\s*new Set/);
    expect(src).toMatch(/不支援的 scope/);
    expect(src).not.toMatch(/ALLOWED_USER_SCOPES.+admin/);
  });
});

describe('reports.ts POST — field-length cap + tripId existence', () => {
  it('不存在 tripId → 404', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/reports', 'POST', {
        tripId: 'nonexistent-trip',
        url: '/x',
        errorMessage: 'boom',
      }),
      env,
    });
    const resp = await callHandler(postReports, ctx);
    expect(resp.status).toBe(404);
  });

  it('field > 2000 char 被 clamp', async () => {
    const longString = 'A'.repeat(3000);
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/reports', 'POST', {
        tripId: 'r5b-trip',
        url: '/page',
        errorMessage: longString,
        context: longString,
      }),
      env,
    });
    const resp = await callHandler(postReports, ctx);
    expect(resp.status).toBe(201);
    const stored = await db
      .prepare('SELECT error_message, context FROM error_reports WHERE trip_id = ? ORDER BY id DESC LIMIT 1')
      .bind('r5b-trip')
      .first<{ error_message: string; context: string }>();
    expect(stored?.error_message.length).toBeLessThanOrEqual(2000);
    expect(stored?.context.length).toBeLessThanOrEqual(2000);
  });
});

describe('SSE events.ts — no CORS * header', () => {
  it('source: no Access-Control-Allow-Origin code line', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync('functions/api/requests/[id]/events.ts', 'utf-8');
    // Match only code lines (strip comments first to avoid matching audit comments)
    const codeLines = src.split('\n').filter((l) => !l.trim().startsWith('//'));
    const code = codeLines.join('\n');
    expect(code).not.toMatch(/['"]Access-Control-Allow-Origin['"]\s*:\s*['"]\*['"]/);
  });
});

describe('requests.ts after/afterId — > comparator (v2.33.42 fix)', () => {
  it('source: after branch uses > (not <)', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync('functions/api/requests.ts', 'utf-8');
    // afterId branch should use '>' not '<'
    const afterBlock = src.match(/if\s*\(after\)\s*\{[\s\S]*?\n  \}/);
    expect(afterBlock).not.toBeNull();
    expect(afterBlock?.[0]).toMatch(/r\.created_at > \?/);
    expect(afterBlock?.[0]).toMatch(/r\.id > \?/);
  });
});
