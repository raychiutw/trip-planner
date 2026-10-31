/**
 * Value: protects=非成員不能對別人的行程做寫入（本檔列出的 7 個 handler 的 gate 真的會擋）;
 * fails_when=這 7 個 handler 任一個的 requireTripWrite 被移除或放寬成唯讀檢查;
 * why_new=既有測試對這 7 個 handler 只覆蓋 401／404／cross-trip IDOR，沒有「非成員 → 403」
 *   （其餘被換成 requireTripWrite 的 handler：days／shift／batch／health-check／generate／recompute／segments POST／shares GET+POST
 *   已有各自的 403 案例，不在此重複）;
 * seam=none
 *
 * 走 HTTP 邊界（tests/api/http.ts）+ 真實 D1（Miniflare）。每列用一個「不在 trip_permissions 的陌生人」或 viewer 呼叫，
 * 參數／body 都是合法的，所以 403 只可能來自寫入 gate（不是驗證失敗）。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, seedUser, seedTrip, userIdFor } from './helpers';
import { createApi, type Api } from './http';
import { cleanupTrips } from './cleanup-trips';

let db: D1Database;
let api: Api;
const TRIP = 'gate-denied-trip';
const owner = 'gate-owner@test.com';
const stranger = 'gate-stranger@test.com';
const viewer = 'gate-viewer@test.com';

beforeAll(async () => {
  db = await createTestDb();
  api = createApi({ env: mockEnv(db) });
  await seedTrip(db, { id: TRIP, owner, days: 1 });
  await seedUser(db, stranger);
  await seedUser(db, viewer);
  await db.prepare("INSERT INTO trip_permissions (user_id, trip_id, role) VALUES (?, ?, 'viewer')")
    .bind(userIdFor(viewer), TRIP).run();
});

afterAll(async () => {
  await cleanupTrips(db, [TRIP]);
  await disposeMiniflare();
});

type Row = { name: string; method: string; path: string; body?: unknown };
const rows: Row[] = [
  { name: 'POST /requests', method: 'POST', path: '/api/requests', body: { tripId: TRIP, message: 'hi' } },
  { name: 'POST /trips/:id/days/:num/entries', method: 'POST', path: `/api/trips/${TRIP}/days/1/entries`, body: { title: 'x' } },
  { name: 'PATCH /trips/:id/segments/:sid', method: 'PATCH', path: `/api/trips/${TRIP}/segments/1`, body: {} },
  { name: 'PATCH /trips/:id/notes/:section/:rowId/maintenance', method: 'PATCH', path: `/api/trips/${TRIP}/notes/pretrip/1/maintenance`, body: {} },
  { name: 'DELETE /trips/:id/notes/:type/exclusions/:exclusionId', method: 'DELETE', path: `/api/trips/${TRIP}/notes/tips/exclusions/1` },
  { name: 'PATCH /trips/:id/shares/:shareId', method: 'PATCH', path: `/api/trips/${TRIP}/shares/1`, body: {} },
  { name: 'DELETE /trips/:id/shares/:shareId', method: 'DELETE', path: `/api/trips/${TRIP}/shares/1` },
];

describe.each([['陌生人', stranger], ['viewer', viewer]])('%s 寫入別人的行程 → 403', (_label, email) => {
  it.each(rows)('$name', async (r) => {
    const res = await api.request(r.method, r.path, { as: email, json: r.body });
    expect(res.status).toBe(403);
  });
});
