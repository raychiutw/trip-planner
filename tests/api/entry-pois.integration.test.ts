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
import { onRequestPatch as poiNotePatch } from '../../functions/api/trips/[id]/entries/[eid]/pois/[poiId]';
// round 7 fix: route cross-mutation regression through real PATCH /entries handler
// instead of raw SQL — if a future change adds entry_pois_version to ALLOWED_FIELDS
// or to buildUpdateClause(), the raw-SQL test would silently pass while the real
// handler invalidates OCC tokens.
import { onRequestPatch as entryPatch } from '../../functions/api/trips/[id]/entries/[eid]';
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
// v2.29.0: seedEntry({ poiId }) 已自動 INSERT trip_entry_pois sort_order=1，不必再 explicit INSERT。
async function seedEntryWithMaster(opts: {
  poiName: string;
  altPoiNames?: string[];
}): Promise<{ entryId: number; masterPoiId: number; altPoiIds: number[] }> {
  const dayId = await getDayId(db, TRIP_ID, 1);
  const masterPoiId = await seedPoi(db, { name: opts.poiName, type: 'attraction' });
  const entryId = await seedEntry(db, dayId, { title: opts.poiName, poiId: masterPoiId });

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

    // v2.29.0: trip_entries.poi_id DROPPED. master 已從 trip_entry_pois sort_order=1 查過了 (line 104-108)。
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

    // round 5 fix: OCC version is trip_entries.entry_pois_version (integer counter,
    // migration 0058). Read as string to match wire format.
    const versionRow = await db
      .prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?')
      .bind(entryId)
      .first<{ v: number }>();

    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/master`,
        'PATCH',
        { poiId: altPoiIds[0], version: String(versionRow!.v) },
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

  it('搜尋結果 payload → find-or-create POI 後加為 alternate', async () => {
    const { entryId } = await seedEntryWithMaster({ poiName: 'AltAdd-Search-Master' });

    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates`,
        'POST',
        {
          name: 'AltAdd-Search-New',
          lat: 26.123,
          lng: 127.456,
          type: 'restaurant',
          category: 'restaurant',
          address: 'Okinawa',
          rating: 4.6,
          source: 'google',
        },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    const resp = await callHandler(alternatesPost, ctx);
    expect(resp.status).toBe(201);
    const body = (await resp.json()) as { poiId: number; sortOrder: number };
    expect(body.sortOrder).toBe(2);

    const poi = await db
      .prepare('SELECT name, type, category, address, rating FROM pois WHERE id = ?')
      .bind(body.poiId)
      .first<{ name: string; type: string; category: string | null; address: string | null; rating: number | null }>();
    expect(poi).toMatchObject({
      name: 'AltAdd-Search-New',
      type: 'restaurant',
      category: 'restaurant',
      address: 'Okinawa',
      rating: 4.6,
    });

    const link = await db
      .prepare('SELECT sort_order FROM trip_entry_pois WHERE entry_id = ? AND poi_id = ?')
      .bind(entryId, body.poiId)
      .first<{ sort_order: number }>();
    expect(link?.sort_order).toBe(2);
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

  // v2.33.106 T-7: 補 POST /alternates body validation 路徑 — 既有 coverage
  // 主要在 happy path / MISSING_MASTER / DUPLICATE_POI，缺 body shape / poiId 型別
  // / unknown poiId / empty body validation。
  describe('body validation (T-7)', () => {
    it('body 非 object (string) → 400', async () => {
      const { entryId } = await seedEntryWithMaster({ poiName: 'AltValid-StringBody' });
      const ctx = mockContext({
        request: new Request(
          `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates`,
          { method: 'POST', headers: { 'content-type': 'application/json' }, body: '"a string"' },
        ),
        env,
        auth: mockAuth({ email: USER_EMAIL }),
        params: { id: TRIP_ID, eid: String(entryId) },
      });
      expect((await callHandler(alternatesPost, ctx)).status).toBe(400);
    });

    it('body 非 object (array) → 400', async () => {
      const { entryId } = await seedEntryWithMaster({ poiName: 'AltValid-ArrayBody' });
      const ctx = mockContext({
        request: new Request(
          `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates`,
          { method: 'POST', headers: { 'content-type': 'application/json' }, body: '[1,2,3]' },
        ),
        env,
        auth: mockAuth({ email: USER_EMAIL }),
        params: { id: TRIP_ID, eid: String(entryId) },
      });
      expect((await callHandler(alternatesPost, ctx)).status).toBe(400);
    });

    it('entryPoisVersion 非字串（number）→ 400', async () => {
      const { entryId } = await seedEntryWithMaster({ poiName: 'AltValid-VersionType' });
      const altPoiId = await seedPoi(db, { name: 'AltValid-VersionTypePOI' });
      const ctx = mockContext({
        request: jsonRequest(
          `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates`,
          'POST',
          { poiId: altPoiId, entryPoisVersion: 123 },
        ),
        env,
        auth: mockAuth({ email: USER_EMAIL }),
        params: { id: TRIP_ID, eid: String(entryId) },
      });
      expect((await callHandler(alternatesPost, ctx)).status).toBe(400);
    });

    it('poiId 是負數 → 400', async () => {
      const { entryId } = await seedEntryWithMaster({ poiName: 'AltValid-NegId' });
      const ctx = mockContext({
        request: jsonRequest(
          `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates`,
          'POST',
          { poiId: -5 },
        ),
        env,
        auth: mockAuth({ email: USER_EMAIL }),
        params: { id: TRIP_ID, eid: String(entryId) },
      });
      expect((await callHandler(alternatesPost, ctx)).status).toBe(400);
    });

    it('poiId 是 0 → 400', async () => {
      const { entryId } = await seedEntryWithMaster({ poiName: 'AltValid-ZeroId' });
      const ctx = mockContext({
        request: jsonRequest(
          `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates`,
          'POST',
          { poiId: 0 },
        ),
        env,
        auth: mockAuth({ email: USER_EMAIL }),
        params: { id: TRIP_ID, eid: String(entryId) },
      });
      expect((await callHandler(alternatesPost, ctx)).status).toBe(400);
    });

    it('poiId 是非整數（小數）→ 400', async () => {
      const { entryId } = await seedEntryWithMaster({ poiName: 'AltValid-FloatId' });
      const ctx = mockContext({
        request: jsonRequest(
          `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates`,
          'POST',
          { poiId: 3.14 },
        ),
        env,
        auth: mockAuth({ email: USER_EMAIL }),
        params: { id: TRIP_ID, eid: String(entryId) },
      });
      expect((await callHandler(alternatesPost, ctx)).status).toBe(400);
    });

    it('poiId 非數字（string）→ 400', async () => {
      const { entryId } = await seedEntryWithMaster({ poiName: 'AltValid-StrId' });
      const ctx = mockContext({
        request: jsonRequest(
          `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates`,
          'POST',
          { poiId: 'abc' },
        ),
        env,
        auth: mockAuth({ email: USER_EMAIL }),
        params: { id: TRIP_ID, eid: String(entryId) },
      });
      expect((await callHandler(alternatesPost, ctx)).status).toBe(400);
    });

    it('poiId 指向不存在的 POI → 404', async () => {
      const { entryId } = await seedEntryWithMaster({ poiName: 'AltValid-UnknownId' });
      const ctx = mockContext({
        request: jsonRequest(
          `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates`,
          'POST',
          { poiId: 99999999 },
        ),
        env,
        auth: mockAuth({ email: USER_EMAIL }),
        params: { id: TRIP_ID, eid: String(entryId) },
      });
      expect((await callHandler(alternatesPost, ctx)).status).toBe(404);
    });

    it('empty body（無 poiId 也無 name/lat/lng）→ 400', async () => {
      const { entryId } = await seedEntryWithMaster({ poiName: 'AltValid-Empty' });
      const ctx = mockContext({
        request: jsonRequest(
          `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates`,
          'POST',
          {},
        ),
        env,
        auth: mockAuth({ email: USER_EMAIL }),
        params: { id: TRIP_ID, eid: String(entryId) },
      });
      expect((await callHandler(alternatesPost, ctx)).status).toBe(400);
    });
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

// =========================================================================
// v2.27.0 ship coverage gaps — auth + perm + cross-trip + edge cases
// =========================================================================

describe('Auth & permission gates — PATCH /master', () => {
  it('未認證 → 401 AUTH_REQUIRED', async () => {
    const { entryId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'AuthMaster-A',
      altPoiNames: ['AuthMaster-Alt-1'],
    });
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/master`,
        'PATCH',
        { poiId: altPoiIds[0] },
      ),
      env,
      // no auth
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    expect((await callHandler(masterPatch, ctx)).status).toBe(401);
  });

  it('非 owner 無 write perm → 403 PERM_DENIED', async () => {
    const { entryId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'AuthMaster-B',
      altPoiNames: ['AuthMaster-Alt-2'],
    });
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/master`,
        'PATCH',
        { poiId: altPoiIds[0] },
      ),
      env,
      auth: mockAuth({ email: 'stranger@test.com' }),
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    expect((await callHandler(masterPatch, ctx)).status).toBe(403);
  });

  it('cross-trip URL（entry 不屬於 URL 的 trip）→ 404 DATA_NOT_FOUND', async () => {
    // 另開一個 trip 並嘗試用該 trip URL 改原 trip 的 entry master
    await seedTrip(db, { id: 'trip-ep-other' });
    const { entryId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'CrossTrip-A',
      altPoiNames: ['CrossTrip-Alt-1'],
    });
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/trip-ep-other/entries/${entryId}/master`,
        'PATCH',
        { poiId: altPoiIds[0] },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: 'trip-ep-other', eid: String(entryId) },
    });
    expect((await callHandler(masterPatch, ctx)).status).toBe(404);
  });
});

describe('Auth & permission gates — POST /alternates', () => {
  it('未認證 → 401', async () => {
    const { entryId } = await seedEntryWithMaster({ poiName: 'AuthAlt-A' });
    const altPoiId = await seedPoi(db, { name: 'AuthAlt-A-Alt', type: 'attraction' });
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates`,
        'POST',
        { poiId: altPoiId },
      ),
      env,
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    expect((await callHandler(alternatesPost, ctx)).status).toBe(401);
  });

  it('無 write perm → 403', async () => {
    const { entryId } = await seedEntryWithMaster({ poiName: 'AuthAlt-B' });
    const altPoiId = await seedPoi(db, { name: 'AuthAlt-B-Alt', type: 'attraction' });
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates`,
        'POST',
        { poiId: altPoiId },
      ),
      env,
      auth: mockAuth({ email: 'stranger@test.com' }),
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    expect((await callHandler(alternatesPost, ctx)).status).toBe(403);
  });

  it('poiId 缺漏 / 非正整數 → 400 DATA_VALIDATION', async () => {
    const { entryId } = await seedEntryWithMaster({ poiName: 'AuthAlt-C' });
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates`,
        'POST',
        { poiId: -1 },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    expect((await callHandler(alternatesPost, ctx)).status).toBe(400);
  });

  it('poiId 不存在 → 404 DATA_NOT_FOUND', async () => {
    const { entryId } = await seedEntryWithMaster({ poiName: 'AuthAlt-D' });
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates`,
        'POST',
        { poiId: 9999999 },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    expect((await callHandler(alternatesPost, ctx)).status).toBe(404);
  });
});

describe('Auth & permission gates — DELETE /alternates/:poiId', () => {
  it('未認證 → 401', async () => {
    const { entryId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'AuthDel-A',
      altPoiNames: ['AuthDel-A-Alt'],
    });
    const ctx = mockContext({
      request: new Request(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates/${altPoiIds[0]}`,
        { method: 'DELETE' },
      ),
      env,
      params: { id: TRIP_ID, eid: String(entryId), poiId: String(altPoiIds[0]) },
    });
    expect((await callHandler(alternateDelete, ctx)).status).toBe(401);
  });

  it('無 write perm → 403', async () => {
    const { entryId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'AuthDel-B',
      altPoiNames: ['AuthDel-B-Alt'],
    });
    const ctx = mockContext({
      request: new Request(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates/${altPoiIds[0]}`,
        { method: 'DELETE' },
      ),
      env,
      auth: mockAuth({ email: 'stranger@test.com' }),
      params: { id: TRIP_ID, eid: String(entryId), poiId: String(altPoiIds[0]) },
    });
    expect((await callHandler(alternateDelete, ctx)).status).toBe(403);
  });
});

describe('Auth & permission gates — PATCH /alternates/reorder', () => {
  it('未認證 → 401', async () => {
    const { entryId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'AuthReorder-A',
      altPoiNames: ['R-1', 'R-2'],
    });
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates/reorder`,
        'PATCH',
        { order: [altPoiIds[1], altPoiIds[0]] },
      ),
      env,
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    expect((await callHandler(reorderPatch, ctx)).status).toBe(401);
  });

  it('order 非 array → 422 INVALID_ORDER', async () => {
    const { entryId } = await seedEntryWithMaster({
      poiName: 'AuthReorder-B',
      altPoiNames: ['R-3'],
    });
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates/reorder`,
        'PATCH',
        { order: 'not-array' },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    expect((await callHandler(reorderPatch, ctx)).status).toBe(422);
  });

  it('order 含非 integer → 422 INVALID_ORDER', async () => {
    const { entryId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'AuthReorder-C',
      altPoiNames: ['R-4'],
    });
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates/reorder`,
        'PATCH',
        { order: [altPoiIds[0], 'string'] },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    expect((await callHandler(reorderPatch, ctx)).status).toBe(422);
  });
});

