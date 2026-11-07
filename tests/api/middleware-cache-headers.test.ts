/**
 * 已登入回應的快取標頭（#1599，承接 #1437）
 *
 * PWA 的 cacheWillUpdate 以「請求的 Cookie 標頭」判斷登入，但 Service Worker 讀不到 HttpOnly cookie，
 * 也看不到 Bearer 以外的身分；唯一可靠的訊號是後端回應標頭。規則：
 *   - 有登入身分（session／Bearer）的回應 → private, no-store
 *   - 匿名可讀的公開端點（已發布行程、public-config…）→ 不動，維持原本可快取行為
 * 走 HTTP 邊界。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, seedTrip, seedUser } from './helpers';
import { createApi, type Api } from './http';
import { INVITE_SECRET, seedInvitation } from './invitations-http';
import { cleanupTrips } from './cleanup-trips';

const OWNER = 'cache-owner@test.com';
const PUB = 'cache-pub-trip';
const PRIV = 'cache-priv-trip';
let db: D1Database;
let api: Api;

const cc = (res: Response) => res.headers.get('Cache-Control') ?? '';

beforeAll(async () => {
  db = await createTestDb();
  api = createApi({ env: mockEnv(db, { SESSION_SECRET: INVITE_SECRET }) });
  await seedUser(db, OWNER);
  await seedTrip(db, { id: PUB, owner: OWNER, published: 1 });
  await seedTrip(db, { id: PRIV, owner: OWNER, published: 0 });
}, 30000);

afterAll(async () => {
  await db.prepare("DELETE FROM trip_invitations WHERE trip_id LIKE 'cache-%'").run();
  await cleanupTrips(db, ['cache-%']);
  await disposeMiniflare();
});

describe('已登入的 GET 回應帶 private, no-store', () => {
  it.each([
    ['已發布行程詳情', `/api/trips/${PUB}`],
    ['未發布行程詳情', `/api/trips/${PRIV}`],
    ['行程列表', '/api/trips'],
    ['行程天數', `/api/trips/${PRIV}/days`],
    ['我的行程', '/api/my-trips'],
  ])('%s', async (_name, path) => {
    const res = await api.get(path, { as: OWNER });
    expect(res.status).toBe(200);
    expect(cc(res)).toBe('private, no-store');
  });
});

describe('瀏覽器 session cookie（Service Worker 看不到的身分）', () => {
  it('帳號資料端點帶 private, no-store', async () => {
    const { cookie } = await api.sessionFor(OWNER);
    const res = await api.get('/api/account/ai-authorization', { cookie });
    expect(res.status).toBe(200);
    expect(cc(res)).toBe('private, no-store');
  });
});

describe('匿名公開端點維持原本的快取行為（不誤傷）', () => {
  it('已發布行程（匿名）不被標成 private／no-store', async () => {
    for (const path of [`/api/trips/${PUB}`, '/api/trips', `/api/trips/${PUB}/days`]) {
      const res = await api.get(path);
      expect(res.status, path).toBe(200);
      expect(cc(res), path).not.toMatch(/private|no-store/);
    }
  });

  it('GET /api/public-config 維持 public, max-age=60', async () => {
    const res = await api.get('/api/public-config');
    expect(res.status).toBe(200);
    expect(cc(res)).toBe('public, max-age=60');
  });
});

describe('以不可猜 token 授權的回應也不可共用快取', () => {
  it('邀請預覽（匿名，token 即憑證）', async () => {
    await seedInvitation(db, { tripId: PUB, token: 'cache-inv-token', invitedEmail: 'cache-invitee@test.com', invitedBy: OWNER });
    const res = await api.get('/api/invitations?token=cache-inv-token');
    expect(res.status).toBe(200);
    expect(cc(res)).toBe('private, no-store');
  });
});

describe('SSE 長連線不改快取標頭（與 api 的 securityHeaders 一致，標頭由串流 handler 自己決定）', () => {
  it('已登入的 /api/requests/:id/events 維持 handler 自設的 no-cache，不被改成 private, no-store', async () => {
    const row = await db
      .prepare('INSERT INTO trip_requests (trip_id, message, submitted_by, status) VALUES (?, ?, ?, ?) RETURNING id')
      .bind(PRIV, 'cache sse', OWNER, 'completed')
      .first<{ id: number }>();
    const res = await api.get(`/api/requests/${row!.id}/events`, { as: OWNER });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(cc(res)).toBe('no-cache');
    await res.text();
  });
});
