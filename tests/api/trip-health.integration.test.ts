import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import {
  getDayId,
  mockEnv,
  seedEntry,
  seedPoi,
  seedTrip,
} from './helpers';
import { createApi, type Api } from './http';
import { cleanupTrips } from './cleanup-trips';

// 走 HTTP 邊界（tests/api/http.ts）；共用 D1，專屬 trip／POI 名稱，結束時清掉。
let db: D1Database;
let api: Api;
const tripId = 'trip-health-canonical';
const OWNER = 'trip-health-owner@test.com';

beforeAll(async () => {
  db = await createTestDb();
  api = createApi({ env: mockEnv(db) });
});

afterAll(async () => {
  await cleanupTrips(db, [tripId], ['Health Closed Master', 'Health Missing Alternate']);
  await disposeMiniflare();
});

describe('GET /api/trips/:id/health', () => {
  it('reads canonical trip_entry_pois (v2.29.0 trip_entries.poi_id DROPPED)', async () => {
    await seedTrip(db, { id: tripId, owner: OWNER });
    const dayId = await getDayId(db, tripId, 1);

    const closedMasterPoi = await seedPoi(db, { name: 'Health Closed Master', type: 'attraction' });
    const missingAltPoi = await seedPoi(db, { name: 'Health Missing Alternate', type: 'restaurant' });

    await db.batch([
      db.prepare("UPDATE pois SET status='closed', status_reason='永久歇業' WHERE id = ?").bind(closedMasterPoi),
      db.prepare("UPDATE pois SET status='missing', status_reason='Google Maps 查無資料' WHERE id = ?").bind(missingAltPoi),
    ]);

    // v2.29.0: seedEntry 不帶 poiId — 直接 INSERT 兩 trip_entry_pois rows。
    const entryId = await seedEntry(db, dayId);
    await db.batch([
      db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)').bind(entryId, closedMasterPoi),
      db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 2)').bind(entryId, missingAltPoi),
    ]);

    const resp = await api.get(`/api/trips/${tripId}/health`, { as: OWNER });

    expect(resp.status).toBe(200);
    const body = await resp.json() as {
      closed: number;
      missing: number;
      items: Array<{ poi_id: number; poi_name: string; status: string }>;
    };
    expect(body.closed).toBe(1);
    expect(body.missing).toBe(1);
    expect(body.items.map((item) => item.poi_id).sort((a, b) => a - b)).toEqual([
      closedMasterPoi,
      missingAltPoi,
    ].sort((a, b) => a - b));
  });
});