describe('setMaster() edge cases', () => {
  it('no-op: poiId === 現有 master → 200 不變更 sort_order', async () => {
    const { entryId, masterPoiId } = await seedEntryWithMaster({
      poiName: 'NoOp-Master',
      altPoiNames: ['NoOp-Alt'],
    });
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/master`,
        'PATCH',
        { poiId: masterPoiId },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    });
    const resp = await callHandler(masterPatch, ctx);
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { masterPoiId: number; oldMasterPoiId: number };
    expect(body.masterPoiId).toBe(masterPoiId);
    expect(body.oldMasterPoiId).toBe(masterPoiId);
    // master 仍是同 POI
    const newMaster = await db
      .prepare('SELECT poi_id FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1')
      .bind(entryId)
      .first<{ poi_id: number }>();
    expect(newMaster!.poi_id).toBe(masterPoiId);
  });
});

describe('GET /api/trips/:id/days/:num — multi-POI surface', () => {
  it('回傳 timeline 含 master + alternates + entryPoisVersion', async () => {
    // days-num.test 已測 GET shape；此處重點是 multi-POI fields surface。
    const { entryId } = await seedEntryWithMaster({
      poiName: 'DaySurface-Master',
      altPoiNames: ['DaySurface-Alt-1', 'DaySurface-Alt-2'],
    });
    // 取得 entry 所在 dayNum
    const dayRow = await db
      .prepare(
        `SELECT d.day_num FROM trip_days d
         JOIN trip_entries e ON e.day_id = d.id
         WHERE e.id = ?`,
      )
      .bind(entryId)
      .first<{ day_num: number }>();
    expect(dayRow).not.toBeNull();
    const ctx = mockContext({
      request: new Request(
        `https://test.com/api/trips/${TRIP_ID}/days/${dayRow!.day_num}`,
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, num: String(dayRow!.day_num) },
    });
    // direct handler ref
    const handler = (await import('../../functions/api/trips/[id]/days/[num]')).onRequestGet;
    const resp = await callHandler(handler, ctx);
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as {
      timeline: Array<{
        id: number;
        master: { poiId: number; name?: string | null } | null;
        alternates: Array<{ poiId: number; sortOrder: number }>;
        entryPoisVersion: string | null;
      }>;
    };
    const me = data.timeline.find((e) => e.id === entryId);
    expect(me).toBeDefined();
    expect(me!.master).not.toBeNull();
    expect(me!.master!.name).toBe('DaySurface-Master');
    expect(me!.alternates).toHaveLength(2);
    expect(me!.alternates[0].sortOrder).toBe(2);
    expect(me!.alternates[1].sortOrder).toBe(3);
    expect(me!.entryPoisVersion).toBeTruthy();
  });

  it('用餐 stop 的 master/stopPois 取 trip_entry_pois sort_order=1', async () => {
    // v2.29.0: trip_entries.poi_id DROPPED — master 由 trip_entry_pois.sort_order=1 唯一決定。
    const dayId = await getDayId(db, TRIP_ID, 1);
    const primaryRestaurant = await db
      .prepare("INSERT INTO pois (name, type) VALUES ('Order One Ramen', 'restaurant') RETURNING id")
      .first<{ id: number }>();
    const alternateRestaurant = await db
      .prepare("INSERT INTO pois (name, type) VALUES ('Order Two Soba', 'restaurant') RETURNING id")
      .first<{ id: number }>();
    // 不傳 poiId 給 seedEntry 以避免 auto-INSERT trip_entry_pois 跟下方 explicit INSERT 衝突。
    const entryId = await seedEntry(db, dayId, { title: '午餐' });
    await db.batch([
      db
        .prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)')
        .bind(entryId, primaryRestaurant!.id),
      db
        .prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 2)')
        .bind(entryId, alternateRestaurant!.id),
    ]);

    const handler = (await import('../../functions/api/trips/[id]/days/[num]')).onRequestGet;
    const ctx = mockContext({
      request: new Request(`https://test.com/api/trips/${TRIP_ID}/days/1`),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, num: '1' },
    });
    const resp = await callHandler(handler, ctx);
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as {
      timeline: Array<{
        id: number;
        stopPois?: Array<{ poiId: number; sortOrder: number; type: string; name: string }>;
        master: { poiId: number; type: string; name: string } | null;
        alternates: Array<{ poiId: number; sortOrder: number }>;
      }>;
    };
    const meal = data.timeline.find((e) => e.id === entryId);
    expect(meal).toBeDefined();
    expect(meal!.stopPois?.map((p) => [p.poiId, p.sortOrder])).toEqual([
      [primaryRestaurant!.id, 1],
      [alternateRestaurant!.id, 2],
    ]);
    expect('poiId' in meal!).toBe(false);
    expect('poi' in meal!).toBe(false);
    expect(meal!.master).toMatchObject({
      poiId: primaryRestaurant!.id,
      type: 'restaurant',
      name: 'Order One Ramen',
    });
    expect(meal!.alternates[0]!.poiId).toBe(alternateRestaurant!.id);
  });

  // v2.29.0: 「舊 trip_pois timeline rows 不會被 promoted」test removed — trip_pois table DROPPED。
});

