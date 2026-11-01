/**
 * session cookie 的撤銷：裝置紀錄（session_devices）找不到時要拒絕，不是放行。
 *
 * 之前 getSessionUser 只在「找到紀錄且 revoked_at 有值」時拒絕；帳號刪除會把該使用者的裝置紀錄整列抹除，
 * 於是刪除後舊 cookie 讓請求繼續以「已刪除的使用者」身分通過驗證（staging 預覽站的刪除 smoke 抓到）。
 * 走 HTTP 邊界（tests/api/http.ts）。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';
import { createApi, type Api } from './http';
import { hashPassword } from '../../src/server/password';
import { signSessionToken } from '../../src/server/session';

const SESSION_SECRET = 'test-secret-32-chars-long-enough';
let db: D1Database;
let api: Api;
let seq = 0;

beforeAll(async () => {
  db = await createTestDb();
  api = createApi({ env: mockEnv(db, { SESSION_SECRET }) });
}, 30000);

afterAll(async () => {
  await db.prepare("DELETE FROM session_devices WHERE user_id LIKE 'sdr-u%'").run();
  await db.prepare("DELETE FROM auth_identities WHERE user_id LIKE 'sdr-u%'").run();
  await db.prepare("DELETE FROM users WHERE id LIKE 'sdr-u%'").run();
  await disposeMiniflare();
});

async function seedUser(password?: string): Promise<{ id: string; email: string }> {
  const id = `sdr-u${++seq}`;
  const email = `${id}@example.com`;
  await db.prepare("INSERT INTO users (id, email, display_name, status) VALUES (?, ?, ?, 'active')").bind(id, email, id).run();
  if (password) {
    await db.prepare(
      "INSERT INTO auth_identities (user_id, provider, provider_user_id, password_hash, password_algo) VALUES (?, 'local', ?, ?, 'pbkdf2')",
    ).bind(id, email, await hashPassword(password)).run();
  }
  return { id, email };
}

/** 一個需要登入的唯讀端點。 */
const whoami = (cookie: string) => api.get('/api/account/sessions', { cookie });

describe('session 的裝置紀錄與撤銷', () => {
  it('正常的 session 通過（基準）', async () => {
    const u = await seedUser();
    const { cookie } = await api.sessionFor(u.email, u.id);
    expect((await whoami(cookie)).status).toBe(200);
  });

  it('裝置紀錄被抹除（帳號刪除、過期清理）→ 這個 cookie 不能再用（401）', async () => {
    const u = await seedUser();
    const { cookie, sid } = await api.sessionFor(u.email, u.id);
    await db.prepare('DELETE FROM session_devices WHERE sid = ?').bind(sid).run();
    expect((await whoami(cookie)).status).toBe(401);
  });

  it('標記為撤銷的 session → 401（既有行為不變）', async () => {
    const u = await seedUser();
    const { cookie, sid } = await api.sessionFor(u.email, u.id);
    await db.prepare("UPDATE session_devices SET revoked_at = datetime('now') WHERE sid = ?").bind(sid).run();
    expect((await whoami(cookie)).status).toBe(401);
  });

  it('沒有 sid 的舊版 token 仍然有效（向下相容，不被誤殺）', async () => {
    const u = await seedUser();
    const legacy = await signSessionToken(u.id, SESSION_SECRET); // 不帶 sid
    expect((await whoami(`tripline_session=${legacy}`)).status).toBe(200);
  });

  it('刪除帳號之後，刪除前拿到的 cookie 不能再用', async () => {
    const u = await seedUser('correct-horse-battery');
    const { cookie } = await api.sessionFor(u.email, u.id);
    expect((await api.get('/api/account', { cookie })).status).toBe(200);
    const del = await api.request('DELETE', '/api/account', { cookie, json: { password: 'correct-horse-battery' } });
    expect(del.status).toBe(200);
    expect((await api.get('/api/account', { cookie })).status, '已刪帳號的 cookie 不得繼續通過驗證').toBe(401);
    expect((await whoami(cookie)).status).toBe(401);
  });
});
