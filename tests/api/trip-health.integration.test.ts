import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import {
  callHandler,
  getDayId,
  mockAuth,
  mockContext,
  mockEnv,
  seedEntry,
  seedPoi,
  seedTrip,
} from './helpers';
import { onRequestGet } from '../../functions/api/trips/[id]/health';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeEach(async () => {
  db = await createTestDb();
  env = mockEnv(db);
});

afterAll(disposeMiniflare);

describe('GET /api/trips/:id/health', () => {
  it('reads canonical trip_entry_pois (v2.29.0 trip_entries.poi_id DROPPED)', async () => {
    const tripId = 'trip-health-canonical';
    await seedTrip(db, { id: tripId });
    const dayId = await getDayId(db, tripId, 1);

    const closedMasterPoi = await seedPoi(db, { name: 'Closed Master', type: 'attraction' });
    const missingAltPoi = await seedPoi(db, { name: 'Missing Alternate', type: 'restaurant' });

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

    const resp = await callHandler(onRequestGet, mockContext({
      request: new Request(`https://test.com/api/trips/${tripId}/health`),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: tripId },
    }));

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