describe('v2.28.0 — alternates 含 restaurant 欄位 (price/hours/reservation)', () => {
  it('alternates 從 fetchEntryPoisByEntries 帶出 trip_entry_pois metadata 欄位', async () => {
    // Seed: entry with master attraction + alt restaurant (poi.type='restaurant')
    const masterPoi = await db.prepare(
      "INSERT INTO pois (name, type) VALUES ('R-Master-Attraction', 'attraction') RETURNING id"
    ).first<{ id: number }>();
    const altRestaurant = await db.prepare(
      "INSERT INTO pois (name, type, hours, rating, price) VALUES ('R-Alt-Restaurant', 'restaurant', '11:00-22:00', 4.3, '$$') RETURNING id"
    ).first<{ id: number }>();
    const dayId = await getDayId(db, TRIP_ID, 1);
    // v2.29.0: trip_entries.{time, poi_id} DROPPED. 用 start_time + trip_entry_pois 寫 master。
    const entry = await db.prepare(
      "INSERT INTO trip_entries (day_id, sort_order, start_time, title) VALUES (?, 99, '18:00', 'R-Entry') RETURNING id"
    ).bind(dayId).first<{ id: number }>();

    await db.batch([
      db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)').bind(entry!.id, masterPoi!.id),
      db.prepare(
        `INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order, reservation, reservation_url, description)
         VALUES (?, ?, 2, ?, ?, ?)`
      ).bind(entry!.id, altRestaurant!.id, '已訂位', 'https://example.com/reservation', '想試試特色料理'),
    ]);

    // Fetch via day GET handler
    const dayRow = await db.prepare(
      'SELECT day_num FROM trip_days WHERE id = ?'
    ).bind(dayId).first<{ day_num: number }>();
    const handler = (await import('../../functions/api/trips/[id]/days/[num]')).onRequestGet;
    const ctx = mockContext({
      request: new Request(`https://test.com/api/trips/${TRIP_ID}/days/${dayRow!.day_num}`),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, num: String(dayRow!.day_num) },
    });
    const resp = await callHandler(handler, ctx);
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as {
      timeline: Array<{
        id: number;
        alternates: Array<{
          poiId: number;
          type?: string;
          hours?: string | null;
          rating?: number | null;
          price?: string | null;
          reservation?: string | null;
          reservationUrl?: string | null;
          description?: string | null;
        }>;
      }>;
    };
    const me = data.timeline.find((e) => e.id === entry!.id);
    expect(me).toBeDefined();
    expect(me!.alternates).toHaveLength(1);
    const alt = me!.alternates[0]!;
    expect(alt.poiId).toBe(altRestaurant!.id);
    expect(alt.type).toBe('restaurant');
    // pois master fields
    expect(alt.hours).toBe('11:00-22:00');
    expect(alt.rating).toBe(4.3);
    expect(alt.price).toBe('$$');
    // trip_entry_pois metadata fields
    expect(alt.reservation).toBe('已訂位');
    expect(alt.reservationUrl).toBe('https://example.com/reservation');
    expect(alt.description).toBe('想試試特色料理');
  });

  it('non-restaurant alternates 不應 surface restaurant-specific fields 為 truthy', async () => {
    // v2.29.0: trip_pois override DROPPED. Master + 一個 attraction alt → price/reservation NULL。
    const masterPoi = await db.prepare(
      "INSERT INTO pois (name, type) VALUES ('R-Master2', 'attraction') RETURNING id"
    ).first<{ id: number }>();
    const altAttraction = await db.prepare(
      "INSERT INTO pois (name, type) VALUES ('R-Alt-Attraction', 'attraction') RETURNING id"
    ).first<{ id: number }>();
    const dayId = await getDayId(db, TRIP_ID, 1);
    const entry = await db.prepare(
      "INSERT INTO trip_entries (day_id, sort_order, start_time, title) VALUES (?, 100, '09:00', 'R-Attr-Entry') RETURNING id"
    ).bind(dayId).first<{ id: number }>();
    await db.batch([
      db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)').bind(entry!.id, masterPoi!.id),
      db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 2)').bind(entry!.id, altAttraction!.id),
    ]);

    const dayRow = await db.prepare(
      'SELECT day_num FROM trip_days WHERE id = ?'
    ).bind(dayId).first<{ day_num: number }>();
    const handler = (await import('../../functions/api/trips/[id]/days/[num]')).onRequestGet;
    const ctx = mockContext({
      request: new Request(`https://test.com/api/trips/${TRIP_ID}/days/${dayRow!.day_num}`),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, num: String(dayRow!.day_num) },
    });
    const resp = await callHandler(handler, ctx);
    const data = (await resp.json()) as { timeline: Array<{ id: number; alternates: Array<{ price?: string | null; reservation?: string | null }> }> };
    const me = data.timeline.find((e) => e.id === entry!.id);
    const alt = me!.alternates.find((a) => a.price !== undefined || a.reservation !== undefined) ?? me!.alternates[0];
    expect(alt!.price).toBeNull();
    expect(alt!.reservation).toBeNull();
  });
});

