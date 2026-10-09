/**
 * Value: protects=非成員不能對別人的行程做寫入（requests／entries／segments／notes／shares 的 gate 真的會擋）;
 * fails_when=requireTripWrite 被移除、放寬成唯讀檢查，或某個 handler 忘了呼叫它;
 * why_new=既有測試對這幾個 handler 只覆蓋 401／404／cross-trip IDOR，沒有「非成員 → 403」;
 * seam=none
 *
 * 真實 D1（Miniflare）。每列用一個「不在 trip_permissions 的陌生人」或 viewer 呼叫，
 * 參數／body 都是合法的，所以 403 只可能來自寫入 gate（不是驗證失敗）。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestDb } from './setup';
import { mockEnv, mockContext, mockAuth, seedUser, seedTrip, callHandler, jsonRequest, userIdFor } from './helpers';
import { onRequestPost as postRequest } from '../../functions/api/requests';
import { onRequestPost as postEntry } from '../../functions/api/trips/[id]/days/[num]/entries';
import { onRequestPatch as patchSegment } from '../../functions/api/trips/[id]/segments/[sid]';
import { onRequestPatch as patchMaintenance } from '../../functions/api/trips/[id]/notes/[section]/[rowId]/maintenance';
import { onRequestDelete as deleteExclusion } from '../../functions/api/trips/[id]/notes/[type]/exclusions/[exclusionId]';
import { onRequestPatch as patchShare, onRequestDelete as deleteShare } from '../../functions/api/trips/[id]/shares/[shareId]';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
const TRIP = 'gate-denied-trip';
const owner = 'gate-owner@test.com';
const stranger = 'gate-stranger@test.com';
const viewer = 'gate-viewer@test.com';

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: TRIP, owner, days: 1 });
  await seedUser(db, stranger);
  await seedUser(db, viewer);
  await db.prepare("INSERT INTO trip_permissions (user_id, trip_id, role) VALUES (?, ?, 'viewer')")
    .bind(userIdFor(viewer), TRIP).run();
});

type Row = { name: string; handler: unknown; method: string; params: Record<string, string>; body?: unknown };
const rows: Row[] = [
  { name: 'POST /requests', handler: postRequest, method: 'POST', params: {}, body: { tripId: TRIP, message: 'hi' } },
  { name: 'POST /trips/:id/days/:num/entries', handler: postEntry, method: 'POST', params: { id: TRIP, num: '1' }, body: { title: 'x' } },
  { name: 'PATCH /trips/:id/segments/:sid', handler: patchSegment, method: 'PATCH', params: { id: TRIP, sid: '1' }, body: {} },
  { name: 'PATCH /trips/:id/notes/:section/:rowId/maintenance', handler: patchMaintenance, method: 'PATCH', params: { id: TRIP, section: 'pretrip', rowId: '1' }, body: {} },
  { name: 'DELETE /trips/:id/notes/:type/exclusions/:exclusionId', handler: deleteExclusion, method: 'DELETE', params: { id: TRIP, type: 'tips', exclusionId: '1' } },
  { name: 'PATCH /trips/:id/shares/:shareId', handler: patchShare, method: 'PATCH', params: { id: TRIP, shareId: '1' }, body: {} },
  { name: 'DELETE /trips/:id/shares/:shareId', handler: deleteShare, method: 'DELETE', params: { id: TRIP, shareId: '1' } },
];

describe.each([['陌生人', stranger], ['viewer', viewer]])('%s 寫入別人的行程 → 403', (_label, email) => {
  it.each(rows)('$name', async (r) => {
    const res = await callHandler(r.handler as never, mockContext({
      request: jsonRequest(`https://x/api/${TRIP}`, r.method, r.body),
      env,
      auth: mockAuth({ email }),
      params: r.params,
    }));
    expect(res.status).toBe(403);
  });
});
