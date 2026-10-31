/**
 * API 的 HTTP 邊界（Request 進、Response 出）。
 *
 * 這是拆分專案（#1462）的行為基準 seam：同一份測試要能指向舊 Functions、對照組或新 api，
 * 所以這裡只驗「給定請求得到什麼回應」，不碰 handler 內部函式。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, seedTrip, userIdFor } from './helpers';
import { createApi, serveApi } from './http';
import type { Env } from '../../functions/api/_types';

// 專用 email：套件共用同一個 D1，別和其他檔案的 owner 混在一起
const OWNER = 'http-boundary-owner@test.com';
const SESSION_USER = 'http-boundary-session@test.com';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db, { SESSION_SECRET: 'test-secret-32-chars-long-enough' });
  await seedTrip(db, { id: 'http-trip', owner: OWNER, days: 3 });
  await seedTrip(db, { id: 'http-private', owner: OWNER, days: 1, published: 0 });
});

afterAll(async () => {
  // 共用 D1：清掉自己建立的資料，避免影響其他檔案
  await db.prepare("DELETE FROM trips WHERE id IN ('http-trip', 'http-private')").run();
  await db.prepare("DELETE FROM oauth_models WHERE name = 'AccessToken' AND id LIKE 'http-test-%'").run();
  await db.prepare("DELETE FROM session_devices WHERE user_id = ?").bind(userIdFor(SESSION_USER)).run();
  await disposeMiniflare();
});

describe('進程內：經真實路由與 middleware', () => {
  it('以 bearer token 認證的擁有者讀得到自己行程的天', async () => {
    const api = createApi({ env });
    const resp = await api.get('/api/trips/http-trip/days', { as: OWNER });
    expect(resp.status).toBe(200);
    const days = await resp.json() as Array<{ dayNum: number }>;
    expect(days.map(d => d.dayNum)).toEqual([1, 2, 3]);
  });

  it('沒有憑證讀不到未發布的行程（403）', async () => {
    const api = createApi({ env });
    const resp = await api.get('/api/trips/http-private/days');
    expect(resp.status).toBe(403);
  });

  it('沒有憑證的寫入回 401', async () => {
    const api = createApi({ env });
    const resp = await api.request('PUT', '/api/trips/http-trip', {
      json: { title: 'x' },
      headers: { Origin: 'https://trip-planner-dby.pages.dev' },
    });
    expect(resp.status).toBe(401);
  });

  it('沒有憑證也沒有 Origin 的寫入被 CSRF 檢查擋下（403）', async () => {
    const api = createApi({ env });
    const resp = await api.request('PUT', '/api/trips/http-trip', { json: { title: 'x' } });
    expect(resp.status).toBe(403);
  });

  it('不存在的路徑回 404', async () => {
    const api = createApi({ env });
    const resp = await api.get('/api/no-such-route', { as: OWNER });
    expect(resp.status).toBe(404);
  });

  it('middleware 先於路由：找不到路徑時仍先經過 CSRF 檢查（與 Pages 一致）', async () => {
    const api = createApi({ env });
    const resp = await api.request('POST', '/api/no-such-route', { json: {} });
    expect(resp.status).toBe(403);
  });

  it('middleware 先於路由：方法不支援時，companion 範圍檢查仍先擋下', async () => {
    const api = createApi({ env });
    const resp = await api.request('DELETE', '/api/trips/http-trip/days', {
      as: OWNER,
      headers: { 'X-Request-Scope': 'companion' },
    });
    expect(resp.status).toBe(403);
  });

  it('具體路徑優先於動態路徑：/trips/import 不被當成 /trips/:id', async () => {
    const api = createApi({ env });
    const resp = await api.get('/api/trips/import', { as: OWNER });
    expect(resp.status).toBe(405);
  });

  it('form 選項以 urlencoded 送出，handler 讀得到欄位', async () => {
    const api = createApi({ env });
    const resp = await api.request('POST', '/api/oauth/consent', {
      form: { client_id: 'x', decision: 'maybe' },
      headers: { Origin: 'https://trip-planner-dby.pages.dev' },
    });
    // 無 session 會先轉去 login，這裡只驗 form 有被解析（redirect_after 帶回 client_id）
    expect(resp.status).toBe(302);
    expect(decodeURIComponent(resp.headers.get('Location')!)).toContain('client_id=x');
  });

  it('轉址不會被自動跟隨：回應保留 302 與 Location', async () => {
    const api = createApi({ env });
    const login = await api.request('POST', '/api/oauth/consent', {
      form: { decision: 'allow' },
      headers: { Origin: 'https://trip-planner-dby.pages.dev' },
    });
    expect(login.status).toBe(302);
    expect(login.headers.get('Location')).toMatch(/^\/login\?redirect_after=/);
  });

  it('路徑存在但方法不支援回 405', async () => {
    const api = createApi({ env });
    const resp = await api.request('DELETE', '/api/trips/http-trip/days', { as: OWNER });
    expect(resp.status).toBe(405);
  });
});

describe('換目標：同一個請求指向外部網址', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer(serveApi(createApi({ env })));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

  it('經 HTTP 打出去的回應與進程內一致', async () => {
    const inProcess = await createApi({ env }).get('/api/trips/http-trip/days', { as: OWNER });
    const bearer = (await createApi({ env }).tokenFor(OWNER));
    const external = await createApi({ baseUrl }).get('/api/trips/http-trip/days', { bearer });
    expect(external.status).toBe(inProcess.status);
    expect(await external.json()).toEqual(await inProcess.json());
  });

  it('錯誤狀態碼也原樣經過（不是把一切都轉成 200）', async () => {
    const external = await createApi({ baseUrl }).get('/api/trips/http-private/days');
    expect(external.status).toBe(403);
  });
});

describe('進程內：session cookie 認證', () => {
  it('sessionFor 建立真實 session（資料列 + 可通過 middleware）', async () => {
    const api = createApi({ env });
    const { cookie, sid, userId } = await api.sessionFor(SESSION_USER);
    expect(sid).toBeTruthy();
    const row = await db.prepare('SELECT user_id FROM session_devices WHERE sid = ?').bind(sid).first<{ user_id: string }>();
    expect(row?.user_id).toBe(userId);

    const resp = await api.get('/api/account/sessions', { cookie });
    expect(resp.status).toBe(200);
    const body = await resp.json() as { current_sid: string };
    expect(body.current_sid).toBe(sid);
  });

  it('帶 cookie 的變更請求自動補允許的 Origin；偽造的 cookie 仍是 401', async () => {
    const api = createApi({ env });
    const { cookie } = await api.sessionFor(SESSION_USER);
    const ok = await api.request('PATCH', '/api/account/profile', { cookie, json: { displayName: 'cookie-user' } });
    expect(ok.status).toBe(200);
    const forged = await api.request('PATCH', '/api/account/profile', { cookie: 'tripline_session=forged', json: { displayName: 'x' } });
    expect(forged.status).toBe(401);
  });

  it('restrictTrip 的 bearer 會被 middleware 帶成受限身分', async () => {
    const api = createApi({ env });
    const resp = await api.request('PATCH', '/api/account/profile', {
      as: SESSION_USER, restrictTrip: 'some-trip', json: { displayName: 'x' },
    });
    expect(resp.status).toBe(403);
  });
});