describe('POST /api/trips/:id/days/:num/entries — syncEntryMaster', () => {
  it('POST 新 entry → 自動 INSERT trip_entry_pois sort_order=1（multi-POI invariant）', async () => {
    const { onRequestPost: entriesPost } = await import(
      '../../functions/api/trips/[id]/days/[num]/entries'
    );
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/days/1/entries`,
        'POST',
        {
          title: 'SyncMasterEntry-1',
          time: '14:00',
          poi_type: 'attraction',
          rating: 4.0,
        },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, num: '1' },
    });
    const resp = await callHandler(entriesPost, ctx);
    expect(resp.status).toBe(201);
    const newEntry = (await resp.json()) as { id: number; poiId?: number; poi_id?: number };
    const newId = newEntry.id;
    expect(newId).toBeGreaterThan(0);

    // 驗證 trip_entry_pois 有 sort_order=1 row
    const row = await db
      .prepare(
        'SELECT poi_id, sort_order FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1',
      )
      .bind(newId)
      .first<{ poi_id: number; sort_order: number }>();
    expect(row).not.toBeNull();
    expect(row!.sort_order).toBe(1);
    expect(row!.poi_id).toBeGreaterThan(0);
    // v2.29.0: trip_entries.poi_id DROPPED — master 唯一來源是 trip_entry_pois sort_order=1。
  });

  it('migration 0078: POST 帶 note → 寫進 master trip_entry_pois.note（非 trip_entries）', async () => {
    const { onRequestPost: entriesPost } = await import(
      '../../functions/api/trips/[id]/days/[num]/entries'
    );
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/days/1/entries`,
        'POST',
        {
          title: 'PostNoteEntry',
          time: '15:00',
          poi_type: 'restaurant',
          note: '必點招牌拉麵',
        },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, num: '1' },
    });
    const resp = await callHandler(entriesPost, ctx);
    expect(resp.status).toBe(201);
    const newEntry = (await resp.json()) as { id: number };
    const master = await db
      .prepare('SELECT note FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1')
      .bind(newEntry.id)
      .first<{ note: string | null }>();
    expect(master!.note).toBe('必點招牌拉麵');
  });

  it('migration 0078: POST 帶亂碼 note → 400 DATA_ENCODING', async () => {
    const { onRequestPost: entriesPost } = await import(
      '../../functions/api/trips/[id]/days/[num]/entries'
    );
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/days/1/entries`,
        'POST',
        { title: 'PostGarbledNote', time: '16:00', poi_type: 'restaurant', note: '備註���亂碼' },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, num: '1' },
    });
    const resp = await callHandler(entriesPost, ctx);
    expect(resp.status).toBe(400);
    const body = (await resp.json()) as { error: { code: string } };
    expect(body.error.code).toBe('DATA_ENCODING');
  });
});

describe('POST /api/trips/:id/entries/:eid/copy — syncEntryMaster', () => {
  it('copy entry 到別天 → 新 entry 複製 canonical stopPois 順序', async () => {
    const { onRequestPost: copyPost } = await import(
      '../../functions/api/trips/[id]/entries/[eid]/copy'
    );
    const { entryId: srcEntryId, masterPoiId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'Copy-Master',
      altPoiNames: ['Copy-Alt'],
    });
    const targetDayId = await getDayId(db, TRIP_ID, 2);
    const ctx = mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${TRIP_ID}/entries/${srcEntryId}/copy`,
        'POST',
        { targetDayId },
      ),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(srcEntryId) },
    });
    const resp = await callHandler(copyPost, ctx);
    expect(resp.status).toBe(200);
    const newRow = (await resp.json()) as { id: number };
    expect(newRow.id).not.toBe(srcEntryId);

    const copiedRows = await db
      .prepare(
        'SELECT poi_id, sort_order FROM trip_entry_pois WHERE entry_id = ? ORDER BY sort_order',
      )
      .bind(newRow.id)
      .all<{ poi_id: number; sort_order: number }>();
    expect(copiedRows.results.map((row) => [row.poi_id, row.sort_order])).toEqual([
      [masterPoiId, 1],
      [altPoiIds[0], 2],
    ]);
  });
});

