/**
 * /api/account/sessions + /sessions/:sid — V2-P6 multi-device session API
 * 走 HTTP 邊界（tests/api/http.ts），session 是真實簽出的 cookie + session_devices 資料列；
 * 原本檢查 SQL 字串的斷言，改讀真實 D1 的資料變化（撤銷了誰、沒動到誰）。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';
import { createApi, type Api } from './http';
import { onRequestDelete as onDeleteOne } from '../../functions/api/account/sessions/[sid]';

const SESSION_SECRET = 'test-secret-32-chars-long-enough';
// 共用 D1：專用 id／email，結束時清掉自己的資料
const U1 = 'sess-user-1';
const U2 = 'sess-user-2';
const EMAIL1 = 'sess-user-1@example.com';
const EMAIL2 = 'sess-user-2@example.com';

let db: D1Database;
let api: Api;

async function revokedAt(sid: string): Promise<string | null> {
  const row = await db.prepare('SELECT revoked_at FROM session_devices WHERE sid = ?').bind(sid).first<{ revoked_at: string | null }>();
  return row!.revoked_at;
}

async function seedDevice(sid: string, userId: string, overrides: Partial<{ ua: string; ip: string; created: string; seen: string }> = {}) {
  await db.prepare(
    `INSERT INTO session_devices (sid, user_id, ua_summary, ip_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(sid, userId, overrides.ua ?? 'Chrome · macOS', overrides.ip ?? 'abc123def456',
    overrides.created ?? '2026-04-20 00:00:00', overrides.seen ?? '2026-04-25 00:00:00').run();
}

async function cleanDevices() {
  await db.prepare('DELETE FROM session_devices WHERE user_id IN (?, ?)').bind(U1, U2).run();
}

beforeAll(async () => {
  db = await createTestDb();
  api = createApi({ env: mockEnv(db, { SESSION_SECRET }) });
}, 30000);

beforeEach(cleanDevices);

afterAll(async () => {
  await cleanDevices();
  await db.prepare('DELETE FROM users WHERE id IN (?, ?)').bind(U1, U2).run();
  await disposeMiniflare();
});

describe('GET /api/account/sessions', () => {
  it('401 when no session', async () => {
    const res = await api.get('/api/account/sessions');
    expect(res.status).toBe(401);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('AUTH_REQUIRED');
  });

  it('200 returns sessions list with current marked', async () => {
    const me = await api.sessionFor(EMAIL1, U1);
    // 目前這個 session 之外，再有一台舊裝置
    await seedDevice('sess-old', U1, { ua: 'Safari · iOS', ip: 'xyz789abcdef', seen: '2026-04-24 00:00:00' });

    const res = await api.get('/api/account/sessions', { cookie: me.cookie });
    expect(res.status).toBe(200);
    const json = await res.json() as {
      current_sid: string | null;
      sessions: Array<{ sid: string; ip_hash_prefix: string | null; is_current: boolean }>;
    };
    expect(json.current_sid).toBe(me.sid);
    expect(json.sessions).toHaveLength(2);
    expect(json.sessions.filter(s => s.is_current).map(s => s.sid)).toEqual([me.sid]);

    // ip_hash truncated to 8 chars
    const old = json.sessions.find(s => s.sid === 'sess-old')!;
    expect(old.ip_hash_prefix).toBe('xyz789ab');
    expect(old.ip_hash_prefix?.length).toBe(8);
  });

  it('只列自己未撤銷的 session（不含別人的、不含已撤銷的）', async () => {
    const me = await api.sessionFor(EMAIL1, U1);
    await seedDevice('sess-mine-revoked', U1);
    await db.prepare(`UPDATE session_devices SET revoked_at = datetime('now') WHERE sid = ?`).bind('sess-mine-revoked').run();
    await seedDevice('sess-theirs', U2);

    const res = await api.get('/api/account/sessions', { cookie: me.cookie });
    const json = await res.json() as { sessions: Array<{ sid: string }> };
    expect(json.sessions.map(s => s.sid)).toEqual([me.sid]);
  });
});

describe('DELETE /api/account/sessions (revoke all others)', () => {
  it('401 when no session', async () => {
    const res = await api.request('DELETE', '/api/account/sessions', {
      headers: { Origin: 'https://trip-planner-dby.pages.dev' },
    });
    expect(res.status).toBe(401);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('AUTH_REQUIRED');
  });

  it('200 + revokes all other sessions for current user', async () => {
    const me = await api.sessionFor(EMAIL1, U1);
    await seedDevice('sess-a', U1);
    await seedDevice('sess-b', U1);
    await seedDevice('sess-c', U1);
    await seedDevice('sess-theirs', U2);

    const res = await api.request('DELETE', '/api/account/sessions', { cookie: me.cookie });
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; revoked: number };
    expect(json.ok).toBe(true);
    expect(json.revoked).toBe(3);

    for (const sid of ['sess-a', 'sess-b', 'sess-c']) expect(await revokedAt(sid)).not.toBeNull();
    // 自己這台與別人的都不動
    expect(await revokedAt(me.sid!)).toBeNull();
    expect(await revokedAt('sess-theirs')).toBeNull();
  });
});

describe('DELETE /api/account/sessions/:sid (revoke specific)', () => {
  it('401 when no session', async () => {
    const res = await api.request('DELETE', '/api/account/sessions/sid-x', {
      headers: { Origin: 'https://trip-planner-dby.pages.dev' },
    });
    expect(res.status).toBe(401);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('AUTH_REQUIRED');
  });

  it('400 when sid param missing（路由層：結尾斜線落在 sessions.ts 的「登出其他裝置」）', async () => {
    // 經真實路由，空的 sid 到不了 [sid].ts —— 結尾斜線等同 DELETE /api/account/sessions。
    const me = await api.sessionFor(EMAIL1, U1);
    await seedDevice('sess-a', U1);
    const res = await api.request('DELETE', '/api/account/sessions/', { cookie: me.cookie });
    expect(res.status).toBe(200);
    expect(await revokedAt('sess-a')).not.toBeNull();

    // [sid].ts 內的防呆分支仍保留原斷言：直接呼叫（路由層擋不到，只有 handler 自己守）
    const req = new Request('https://x.com/api/account/sessions/', { method: 'DELETE', headers: { Cookie: me.cookie } });
    await expect(onDeleteOne({
      request: req, env: mockEnv(db, { SESSION_SECRET }), params: {}, data: {},
      next: () => Promise.resolve(new Response()), waitUntil: () => undefined, passThroughOnException: () => undefined,
    } as never)).rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });

  it('404 SESSION_NOT_FOUND when sid doesn\'t belong to user', async () => {
    const me = await api.sessionFor(EMAIL1, U1);
    await seedDevice('other-user-sid', U2);

    const res = await api.request('DELETE', '/api/account/sessions/other-user-sid', { cookie: me.cookie });
    expect(res.status).toBe(404);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('SESSION_NOT_FOUND');
    // 跨使用者撤銷不得生效
    expect(await revokedAt('other-user-sid')).toBeNull();
  });

  it('200 + UPDATE revoked_at when sid belongs to user', async () => {
    const me = await api.sessionFor(EMAIL1, U1);
    await seedDevice('my-sid', U1);
    await seedDevice('sess-keep', U1);

    const res = await api.request('DELETE', '/api/account/sessions/my-sid', { cookie: me.cookie });
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; revoked_sid: string };
    expect(json.ok).toBe(true);
    expect(json.revoked_sid).toBe('my-sid');

    // 只撤銷指定的那一台
    expect(await revokedAt('my-sid')).not.toBeNull();
    expect(await revokedAt('sess-keep')).toBeNull();
  });

  it('已撤銷的 session 再撤銷一次 → 404', async () => {
    const me = await api.sessionFor(EMAIL1, U1);
    await seedDevice('my-sid', U1);
    expect((await api.request('DELETE', '/api/account/sessions/my-sid', { cookie: me.cookie })).status).toBe(200);
    expect((await api.request('DELETE', '/api/account/sessions/my-sid', { cookie: me.cookie })).status).toBe(404);
  });

  it('被撤銷的 session 的 cookie 之後即失效（401）', async () => {
    const me = await api.sessionFor(EMAIL1, U1);
    const other = await api.sessionFor(EMAIL1, U1);
    expect((await api.request('DELETE', `/api/account/sessions/${other.sid}`, { cookie: me.cookie })).status).toBe(200);
    expect((await api.get('/api/account/sessions', { cookie: other.cookie })).status).toBe(401);
    expect((await api.get('/api/account/sessions', { cookie: me.cookie })).status).toBe(200);
  });
});
