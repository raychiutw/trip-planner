/**
 * round5b-security.integration.test.ts — v2.33.42 security audit batch
 *
 * 驗證 round 5b 5 個 security fix 的觀察值：
 *  1. permissions.ts POST 統一 response shape (anti-enumeration)
 *  2. dev/apps.ts validateScopes 拒絕 admin / companion scope
 *  3. reports.ts field-length cap + tripId existence check
 *  4. requests.ts after/afterId comparator 修正
 *  5. SSE response 不再帶 `Access-Control-Allow-Origin: *`
 *
 * 走 HTTP 邊界。其中第 2、4、5 項原本只是讀原始碼比對字串（dev/apps 因為需要 session cookie 而放棄
 * 呼叫 handler），改成真實請求：session cookie 打 POST /api/dev/apps、真實資料列驗證 after cursor、
 * 讀 SSE 回應標頭。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, seedTrip, seedUser } from './helpers';
import { createApi, type Api } from './http';
import { cleanupTrips } from './cleanup-trips';
import type { Env } from '../../functions/api/_types';

const BASE = 'https://test.com';
const ORIGIN = 'https://trip-planner-dby.pages.dev';
const OWNER = 'r5b-owner@test.com';
const INVITEE = 'r5b-invitee@test.com';
const VERIFIED = 'r5b-verified@test.com';
const UNREGISTERED = 'r5b-stranger@test.com';
const TRIP = 'r5b-trip';

let db: D1Database;
let env: Env;
let api: Api;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db, { SESSION_SECRET: 'test-secret-32-bytes-long-enough!' });
  api = createApi({ env });
  await seedTrip(db, { id: TRIP, owner: OWNER, published: 1 });
  // pre-register an invited user
  await seedUser(db, INVITEE);
  await seedUser(db, VERIFIED);
  await db.prepare("UPDATE users SET email_verified_at = datetime('now') WHERE email = ?").bind(VERIFIED).run();
});

afterAll(async () => {
  await db.prepare('DELETE FROM trip_invitations WHERE trip_id = ?').bind(TRIP).run();
  await db.prepare('DELETE FROM trip_requests WHERE trip_id = ?').bind(TRIP).run();
  await db.prepare('DELETE FROM error_reports WHERE trip_id = ?').bind(TRIP).run();
  await db.prepare('DELETE FROM audit_log WHERE trip_id = ?').bind(TRIP).run();
  await db.prepare("DELETE FROM client_apps WHERE app_name LIKE 'r5b-%'").run();
  await cleanupTrips(db, [TRIP]);
  await disposeMiniflare();
});

describe('permissions.ts POST — unified response shape (anti-enumeration)', () => {
  it('已註冊 email → status: invitation_sent (改名自 permission_added)', async () => {
    const resp = await api.request('POST', `${BASE}/api/permissions`, {
      as: OWNER,
      json: { tripId: TRIP, email: INVITEE, role: 'viewer' },
    });
    expect(resp.status).toBe(201);
    const body = (await resp.json()) as { status: string };
    expect(body.status).toBe('invitation_sent'); // 不再洩漏 vs unregistered
    // 已註冊但未驗證 email：走邀請 token 分支（v2.33.98），不直接給權限
    const invitation = await db
      .prepare('SELECT 1 AS ok FROM trip_invitations WHERE trip_id = ? AND invited_email = ?')
      .bind(TRIP, INVITEE)
      .first();
    expect(invitation).not.toBeNull();
  });

  it('已註冊且已驗證 email → 同樣 status: invitation_sent，並直接寫入權限列', async () => {
    const resp = await api.request('POST', `${BASE}/api/permissions`, {
      as: OWNER,
      json: { tripId: TRIP, email: VERIFIED, role: 'viewer' },
    });
    expect(resp.status).toBe(201);
    expect(((await resp.json()) as { status: string }).status).toBe('invitation_sent');
    const perm = await db
      .prepare('SELECT role FROM trip_permissions WHERE trip_id = ? AND user_id = (SELECT id FROM users WHERE email = ?)')
      .bind(TRIP, VERIFIED)
      .first<{ role: string }>();
    expect(perm?.role).toBe('viewer');
  });

  it('未註冊 email → status: invitation_sent (same shape)', async () => {
    const resp = await api.request('POST', `${BASE}/api/permissions`, {
      as: OWNER,
      json: { tripId: TRIP, email: UNREGISTERED, role: 'viewer' },
    });
    expect(resp.status).toBe(201);
    const body = (await resp.json()) as { status: string };
    expect(body.status).toBe('invitation_sent');
    // 未註冊者留下邀請列，不會直接給權限
    const invitation = await db
      .prepare('SELECT 1 AS ok FROM trip_invitations WHERE trip_id = ? AND invited_email = ?')
      .bind(TRIP, UNREGISTERED)
      .first();
    expect(invitation).not.toBeNull();
  });
});

describe('dev/apps.ts POST — reject privileged scopes', () => {
  async function createApp(scopes: string[], name: string): Promise<Response> {
    const { cookie } = await api.sessionFor('r5b-dev@test.com');
    return api.request('POST', `${BASE}/api/dev/apps`, {
      cookie,
      json: { app_name: name, redirect_uris: ['https://example.com/cb'], allowed_scopes: scopes },
    });
  }

  it('validateScopes 拒 admin scope（改走 session cookie 真實請求，不再讀原始碼）', async () => {
    const res = await createApp(['openid', 'admin'], 'r5b-app-admin');
    expect(res.status).toBe(400);
    const err = ((await res.json()) as { error: { code: string; detail?: string } }).error;
    expect(err.code).toBe('DATA_VALIDATION');
    expect(err.detail).toContain('不支援的 scope: admin');
    const created = await db.prepare("SELECT 1 FROM client_apps WHERE app_name = 'r5b-app-admin'").first();
    expect(created).toBeNull();
  });

  it('validateScopes 同樣拒 companion scope；一般 scope 則可建立', async () => {
    const bad = await createApp(['companion'], 'r5b-app-companion');
    expect(bad.status).toBe(400);
    const ok = await createApp(['openid', 'profile'], 'r5b-app-ok');
    expect(ok.status).toBe(201);
    const row = await db
      .prepare("SELECT allowed_scopes FROM client_apps WHERE app_name = 'r5b-app-ok'")
      .first<{ allowed_scopes: string }>();
    expect(JSON.parse(row!.allowed_scopes)).toEqual(['openid', 'profile']);
  });
});

describe('reports.ts POST — field-length cap + tripId existence', () => {
  it('不存在 tripId → 201 silently dropped (v2.33.99 拔 enum oracle)', async () => {
    // v2.33.99 security: rate-limit bump 在 tripExists 之前 + 不存在 silently
    // 回 201，避免 attacker 用 200 vs 404 區別 enum 已 published trip slugs。
    const resp = await api.request('POST', `${BASE}/api/reports`, {
      headers: { Origin: ORIGIN },
      json: { tripId: 'r5b-nonexistent-trip', url: '/x', errorMessage: 'boom' },
    });
    expect(resp.status).toBe(201);
    const stored = await db.prepare("SELECT 1 FROM error_reports WHERE trip_id = 'r5b-nonexistent-trip'").first();
    expect(stored).toBeNull();
  });

  it('field > 2000 char 被 clamp', async () => {
    const longString = 'A'.repeat(3000);
    const resp = await api.request('POST', `${BASE}/api/reports`, {
      headers: { Origin: ORIGIN },
      json: { tripId: TRIP, url: '/page', errorMessage: longString, context: longString },
    });
    expect(resp.status).toBe(201);
    const stored = await db
      .prepare('SELECT error_message, context FROM error_reports WHERE trip_id = ? ORDER BY id DESC LIMIT 1')
      .bind(TRIP)
      .first<{ error_message: string; context: string }>();
    expect(stored?.error_message.length).toBeLessThanOrEqual(2000);
    expect(stored?.context.length).toBeLessThanOrEqual(2000);
  });
});

describe('SSE events.ts — no CORS * header', () => {
  it('SSE 回應不帶 Access-Control-Allow-Origin（改讀真實回應標頭，不再讀原始碼）', async () => {
    // 已完成的 request：串流在第一次 poll 後就關閉，可以完整讀完
    const row = await db
      .prepare('INSERT INTO trip_requests (trip_id, message, submitted_by, status) VALUES (?, ?, ?, ?) RETURNING id')
      .bind(TRIP, 'r5b sse', OWNER, 'completed')
      .first<{ id: number }>();
    const resp = await api.get(`${BASE}/api/requests/${row!.id}/events`, { as: OWNER });
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toBe('text/event-stream');
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(await resp.text()).toContain('"status":"completed"');
  });
});

describe('requests.ts after/afterId — > comparator (v2.33.42 fix)', () => {
  async function seedRequestAt(createdAt: string, message: string): Promise<number> {
    const row = await db
      .prepare('INSERT INTO trip_requests (trip_id, message, submitted_by, status, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id')
      .bind(TRIP, message, OWNER, 'completed', createdAt)
      .first<{ id: number }>();
    return row!.id;
  }

  it('after 只回比 cursor「新」的 request（> 而非 <），sort=asc 由舊到新', async () => {
    const a = await seedRequestAt('2030-01-01 00:00:01', 'r5b-after-a');
    const b = await seedRequestAt('2030-01-01 00:00:02', 'r5b-after-b');
    const c = await seedRequestAt('2030-01-01 00:00:03', 'r5b-after-c');
    const res = await api.get(
      `${BASE}/api/requests?tripId=${TRIP}&after=${encodeURIComponent('2030-01-01 00:00:01')}&sort=asc&limit=10`,
      { as: OWNER },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: number }> };
    const ids = body.items.map(i => i.id);
    expect(ids).toEqual([b, c]);
    expect(ids).not.toContain(a);
  });

  it('afterId：同一 created_at 時以 id 往後（r.id > afterId）', async () => {
    const t = '2031-01-01 00:00:00';
    const x = await seedRequestAt(t, 'r5b-after-x');
    const y = await seedRequestAt(t, 'r5b-after-y');
    const z = await seedRequestAt(t, 'r5b-after-z');
    const res = await api.get(
      `${BASE}/api/requests?tripId=${TRIP}&after=${encodeURIComponent(t)}&afterId=${x}&sort=asc&limit=10`,
      { as: OWNER },
    );
    const body = (await res.json()) as { items: Array<{ id: number }> };
    expect(body.items.map(i => i.id)).toEqual([y, z]);
  });
});