describe('Segment recompute trigger', () => {
  it('master swap → from/to segments marked stale', async () => {
    // 設 2 個 entries 在同 day + segment 連接
    const dayId = await getDayId(db, TRIP_ID, 1);
    const p1 = await seedPoi(db, { name: 'Seg-P1', type: 'attraction' });
    const p2 = await seedPoi(db, { name: 'Seg-P2', type: 'attraction' });
    const altP = await seedPoi(db, { name: 'Seg-Alt', type: 'attraction' });
    // v2.29.0: seedEntry({poiId}) 自動 INSERT trip_entry_pois sort_order=1，不必再 explicit INSERT master。
    const e1 = await seedEntry(db, dayId, { title: 'Seg-E1', poiId: p1 });
    const e2 = await seedEntry(db, dayId, { title: 'Seg-E2', poiId: p2, sortOrder: 2 });
    await db.batch([
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

// ============================================================================
// Round 4 pre-landing fixes — regression tests for newly-fixed bugs
// ============================================================================

describe('Round 4 — OCC monotonic across removeAlternate (Codex F2 fix)', () => {
  it('removeAlternate 後 version 不會 backward (trip_entries.updated_at monotonic)', async () => {
    const { entryId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'F2-Master',
      altPoiNames: ['F2-Alt-1', 'F2-Alt-2'],
    });

    // round 5 fix: OCC source is now trip_entries.entry_pois_version (integer counter).
    // Read before-version, removeAlternate, assert after-version > before-version.
    const before = await db
      .prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?')
      .bind(entryId)
      .first<{ v: number }>();

    await callHandler(alternateDelete, mockContext({
      request: jsonRequest(`https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates/${altPoiIds[1]}`, 'DELETE'),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId), poiId: String(altPoiIds[1]) },
    }));

    const after = await db
      .prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?')
      .bind(entryId)
      .first<{ v: number }>();
    // Monotonic counter: after > before, by exactly 1 (single mutation).
    expect(after!.v).toBeGreaterThan(before!.v);
    expect(after!.v).toBe(before!.v + 1);
  });
});

describe('Round 4 — Alternates CRUD OCC enforcement (Codex F3 fix)', () => {
  it('POST /alternates with stale entryPoisVersion → 409 STALE_ENTRY', async () => {
    const { entryId } = await seedEntryWithMaster({ poiName: 'F3-Master' });
    const newAltPoi = await seedPoi(db, { name: 'F3-NewAlt', type: 'attraction' });

    // round 5 fix: OCC is integer counter. Stale = a high number that's clearly past the current value.
    // Fresh entries start at 0 (DEFAULT) or 1 (after a setMaster/seed); '99999' is unambiguously stale.
    const resp = await callHandler(alternatesPost, mockContext({
      request: jsonRequest(`https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates`, 'POST', {
        poiId: newAltPoi,
        entryPoisVersion: '99999', // unambiguously stale (current is 0 or 1)
      }),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    }));
    expect(resp.status).toBe(409);
    const body = await resp.json() as { error: { code: string } };
    expect(body.error.code).toBe('STALE_ENTRY');
  });

  it('DELETE /alternates/:poiId?entryPoisVersion=stale → 409 STALE_ENTRY', async () => {
    const { entryId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'F3-DelMaster',
      altPoiNames: ['F3-DelAlt'],
    });
    const resp = await callHandler(alternateDelete, mockContext({
      request: jsonRequest(`https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates/${altPoiIds[0]}?entryPoisVersion=99999`, 'DELETE'),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId), poiId: String(altPoiIds[0]) },
    }));
    expect(resp.status).toBe(409);
    const body = await resp.json() as { error: { code: string } };
    expect(body.error.code).toBe('STALE_ENTRY');
  });

  it('PATCH /alternates/reorder with stale entryPoisVersion → 409 STALE_ENTRY', async () => {
    const { entryId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'F3-ReorderMaster',
      altPoiNames: ['F3-R-1', 'F3-R-2'],
    });
    const resp = await callHandler(reorderPatch, mockContext({
      request: jsonRequest(`https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/alternates/reorder`, 'PATCH', {
        order: [altPoiIds[1], altPoiIds[0]],
        entryPoisVersion: '99999',
      }),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    }));
    expect(resp.status).toBe(409);
    const body = await resp.json() as { error: { code: string } };
    expect(body.error.code).toBe('STALE_ENTRY');
  });
});

describe('Round 4 — PATCH /master accepts both body field names (A1 fix)', () => {
  it('body `entryPoisVersion` (canonical) works', async () => {
    const { entryId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'A1-canonical',
      altPoiNames: ['A1-canonical-alt'],
    });
    // round 5 fix: OCC source is trip_entries.entry_pois_version (integer counter)
    const v = await db.prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?')
      .bind(entryId)
      .first<{ v: number }>();
    const resp = await callHandler(masterPatch, mockContext({
      request: jsonRequest(`https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/master`, 'PATCH', {
        poiId: altPoiIds[0],
        entryPoisVersion: String(v!.v),
      }),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    }));
    expect(resp.status).toBe(200);
  });

  it('body legacy `version` still works (backwards compat)', async () => {
    const { entryId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'A1-legacy',
      altPoiNames: ['A1-legacy-alt'],
    });
    const v = await db.prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?')
      .bind(entryId)
      .first<{ v: number }>();
    const resp = await callHandler(masterPatch, mockContext({
      request: jsonRequest(`https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/master`, 'PATCH', {
        poiId: altPoiIds[0],
        version: String(v!.v),
      }),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    }));
    expect(resp.status).toBe(200);
  });
});

