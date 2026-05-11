/**
 * Integration tests — v2.27.0 multi-POI per entry endpoints
 *
 * Covers:
 *   - PATCH /api/trips/:id/entries/:eid/master       (swap + replace + OCC)
 *   - POST  /api/trips/:id/entries/:eid/alternates   (add)
 *   - DELETE /api/trips/:id/entries/:eid/alternates/:poiId  (remove)
 *   - PATCH /api/trips/:id/entries/:eid/alternates/reorder  (reorder)
 *   - segments stale marking after master swap
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import {
  mockEnv,
  mockAuth,
  mockContext,
  jsonRequest,
  seedTrip,
  seedEntry,
  seedPoi,
  getDayId,
  callHandler,
} from './helpers';
import { onRequestPatch as masterPatch } from '../../functions/api/trips/[id]/entries/[eid]/master';
import { onRequestPost as alternatesPost } from '../../functions/api/trips/[id]/entries/[eid]/alternates';
import { onRequestDelete as alternateDelete } from '../../functions/api/trips/[id]/entries/[eid]/alternates/[poiId]';
import { onRequestPatch as reorderPatch } from '../../functions/api/trips/[id]/entries/[eid]/alternates/reorder';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
const TRIP_ID = 'trip-ep';
const USER_EMAIL = 'user@test.com';

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: TRIP_ID });
}, 30000);

afterAll(disposeMiniflare);

// Helper: seed entry with master POI written to trip_entry_pois
async function seedEntryWithMaster(opts: {
  poiName: string;
  altPoiNames?: string[];
}): Promise<{ entryId: number; masterPoiId: number; altPoiIds: number[] }> {
  const dayId = await getDayId(db, TRIP_ID, 1);
  const masterPoiId = await seedPoi(db, { name: opts.poiName, type: 'attraction' });
  const entryId = await seedEntry(db, dayId, { title: opts.poiName, poiId: masterPoiId });
  await db
    .prepare(
      'INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)',
    )
    .bind(entryId, masterPoiId)
    .run();

  const altPoiIds: number[] = [];
  if (opts.altPoiNames) {
    for (let i = 0; i < opts.altPoiNames.length; i++) {
      const altId = await seedPoi(db, { name: opts.altPoiNames[i], type: 'attraction' });
      altPoiIds.push(altId);
      await db
        .prepare(
          'INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, ?)',
        )
        .bind(entryId, altId, i + 2)
        .run();
    }
  }
  return { entryId, masterPoiId, altPoiIds };
}

describe('PATCH /master — swap existing alternate', () => {
  it('將 alternate sort_order=2 swap 成 master，舊 master 變 sort_order=2', async () => {
    const { entryId, masterPoiId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'Master-Swap-A',
      altPoiNames: ['Alt-Swap-A-1'],
    });

    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/master`,
        'PATCH',
        { poiId: altPoiIds[0] },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    const resp = await callHandler(masterPatch, ctx);
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { masterPoiId: number; oldMasterPoiId: number; entryPoisVersion: string };
    expect(body.masterPoiId).toBe(altPoiIds[0]);
    expect(body.oldMasterPoiId).toBe(masterPoiId);
    expect(body.entryPoisVersion).toBeTruthy();

    // Verify DB state
    const newMaster = await db
      .prepare('SELECT poi_id FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1')
      .bind(entryId)
      .first<{ poi_id: number }>();
    expect(newMaster!.poi_id).toBe(altPoiIds[0]);

    const oldMaster = await db
      .prepare('SELECT sort_order FROM trip_entry_pois WHERE entry_id = ? AND poi_id = ?')
      .bind(entryId, masterPoiId)
      .first<{ sort_order: number }>();
    expect(oldMaster!.sort_order).toBe(2);

    // trip_entries.poi_id dual-write
    const entry = await db
      .prepare('SELECT poi_id FROM trip_entries WHERE id = ?')
      .bind(entryId)
      .first<{ poi_id: number }>();
    expect(entry!.poi_id).toBe(altPoiIds[0]);
  });
});

describe('PATCH /master — replace with new POI', () => {
  it('新 POI 不在 alternates → INSERT 為 master，舊 master 變 sort_order=max+1', async () => {
    const { entryId, masterPoiId } = await seedEntryWithMaster({
      poiName: 'Master-Replace-A',
      altPoiNames: ['Alt-Replace-1'],
    });
    const newPoiId = await seedPoi(db, { name: 'New-Replace-Master', type: 'restaurant' });

    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/master`,
        'PATCH',
        { poiId: newPoiId },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    const resp = await callHandler(masterPatch, ctx);
    expect(resp.status).toBe(200);

    const newMaster = await db
      .prepare('SELECT poi_id FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1')
      .bind(entryId)
      .first<{ poi_id: number }>();
    expect(newMaster!.poi_id).toBe(newPoiId);

    // 舊 master 變 max+1（原 alternate 在 sort_order=2，所以 max=2，舊 master 變 3）
    const oldMaster = await db
      .prepare('SELECT sort_order FROM trip_entry_pois WHERE entry_id = ? AND poi_id = ?')
      .bind(entryId, masterPoiId)
      .first<{ sort_order: number }>();
    expect(oldMaster!.sort_order).toBe(3);
  });
});

describe('PATCH /master — OCC version', () => {
  it('expectedVersion mismatch → 409 STALE_ENTRY', async () => {
    const { entryId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'Master-OCC-A',
      altPoiNames: ['Alt-OCC-1'],
    });

    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/master`,
        'PATCH',
        { poiId: altPoiIds[0], version: 'STALE-VERSION-TOKEN' },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    const resp = await callHandler(masterPatch, ctx);
    expect(resp.status).toBe(409);
    const body = (await resp.json()) as { error: { code: string } };
    expect(body.error.code).toBe('STALE_ENTRY');
  });

  it('expectedVersion match → 200', async () => {
    const { entryId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'Master-OCC-B',
      altPoiNames: ['Alt-OCC-B1'],
    });

    const versionRow = await db
      .prepare("SELECT COALESCE(MAX(updated_at), '0') AS v FROM trip_entry_pois WHERE entry_id = ?")
      .bind(entryId)
      .first<{ v: string }>();

    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/master`,
        'PATCH',
        { poiId: altPoiIds[0], version: versionRow!.v },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    const resp = await callHandler(masterPatch, ctx);
    expect(resp.status).toBe(200);
  });
});

describe('PATCH /master — invalid input', () => {
  it('poiId 不存在 → 404', async () => {
    const { entryId } = await seedEntryWithMaster({ poiName: 'Master-NF-A' });
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/master`,
        'PATCH',
        { poiId: 9999999 },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    expect((await callHandler(masterPatch, ctx)).status).toBe(404);
  });

  it('poiId 缺漏 → 400', async () => {
    const { entryId } = await seedEntryWithMaster({ poiName: 'Master-NF-B' });
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/master`,
        'PATCH',
        {},
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    expect((await callHandler(masterPatch, ctx)).status).toBe(400);
  });
});

describe('POST /alternates — add', () => {
  it('加 alternate → 201 sort_order = max+1', async () => {
    const { entryId } = await seedEntryWithMaster({ poiName: 'AltAdd-Master' });
    const altPoiId = await seedPoi(db, { name: 'AltAdd-New-1', type: 'attraction' });

    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates`,
        'POST',
        { poiId: altPoiId },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    const resp = await callHandler(alternatesPost, ctx);
    expect(resp.status).toBe(201);
    const body = (await resp.json()) as { sortOrder: number; entryPoisVersion: string };
    expect(body.sortOrder).toBe(2);
    expect(body.entryPoisVersion).toBeTruthy();
  });

  it('已存在的 POI → 409 DUPLICATE_POI', async () => {
    const { entryId, masterPoiId } = await seedEntryWithMaster({ poiName: 'AltAdd-DupMaster' });
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates`,
        'POST',
        { poiId: masterPoiId },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    const resp = await callHandler(alternatesPost, ctx);
    expect(resp.status).toBe(409);
    const body = (await resp.json()) as { error: { code: string } };
    expect(body.error.code).toBe('DUPLICATE_POI');
  });

  it('entry 無 master → 400 MISSING_MASTER', async () => {
    const dayId = await getDayId(db, TRIP_ID, 1);
    const entryId = await seedEntry(db, dayId, { title: 'No-Master-Entry' });
    const altPoiId = await seedPoi(db, { name: 'Lonely-Alt', type: 'restaurant' });

    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates`,
        'POST',
        { poiId: altPoiId },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    const resp = await callHandler(alternatesPost, ctx);
    expect(resp.status).toBe(400);
    const body = (await resp.json()) as { error: { code: string } };
    expect(body.error.code).toBe('MISSING_MASTER');
  });
});

describe('DELETE /alternates/:poiId — remove', () => {
  it('刪 alternate → 200', async () => {
    const { entryId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'AltDel-Master',
      altPoiNames: ['AltDel-1'],
    });

    const ctx = mockContext({
      request: new Request(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates/${altPoiIds[0]}`,
        { method: 'DELETE' },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: {
        id: TRIP_ID,
        eid: String(entryId),
        poiId: String(altPoiIds[0]),
      },
    });
    const resp = await callHandler(alternateDelete, ctx);
    expect(resp.status).toBe(200);

    const remaining = await db
      .prepare('SELECT COUNT(*) AS c FROM trip_entry_pois WHERE entry_id = ?')
      .bind(entryId)
      .first<{ c: number }>();
    expect(remaining!.c).toBe(1); // 只剩 master
  });

  it('刪 master → 400（必須走 DELETE /entries/:id）', async () => {
    const { entryId, masterPoiId } = await seedEntryWithMaster({ poiName: 'AltDel-CantRemoveMaster' });
    const ctx = mockContext({
      request: new Request(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates/${masterPoiId}`,
        { method: 'DELETE' },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: {
        id: TRIP_ID,
        eid: String(entryId),
        poiId: String(masterPoiId),
      },
    });
    expect((await callHandler(alternateDelete, ctx)).status).toBe(400);
  });

  it('POI 不在 entry → 404 POI_NOT_ALTERNATE', async () => {
    const { entryId } = await seedEntryWithMaster({ poiName: 'AltDel-NotFound' });
    const fakePoiId = await seedPoi(db, { name: 'AltDel-Fake', type: 'restaurant' });
    const ctx = mockContext({
      request: new Request(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates/${fakePoiId}`,
        { method: 'DELETE' },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: {
        id: TRIP_ID,
        eid: String(entryId),
        poiId: String(fakePoiId),
      },
    });
    const resp = await callHandler(alternateDelete, ctx);
    expect(resp.status).toBe(404);
    const body = (await resp.json()) as { error: { code: string } };
    expect(body.error.code).toBe('POI_NOT_ALTERNATE');
  });
});

describe('PATCH /alternates/reorder', () => {
  it('合法 reorder → 200，sort_order 從 2 起依序', async () => {
    const { entryId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'Reorder-Master',
      altPoiNames: ['Re-1', 'Re-2', 'Re-3'],
    });
    // 原順序 [Re-1=2, Re-2=3, Re-3=4]，reorder 為 [Re-3, Re-1, Re-2]
    const reversed = [altPoiIds[2], altPoiIds[0], altPoiIds[1]];

    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates/reorder`,
        'PATCH',
        { order: reversed },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    const resp = await callHandler(reorderPatch, ctx);
    expect(resp.status).toBe(200);

    const rows = await db
      .prepare('SELECT poi_id, sort_order FROM trip_entry_pois WHERE entry_id = ? ORDER BY sort_order')
      .bind(entryId)
      .all<{ poi_id: number; sort_order: number }>();
    expect(rows.results).toHaveLength(4); // master + 3 alternates
    expect(rows.results[1].poi_id).toBe(altPoiIds[2]); // Re-3 at order 2
    expect(rows.results[2].poi_id).toBe(altPoiIds[0]); // Re-1 at order 3
    expect(rows.results[3].poi_id).toBe(altPoiIds[1]); // Re-2 at order 4
  });

  it('length mismatch → 422 INVALID_ORDER', async () => {
    const { entryId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'Reorder-Mismatch',
      altPoiNames: ['Re-Mis-1', 'Re-Mis-2'],
    });
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates/reorder`,
        'PATCH',
        { order: [altPoiIds[0]] }, // only 1 of 2
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    const resp = await callHandler(reorderPatch, ctx);
    expect(resp.status).toBe(422);
  });

  it('duplicates → 422 INVALID_ORDER', async () => {
    const { entryId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'Reorder-Dup',
      altPoiNames: ['Re-Dup-1', 'Re-Dup-2'],
    });
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates/reorder`,
        'PATCH',
        { order: [altPoiIds[0], altPoiIds[0]] },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    expect((await callHandler(reorderPatch, ctx)).status).toBe(422);
  });
});

describe('Cascade behavior', () => {
  it('DELETE entry → ON DELETE CASCADE 清掉所有 trip_entry_pois', async () => {
    const { entryId, masterPoiId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'Cascade-Master',
      altPoiNames: ['Cascade-A', 'Cascade-B'],
    });
    const before = await db
      .prepare('SELECT COUNT(*) AS c FROM trip_entry_pois WHERE entry_id = ?')
      .bind(entryId)
      .first<{ c: number }>();
    expect(before!.c).toBe(3);

    await db.prepare('DELETE FROM trip_entries WHERE id = ?').bind(entryId).run();

    const after = await db
      .prepare('SELECT COUNT(*) AS c FROM trip_entry_pois WHERE entry_id = ?')
      .bind(entryId)
      .first<{ c: number }>();
    expect(after!.c).toBe(0);
  });
});

describe('Segment recompute trigger', () => {
  it('master swap → from/to segments marked stale', async () => {
    // 設 2 個 entries 在同 day + segment 連接
    const dayId = await getDayId(db, TRIP_ID, 1);
    const p1 = await seedPoi(db, { name: 'Seg-P1', type: 'attraction' });
    const p2 = await seedPoi(db, { name: 'Seg-P2', type: 'attraction' });
    const altP = await seedPoi(db, { name: 'Seg-Alt', type: 'attraction' });
    const e1 = await seedEntry(db, dayId, { title: 'Seg-E1', poiId: p1 });
    const e2 = await seedEntry(db, dayId, { title: 'Seg-E2', poiId: p2, sortOrder: 2 });
    await db.batch([
      db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)').bind(e1, p1),
      db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)').bind(e2, p2),
      db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 2)').bind(e2, altP),
      db
        .prepare(
          "INSERT INTO trip_segments (trip_id, from_entry_id, to_entry_id, mode, min, source, computed_at) VALUES (?, ?, ?, 'driving', 10, 'google', datetime('now'))",
        )
        .bind(TRIP_ID, e1, e2),
    ]);

    // master swap on e2 (altP → master)
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${e2}/master`,
        'PATCH',
        { poiId: altP },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(e2) },
    });
    const resp = await callHandler(masterPatch, ctx);
    expect(resp.status).toBe(200);

    const seg = await db
      .prepare('SELECT source, computed_at, updated_at FROM trip_segments WHERE from_entry_id = ? AND to_entry_id = ?')
      .bind(e1, e2)
      .first<{ source: string; computed_at: string | null; updated_at: number | null }>();
    // trip_segments.source CHECK 不允許 'stale'；改用 computed_at=NULL 標 stale + bump updated_at
    expect(seg!.computed_at).toBeNull();
    expect(seg!.updated_at).toBeGreaterThan(0);
  });
});
