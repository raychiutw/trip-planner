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
import { mockEnv, seedTrip } from './helpers';
import { createApi, serveApi } from './http';
import type { Env } from '../../functions/api/_types';

// 專用 email：套件共用同一個 D1，別和其他檔案的 owner 混在一起
const OWNER = 'http-boundary-owner@test.com';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'http-trip', owner: OWNER, days: 3 });
  await seedTrip(db, { id: 'http-private', owner: OWNER, days: 1, published: 0 });
});

afterAll(async () => {
  // 共用 D1：清掉自己建立的資料，避免影響其他檔案
  await db.prepare("DELETE FROM trips WHERE id IN ('http-trip', 'http-private')").run();
  await db.prepare("DELETE FROM oauth_models WHERE name = 'AccessToken' AND id LIKE 'http-test-%'").run();
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

  it('具體路徑優先於動態路徑：/trips/import 不被當成 /trips/:id', async () => {
    const api = createApi({ env });
    const resp = await api.get('/api/trips/import', { as: OWNER });
    expect(resp.status).toBe(405);
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