// Round 5 regression: cross-mutation OCC false-positive fix
// Round 4 made OCC source = trip_entries.updated_at; PATCH /entries note edit bumped that
// column and silently invalidated entryPoisVersion. Round 5 moved OCC to dedicated counter
// trip_entries.entry_pois_version which ONLY multi-POI helpers touch.
describe('Round 5 — entry_pois_version isolated from unrelated entry edits (cross-mutation fix)', () => {
  it('PATCH /entries note edit (real handler) does not invalidate entry_pois_version', async () => {
    // round 7 fix: 透過真實 PATCH /entries handler 而非 raw SQL — 若未來有人把
    // entry_pois_version 加入 ALLOWED_FIELDS（誤以為 client 需要 patch），raw SQL
    // test 不會 catch 但這 test 會。
    const { entryId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'R5-CrossMutation',
      altPoiNames: ['R5-Alt'],
    });
    const v0 = await db.prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?')
      .bind(entryId).first<{ v: number }>();

    // PATCH /entries via real handler — note + time edit 都該 NOT bump entry_pois_version
    const patchResp = await callHandler(entryPatch, mockContext({
      request: jsonRequest(`https://test.com/api/trips/${TRIP_ID}/entries/${entryId}`, 'PATCH', {
        note: '更新備註',
        start_time: '09:30',
        end_time: '11:00',
      }),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    }));
    expect(patchResp.status).toBe(200);

    const vAfter = await db.prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?')
      .bind(entryId).first<{ v: number }>();
    expect(vAfter!.v).toBe(v0!.v); // unchanged — round 5 invariant

    // setMaster with the original version should still succeed
    const resp = await callHandler(masterPatch, mockContext({
      request: jsonRequest(`https://test.com/api/trips/${TRIP_ID}/entries/${entryId}/master`, 'PATCH', {
        poiId: altPoiIds[0],
        entryPoisVersion: String(v0!.v),
      }),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    }));
    expect(resp.status).toBe(200);
  });

  it('PATCH /entries body 不接受 entry_pois_version (mass assignment 防護)', async () => {
    // round 7 fix: 確認 ALLOWED_FIELDS whitelist 排除 entry_pois_version，
    // attacker / buggy client 送 body 帶 entry_pois_version: 99999 不該影響 column。
    const { entryId } = await seedEntryWithMaster({
      poiName: 'R7-MassAssign',
      altPoiNames: [],
    });
    const v0 = await db.prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?')
      .bind(entryId).first<{ v: number }>();

    await callHandler(entryPatch, mockContext({
      request: jsonRequest(`https://test.com/api/trips/${TRIP_ID}/entries/${entryId}`, 'PATCH', {
        note: 'ok',
        // injection attempt — should be silently dropped by ALLOWED_FIELDS filter
        entry_pois_version: 99999,
        entryPoisVersion: 99999,
      }),
      env,
      auth: mockAuth({ email: USER_EMAIL }),
      params: { id: TRIP_ID, eid: String(entryId) },
    }));

    const vAfter = await db.prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?')
      .bind(entryId).first<{ v: number }>();
    expect(vAfter!.v).toBe(v0!.v);
  });
});

// migration 0078 — syncEntryMaster 可選 note 參數（給 entry-create 路徑把 entry-level note
// 寫進新 master 的 per-POI note）。只作用於 INSERT(new master) 分支；既有呼叫端不傳 → 維持現狀。
describe('migration 0078 — syncEntryMaster optional note 參數', () => {
  it('INSERT 新 master 時帶 note → 寫進 trip_entry_pois.note', async () => {
    const { syncEntryMaster } = await import('../../functions/api/_entry_pois');
    const trip = await seedTrip(db, { id: 'm78-sync-note-insert' });
    const dayId = await getDayId(db, trip.id, 1);
    const poi = await db.prepare("INSERT INTO pois (name, type) VALUES ('M78-INS', 'attraction') RETURNING id").first<{ id: number }>();
    const entry = await db.prepare("INSERT INTO trip_entries (day_id, sort_order, start_time, title) VALUES (?, 1, '10:00', 'M78-INS') RETURNING id").bind(dayId).first<{ id: number }>();

    await syncEntryMaster(db, entry!.id, poi!.id, '整體備註注入 master');

    const row = await db.prepare('SELECT note, sort_order FROM trip_entry_pois WHERE entry_id = ?').bind(entry!.id).first<{ note: string | null; sort_order: number }>();
    expect(row!.sort_order).toBe(1);
    expect(row!.note).toBe('整體備註注入 master');
  });

  it('不傳 note（既有呼叫端）→ master.note 維持 NULL（向後相容）', async () => {
    const { syncEntryMaster } = await import('../../functions/api/_entry_pois');
    const trip = await seedTrip(db, { id: 'm78-sync-note-omit' });
    const dayId = await getDayId(db, trip.id, 1);
    const poi = await db.prepare("INSERT INTO pois (name, type) VALUES ('M78-OMIT', 'attraction') RETURNING id").first<{ id: number }>();
    const entry = await db.prepare("INSERT INTO trip_entries (day_id, sort_order, start_time, title) VALUES (?, 1, '10:00', 'M78-OMIT') RETURNING id").bind(dayId).first<{ id: number }>();

    await syncEntryMaster(db, entry!.id, poi!.id);

    const row = await db.prepare('SELECT note FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1').bind(entry!.id).first<{ note: string | null }>();
    expect(row!.note).toBeNull();
  });

  it('note 為 null 顯式傳入 → master.note NULL（不炸）', async () => {
    const { syncEntryMaster } = await import('../../functions/api/_entry_pois');
    const trip = await seedTrip(db, { id: 'm78-sync-note-null' });
    const dayId = await getDayId(db, trip.id, 1);
    const poi = await db.prepare("INSERT INTO pois (name, type) VALUES ('M78-NULL', 'attraction') RETURNING id").first<{ id: number }>();
    const entry = await db.prepare("INSERT INTO trip_entries (day_id, sort_order, start_time, title) VALUES (?, 1, '10:00', 'M78-NULL') RETURNING id").bind(dayId).first<{ id: number }>();

    await syncEntryMaster(db, entry!.id, poi!.id, null);

    const row = await db.prepare('SELECT note FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1').bind(entry!.id).first<{ note: string | null }>();
    expect(row!.note).toBeNull();
  });
});

