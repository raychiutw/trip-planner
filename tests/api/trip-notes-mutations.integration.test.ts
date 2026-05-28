/**
 * Integration tests — POST / PATCH / DELETE / reorder on trip-notes 5 sections
 *
 * v2.34.x 行程筆記 PR3 — mutation endpoints。
 *
 * Covers (per-section + universal helpers):
 *   POST /api/trips/:id/notes/{section} → 201 + row + sort_order auto-MAX+1
 *   PATCH /api/trips/:id/notes/{section}/:rowId → update + version bump
 *   PATCH with expectedVersion mismatch → 409 STALE_ENTRY
 *   PATCH cross-trip rowId → PERM_DENIED
 *   DELETE → ok + row gone
 *   PATCH /reorder → bulk sort_order + version bump on all
 *   Enum validation — reservations.kind / emergency.kind / pretrip.ai_source
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { callHandler, jsonRequest, mockAuth, mockContext, mockEnv, seedTrip, seedUser } from './helpers';
import { onRequestPost as postFlights } from '../../functions/api/trips/[id]/notes/flights';
import { onRequestPatch as patchFlights, onRequestDelete as deleteFlights } from '../../functions/api/trips/[id]/notes/flights/[rowId]';
import { onRequestPatch as reorderFlights } from '../../functions/api/trips/[id]/notes/flights/reorder';
import { onRequestPost as postReservations } from '../../functions/api/trips/[id]/notes/reservations';
import { onRequestPost as postEmergency } from '../../functions/api/trips/[id]/notes/emergency';
import { onRequestPost as postPretrip } from '../../functions/api/trips/[id]/notes/pretrip';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
const tripA = 'trip-mut-a';
const tripB = 'trip-mut-b';
const ownerEmail = 'owner@mut.test';
const strangerEmail = 'stranger@mut.test';

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedUser(db, ownerEmail);
  await seedUser(db, strangerEmail);
  await seedTrip(db, { id: tripA, owner: ownerEmail });
  await seedTrip(db, { id: tripB, owner: ownerEmail });
});

afterAll(disposeMiniflare);

async function call<T>(handler: any, tripId: string, body?: T, params: Record<string, string> = {}, email = ownerEmail, method = 'POST') {
  const url = `https://test/api/trips/${tripId}/notes/...`;
  const ctx = mockContext({
    request: jsonRequest(url, method, body),
    env,
    auth: mockAuth({ email }),
    params: { id: tripId, ...params },
  });
  return callHandler(handler, ctx);
}

describe('POST — create row', () => {
  it('POST /flights → 201 + auto sort_order = 0 (first row)', async () => {
    const res = await call(postFlights, tripA, { airline: 'CI', flight_no: 'CI 120' });
    expect(res.status).toBe(201);
    const row = await res.json() as any;
    expect(row.airline).toBe('CI');
    expect(row.flightNo).toBe('CI 120');
    expect(row.sortOrder).toBe(0);
    expect(row.version).toBe(0);
    expect(row.tripId).toBe(tripA);
  });

  it('POST /flights again → sort_order = 1 (MAX+1)', async () => {
    const res = await call(postFlights, tripA, { airline: 'CI', flight_no: 'CI 123' });
    expect(res.status).toBe(201);
    const row = await res.json() as any;
    expect(row.sortOrder).toBe(1);
  });

  it('POST /flights with explicit sort_order → 用 user 指定值', async () => {
    const res = await call(postFlights, tripA, { airline: 'JX', flight_no: 'JX 100', sort_order: 99 });
    const row = await res.json() as any;
    expect(row.sortOrder).toBe(99);
  });

  it('POST /reservations invalid kind → 400 DATA_VALIDATION', async () => {
    const res = await call(postReservations, tripA, { title: 'r', kind: 'bad-kind' });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error.code).toBe('DATA_VALIDATION');
  });

  it('POST /reservations valid kind 5 種都接受', async () => {
    for (const kind of ['restaurant', 'experience', 'ticket', 'transport', 'other']) {
      const res = await call(postReservations, tripA, { title: `r-${kind}`, kind });
      expect(res.status).toBe(201);
    }
  });

  it('POST /emergency invalid kind → 400', async () => {
    const res = await call(postEmergency, tripA, { name: 'x', kind: 'bad' });
    expect(res.status).toBe(400);
  });

  it('POST /pretrip invalid ai_source → 400', async () => {
    const res = await call(postPretrip, tripA, { title: 't', content: 'c', ai_source: 'bad-source' });
    expect(res.status).toBe(400);
  });

  it('POST /pretrip ai_source = null OK', async () => {
    const res = await call(postPretrip, tripA, { title: 'manual', content: 'c', ai_source: null });
    expect(res.status).toBe(201);
    const row = await res.json() as any;
    expect(row.aiSource).toBeNull();
  });

  it('POST cross-trip 拒絕 — body 不能 inject trip_id', async () => {
    // body 帶 trip_id 應該被 ignore（不在 ALLOWED_FIELDS）→ row 仍 INSERT 到 tripA
    const res = await call(postFlights, tripA, { airline: 'EVIL', trip_id: tripB });
    const row = await res.json() as any;
    expect(row.tripId).toBe(tripA);
  });

  it('POST 非授權 user → 403', async () => {
    const res = await call(postFlights, tripA, { airline: 'CI' }, {}, strangerEmail);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /flights/:rowId — update + OCC', () => {
  let rowId: number;
  beforeAll(async () => {
    const res = await call(postFlights, tripB, { airline: 'CI', flight_no: 'CI 999' });
    const row = await res.json() as any;
    rowId = row.id;
  });

  it('PATCH note → 200 + version bumped', async () => {
    const res = await call(patchFlights, tripB, { note: 'window seat' }, { rowId: String(rowId) }, ownerEmail, 'PATCH');
    expect(res.status).toBe(200);
    const row = await res.json() as any;
    expect(row.note).toBe('window seat');
    expect(row.version).toBe(1);
  });

  it('PATCH with expectedVersion match → 200 + bump to 2', async () => {
    const res = await call(patchFlights, tripB, { note: 'aisle', expectedVersion: 1 }, { rowId: String(rowId) }, ownerEmail, 'PATCH');
    expect(res.status).toBe(200);
    const row = await res.json() as any;
    expect(row.version).toBe(2);
  });

  it('PATCH with expectedVersion mismatch → 409 STALE_ENTRY', async () => {
    const res = await call(patchFlights, tripB, { note: 'should fail', expectedVersion: 99 }, { rowId: String(rowId) }, ownerEmail, 'PATCH');
    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body.error.code).toBe('STALE_ENTRY');
  });

  it('PATCH cross-trip rowId → 403 PERM_DENIED', async () => {
    // rowId 屬於 tripB，但 path 寫 tripA → 應該拒絕
    const res = await call(patchFlights, tripA, { note: 'x' }, { rowId: String(rowId) }, ownerEmail, 'PATCH');
    expect(res.status).toBe(403);
  });

  it('PATCH 不存在的 rowId → 404', async () => {
    const res = await call(patchFlights, tripB, { note: 'x' }, { rowId: '99999999' }, ownerEmail, 'PATCH');
    expect(res.status).toBe(404);
  });

  it('PATCH empty body → 400 DATA_VALIDATION', async () => {
    const res = await call(patchFlights, tripB, {}, { rowId: String(rowId) }, ownerEmail, 'PATCH');
    expect(res.status).toBe(400);
  });
});

describe('DELETE /flights/:rowId', () => {
  let rowId: number;
  beforeAll(async () => {
    const res = await call(postFlights, tripB, { airline: 'TODELETE' });
    const row = await res.json() as any;
    rowId = row.id;
  });

  it('DELETE → 200 + row gone', async () => {
    const res = await call(deleteFlights, tripB, undefined, { rowId: String(rowId) }, ownerEmail, 'DELETE');
    expect(res.status).toBe(200);
    const check = await db.prepare('SELECT id FROM trip_flights WHERE id = ?').bind(rowId).first();
    expect(check).toBeNull();
  });

  it('DELETE cross-trip → 403', async () => {
    const createRes = await call(postFlights, tripB, { airline: 'CI' });
    const created = await createRes.json() as any;
    const res = await call(deleteFlights, tripA, undefined, { rowId: String(created.id) }, ownerEmail, 'DELETE');
    expect(res.status).toBe(403);
  });
});

describe('PATCH /flights/reorder — bulk', () => {
  let ids: number[];
  beforeAll(async () => {
    // Clean tripA flights first
    await db.prepare('DELETE FROM trip_flights WHERE trip_id = ?').bind('trip-reorder').run();
    await seedTrip(db, { id: 'trip-reorder', owner: ownerEmail });
    ids = [];
    for (let i = 0; i < 3; i++) {
      const res = await call(postFlights, 'trip-reorder', { airline: 'CI', flight_no: `F${i}` });
      const row = await res.json() as any;
      ids.push(row.id);
    }
  });

  it('reorder 3 rows → 200 + sort_order swap + version bump on all', async () => {
    const res = await call(reorderFlights, 'trip-reorder', {
      items: [
        { id: ids[0], sortOrder: 2 },
        { id: ids[1], sortOrder: 0 },
        { id: ids[2], sortOrder: 1 },
      ],
    }, {}, ownerEmail, 'PATCH');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.updated).toBe(3);

    const { results } = await db
      .prepare('SELECT id, sort_order, version FROM trip_flights WHERE trip_id = ? ORDER BY sort_order')
      .bind('trip-reorder')
      .all<{ id: number; sort_order: number; version: number }>();
    expect(results.map((r) => r.id)).toEqual([ids[1], ids[2], ids[0]]);
    // version 都從 0 升到 1（POST 後沒動過 → 0；reorder bump → 1）
    expect(results.every((r) => r.version === 1)).toBe(true);
  });

  it('reorder 帶 cross-trip id → 403', async () => {
    const otherRes = await call(postFlights, tripA, { airline: 'OTHER' });
    const other = await otherRes.json() as any;
    const res = await call(reorderFlights, 'trip-reorder', {
      items: [{ id: other.id, sortOrder: 0 }],
    }, {}, ownerEmail, 'PATCH');
    expect(res.status).toBe(403);
  });

  it('reorder empty items → 400', async () => {
    const res = await call(reorderFlights, 'trip-reorder', { items: [] }, {}, ownerEmail, 'PATCH');
    expect(res.status).toBe(400);
  });

  it('reorder invalid id 型別 → 400', async () => {
    const res = await call(reorderFlights, 'trip-reorder', { items: [{ id: 'abc', sortOrder: 0 }] as any }, {}, ownerEmail, 'PATCH');
    expect(res.status).toBe(400);
  });
});