// Round 9 — syncEntryMaster INSERT + naked UPDATE 各自 bump entry_pois_version 的 regression。
// Round 7 修了這兩條 path 加 bump，但既有 syncEntryMaster test 只走 setMaster collision route。
describe('Round 9 — syncEntryMaster INSERT/naked UPDATE bump entry_pois_version', () => {
  it('INSERT path (entry 沒 trip_entry_pois row) → bump version', async () => {
    const { syncEntryMaster } = await import('../../functions/api/_entry_pois');
    const trip = await seedTrip(db, { id: 'r9-sync-insert' });
    const dayId = await getDayId(db, trip.id, 1);
    const poi = await db.prepare("INSERT INTO pois (name, type) VALUES ('R9-INS-POI', 'attraction') RETURNING id").first<{ id: number }>();
    // 故意建 entry 後不 INSERT trip_entry_pois，模擬 entry-create 中間狀態
    // v2.29.0: trip_entries.{time, poi_id} DROPPED. 用 start_time 寫 schedule。
    const entry = await db.prepare("INSERT INTO trip_entries (day_id, sort_order, start_time, title) VALUES (?, 1, '10:00', 'R9-INS') RETURNING id").bind(dayId).first<{ id: number }>();
    const v0 = await db.prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?').bind(entry!.id).first<{ v: number }>();

    await syncEntryMaster(db, entry!.id, poi!.id);

    const v1 = await db.prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?').bind(entry!.id).first<{ v: number }>();
    expect(v1!.v).toBe(v0!.v + 1);
    const row = await db.prepare('SELECT poi_id, sort_order FROM trip_entry_pois WHERE entry_id = ?').bind(entry!.id).first<{ poi_id: number; sort_order: number }>();
    expect(row!.sort_order).toBe(1);
    expect(row!.poi_id).toBe(poi!.id);
  });

  it('naked UPDATE path (master 已存在 + new poiId 不是 alternate) → bump version', async () => {
    const { syncEntryMaster } = await import('../../functions/api/_entry_pois');
    const trip = await seedTrip(db, { id: 'r9-sync-update' });
    const dayId = await getDayId(db, trip.id, 1);
    const poiOld = await db.prepare("INSERT INTO pois (name, type) VALUES ('R9-OldMaster', 'attraction') RETURNING id").first<{ id: number }>();
    const poiNew = await db.prepare("INSERT INTO pois (name, type) VALUES ('R9-NewMaster', 'attraction') RETURNING id").first<{ id: number }>();
    // v2.29.0: trip_entries.{time, poi_id} DROPPED. 用 start_time + trip_entry_pois 寫 master。
    const entry = await db.prepare("INSERT INTO trip_entries (day_id, sort_order, start_time, title) VALUES (?, 1, '11:00', 'R9-UPD') RETURNING id").bind(dayId).first<{ id: number }>();
    await db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)').bind(entry!.id, poiOld!.id).run();
    const v0 = await db.prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?').bind(entry!.id).first<{ v: number }>();

    await syncEntryMaster(db, entry!.id, poiNew!.id);

    const v1 = await db.prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?').bind(entry!.id).first<{ v: number }>();
    expect(v1!.v).toBe(v0!.v + 1);
    const row = await db.prepare('SELECT poi_id FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1').bind(entry!.id).first<{ poi_id: number }>();
    expect(row!.poi_id).toBe(poiNew!.id);
  });

  it('no-op path (poiId 跟既有 master 相同) → 不 bump version', async () => {
    const { syncEntryMaster } = await import('../../functions/api/_entry_pois');
    const trip = await seedTrip(db, { id: 'r9-sync-noop' });
    const dayId = await getDayId(db, trip.id, 1);
    const poi = await db.prepare("INSERT INTO pois (name, type) VALUES ('R9-NoOp', 'attraction') RETURNING id").first<{ id: number }>();
    // v2.29.0: trip_entries.{time, poi_id} DROPPED. 用 start_time + trip_entry_pois 寫 master。
    const entry = await db.prepare("INSERT INTO trip_entries (day_id, sort_order, start_time, title) VALUES (?, 1, '12:00', 'R9-NoOp') RETURNING id").bind(dayId).first<{ id: number }>();
    await db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)').bind(entry!.id, poi!.id).run();
    const v0 = await db.prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?').bind(entry!.id).first<{ v: number }>();

    await syncEntryMaster(db, entry!.id, poi!.id);

    const v1 = await db.prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?').bind(entry!.id).first<{ v: number }>();
    expect(v1!.v).toBe(v0!.v); // unchanged
  });
});

describe('Round 4 — syncEntryMaster routes UNIQUE collision to setMaster (adv-C4 fix)', () => {
  it('syncEntryMaster when poiId is already alternate → master↔alt swap (not UNIQUE 500)', async () => {
    const { entryId, masterPoiId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'C4-Master',
      altPoiNames: ['C4-Alt'],
    });
    // Simulate a PUT /days/:num flow: caller wants to make C4-Alt the master for this entry
    // (previously this would crash with UNIQUE(entry_id, poi_id) because C4-Alt was already an alternate).
    const { syncEntryMaster } = await import('../../functions/api/_entry_pois');
    await syncEntryMaster(db, entryId, altPoiIds[0]!);

    // Verify the swap happened: C4-Alt is now master (sort_order=1), C4-Master is alternate
    const rows = await db
      .prepare('SELECT poi_id, sort_order FROM trip_entry_pois WHERE entry_id = ? ORDER BY sort_order')
      .bind(entryId)
      .all<{ poi_id: number; sort_order: number }>();
    expect(rows.results.length).toBe(2);
    expect(rows.results[0]).toMatchObject({ poi_id: altPoiIds[0], sort_order: 1 });
    expect(rows.results[1]!.poi_id).toBe(masterPoiId);
  });
});

// =============================================================================
// PATCH /api/trips/:id/entries/:eid/pois/:poiId — per-POI 備註（取代 entry-level note）
// migration 0078 cutover：master(sort_order=1) 或 alternate(sort_order>1) 各自可編輯 note。
// =============================================================================
describe('PATCH /pois/:poiId — per-POI note', () => {
  function noteCtx(opts: {
    entryId: number;
    poiId: number;
    body: unknown;
    email?: string;
    tripId?: string;
  }) {
    const tripId = opts.tripId ?? TRIP_ID;
    return mockContext({
      request: jsonRequest(
        `https://test.com/api/trips/${tripId}/entries/${opts.entryId}/pois/${opts.poiId}`,
        'PATCH',
        opts.body,
      ),
      env,
      auth: opts.email === undefined ? undefined : mockAuth({ email: opts.email }),
      params: { id: tripId, eid: String(opts.entryId), poiId: String(opts.poiId) },
    });
  }

  async function readNote(entryId: number, poiId: number): Promise<string | null> {
    const row = await db
      .prepare('SELECT note FROM trip_entry_pois WHERE entry_id = ? AND poi_id = ?')
      .bind(entryId, poiId)
      .first<{ note: string | null }>();
    return row ? row.note : null;
  }

  it('成功更新 master(sort_order=1) note → 200 + DB 寫入', async () => {
    const { entryId, masterPoiId } = await seedEntryWithMaster({ poiName: 'PN-Master' });
    const resp = await callHandler(
      poiNotePatch,
      noteCtx({ entryId, poiId: masterPoiId, body: { note: '必點山苦瓜炒麵' }, email: USER_EMAIL }),
    );
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { entryId: number; poiId: number; note: string };
    expect(body.poiId).toBe(masterPoiId);
    expect(body.note).toBe('必點山苦瓜炒麵');
    expect(await readNote(entryId, masterPoiId)).toBe('必點山苦瓜炒麵');
  });

  it('成功更新 alternate(sort_order>1) note → 200', async () => {
    const { entryId, altPoiIds } = await seedEntryWithMaster({
      poiName: 'PN-AltMaster',
      altPoiNames: ['PN-Alt-1'],
    });
    const resp = await callHandler(
      poiNotePatch,
      noteCtx({ entryId, poiId: altPoiIds[0]!, body: { note: '週三休息' }, email: USER_EMAIL }),
    );
    expect(resp.status).toBe(200);
    expect(await readNote(entryId, altPoiIds[0]!)).toBe('週三休息');
  });

  it('note 純空白 → 寫 null（清除）', async () => {
    const { entryId, masterPoiId } = await seedEntryWithMaster({ poiName: 'PN-Blank' });
    // 先寫一個值
    await db.prepare('UPDATE trip_entry_pois SET note = ? WHERE entry_id = ? AND poi_id = ?')
      .bind('舊備註', entryId, masterPoiId).run();
    const resp = await callHandler(
      poiNotePatch,
      noteCtx({ entryId, poiId: masterPoiId, body: { note: '   ' }, email: USER_EMAIL }),
    );
    expect(resp.status).toBe(200);
    expect(await readNote(entryId, masterPoiId)).toBeNull();
  });

  it('note = null → 寫 null', async () => {
    const { entryId, masterPoiId } = await seedEntryWithMaster({ poiName: 'PN-Null' });
    await db.prepare('UPDATE trip_entry_pois SET note = ? WHERE entry_id = ? AND poi_id = ?')
      .bind('舊備註', entryId, masterPoiId).run();
    const resp = await callHandler(
      poiNotePatch,
      noteCtx({ entryId, poiId: masterPoiId, body: { note: null }, email: USER_EMAIL }),
    );
    expect(resp.status).toBe(200);
    expect(await readNote(entryId, masterPoiId)).toBeNull();
  });

  it('亂碼（U+FFFD）→ 400 DATA_ENCODING', async () => {
    const { entryId, masterPoiId } = await seedEntryWithMaster({ poiName: 'PN-Garbled' });
    const resp = await callHandler(
      poiNotePatch,
      noteCtx({ entryId, poiId: masterPoiId, body: { note: '備註���' }, email: USER_EMAIL }),
    );
    expect(resp.status).toBe(400);
    const body = (await resp.json()) as { error: { code: string } };
    expect(body.error.code).toBe('DATA_ENCODING');
  });

  it('note 超過 1000 字 → 400 DATA_VALIDATION', async () => {
    const { entryId, masterPoiId } = await seedEntryWithMaster({ poiName: 'PN-TooLong' });
    const resp = await callHandler(
      poiNotePatch,
      noteCtx({ entryId, poiId: masterPoiId, body: { note: 'あ'.repeat(1001) }, email: USER_EMAIL }),
    );
    expect(resp.status).toBe(400);
    const body = (await resp.json()) as { error: { code: string } };
    expect(body.error.code).toBe('DATA_VALIDATION');
  });

  it('缺 note 欄位 → 400 DATA_VALIDATION', async () => {
    const { entryId, masterPoiId } = await seedEntryWithMaster({ poiName: 'PN-MissingField' });
    const resp = await callHandler(
      poiNotePatch,
      noteCtx({ entryId, poiId: masterPoiId, body: {}, email: USER_EMAIL }),
    );
    expect(resp.status).toBe(400);
    const body = (await resp.json()) as { error: { code: string } };
    expect(body.error.code).toBe('DATA_VALIDATION');
  });

  it('note 非 string|null（number）→ 400 DATA_VALIDATION', async () => {
    const { entryId, masterPoiId } = await seedEntryWithMaster({ poiName: 'PN-WrongType' });
    const resp = await callHandler(
      poiNotePatch,
      noteCtx({ entryId, poiId: masterPoiId, body: { note: 123 }, email: USER_EMAIL }),
    );
    expect(resp.status).toBe(400);
    const body = (await resp.json()) as { error: { code: string } };
    expect(body.error.code).toBe('DATA_VALIDATION');
  });

  it('poiId 不屬於該 entry → 404 DATA_NOT_FOUND', async () => {
    const { entryId } = await seedEntryWithMaster({ poiName: 'PN-NotInEntry' });
    const strayPoi = await seedPoi(db, { name: 'PN-Stray', type: 'attraction' });
    const resp = await callHandler(
      poiNotePatch,
      noteCtx({ entryId, poiId: strayPoi, body: { note: '不該成功' }, email: USER_EMAIL }),
    );
    expect(resp.status).toBe(404);
    const body = (await resp.json()) as { error: { code: string } };
    expect(body.error.code).toBe('DATA_NOT_FOUND');
  });

  it('未認證 → 401 AUTH_REQUIRED', async () => {
    const { entryId, masterPoiId } = await seedEntryWithMaster({ poiName: 'PN-NoAuth' });
    const resp = await callHandler(
      poiNotePatch,
      noteCtx({ entryId, poiId: masterPoiId, body: { note: 'x' } }), // email undefined → no auth
    );
    expect(resp.status).toBe(401);
  });

  it('無 write 權限（陌生人）→ 403 PERM_DENIED', async () => {
    const { entryId, masterPoiId } = await seedEntryWithMaster({ poiName: 'PN-Stranger' });
    const resp = await callHandler(
      poiNotePatch,
      noteCtx({ entryId, poiId: masterPoiId, body: { note: 'x' }, email: 'stranger@test.com' }),
    );
    expect(resp.status).toBe(403);
    const body = (await resp.json()) as { error: { code: string } };
    expect(body.error.code).toBe('PERM_DENIED');
  });

  it('cross-trip：URL trip 與 entry 所屬 trip 不符 → 404 DATA_NOT_FOUND', async () => {
    const { entryId, masterPoiId } = await seedEntryWithMaster({ poiName: 'PN-CrossTrip' });
    // 另開一個 trip，owner 同 USER_EMAIL（有 write 權限），但 entry 屬於 TRIP_ID。
    const otherTrip = 'trip-ep-other-note';
    await seedTrip(db, { id: otherTrip, owner: USER_EMAIL });
    const resp = await callHandler(
      poiNotePatch,
      noteCtx({ entryId, poiId: masterPoiId, body: { note: 'x' }, email: USER_EMAIL, tripId: otherTrip }),
    );
    expect(resp.status).toBe(404);
    const body = (await resp.json()) as { error: { code: string } };
    expect(body.error.code).toBe('DATA_NOT_FOUND');
  });

  it('回歸：note 編輯不 bump entry_pois_version（LWW，不誤殺 swap token）', async () => {
    const { entryId, masterPoiId } = await seedEntryWithMaster({ poiName: 'PN-NoVersionBump' });
    const before = await db
      .prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?')
      .bind(entryId)
      .first<{ v: number }>();
    const resp = await callHandler(
      poiNotePatch,
      noteCtx({ entryId, poiId: masterPoiId, body: { note: '不該 bump version' }, email: USER_EMAIL }),
    );
    expect(resp.status).toBe(200);
    const after = await db
      .prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?')
      .bind(entryId)
      .first<{ v: number }>();
    expect(after!.v).toBe(before!.v); // 不變
  });

  it('updated_at 被更新（trip_entry_pois.updated_at 推進）', async () => {
    const { entryId, masterPoiId } = await seedEntryWithMaster({ poiName: 'PN-UpdatedAt' });
    // 先把 updated_at 設成過去值
    await db.prepare("UPDATE trip_entry_pois SET updated_at = '2000-01-01T00:00:00.000Z' WHERE entry_id = ? AND poi_id = ?")
      .bind(entryId, masterPoiId).run();
    const resp = await callHandler(
      poiNotePatch,
      noteCtx({ entryId, poiId: masterPoiId, body: { note: 'x' }, email: USER_EMAIL }),
    );
    expect(resp.status).toBe(200);
    const row = await db
      .prepare('SELECT updated_at FROM trip_entry_pois WHERE entry_id = ? AND poi_id = ?')
      .bind(entryId, masterPoiId)
      .first<{ updated_at: string }>();
    expect(row!.updated_at > '2000-01-01T00:00:00.000Z').toBe(true);
  });
});
