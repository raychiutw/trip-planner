/**
 * Integration test — GET/PUT /api/trips/:id/days/:num
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedTrip, getDayId , callHandler } from './helpers';
import { onRequestGet, onRequestPut } from '../../functions/api/trips/[id]/days/[num]';
import { onRequestPost as onRequestPostEntry } from '../../functions/api/trips/[id]/days/[num]/entries';
import { onRequestPatch as onRequestPatchEntry } from '../../functions/api/trips/[id]/entries/[eid]';
import { onRequestPut as onRequestPutPoiId } from '../../functions/api/trips/[id]/entries/[eid]/poi-id';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedTrip(db, { id: 'trip-dn', days: 3 });
});

afterAll(disposeMiniflare);

describe('GET /api/trips/:id/days/:num', () => {
  it('取得完整一天資料', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-dn/days/1'),
      env,
      params: { id: 'trip-dn', num: '1' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Record<string, unknown>;
    expect(data.dayNum).toBe(1);
    expect(data.timeline).toBeDefined();
  });

  it('不存在的天 → 404', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-dn/days/99'),
      env,
      params: { id: 'trip-dn', num: '99' },
    });
    expect((await callHandler(onRequestGet, ctx)).status).toBe(404);
  });
});

describe('PUT /api/trips/:id/days/:num', () => {
  it('覆寫整天 + 建立 entry + find-or-create POI → 200', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-dn/days/1', 'PUT', {
        date: '2026-04-01',
        dayOfWeek: '三',
        label: 'Day 1',
        timeline: [
          {
            time: '09:00',
            title: '首里城',
            description: '世界遺產',
            restaurants: [
              { name: 'すし三昧', type: 'restaurant', context: 'timeline' },
            ],
          },
          {
            time: '12:00',
            title: '國際通',
            travel: { type: 'car', desc: '車程', min: 20 },
          },
        ],
        hotel: {
          name: 'ホテルオリオン',
          checkout: '11:00',
        },
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-dn', num: '1' },
    });
    const resp = await callHandler(onRequestPut, ctx);
    expect(resp.status).toBe(200);

    // 驗證 entries 已建立
    const dayId = await getDayId(db, 'trip-dn', 1);
    const entries = await db.prepare(
      'SELECT * FROM trip_entries WHERE day_id = ? ORDER BY sort_order'
    ).bind(dayId).all();
    expect(entries.results).toHaveLength(2);
    expect((entries.results[0] as Record<string, unknown>).title).toBe('首里城');

    // 驗證 hotel POI 已建立
    const hotelPoi = await db.prepare(
      "SELECT * FROM pois WHERE name = 'ホテルオリオン' AND type = 'hotel'"
    ).first();
    expect(hotelPoi).not.toBeNull();

    // 驗證 trip_pois 有 hotel context
    const hotelTp = await db.prepare(
      "SELECT * FROM trip_pois WHERE trip_id = 'trip-dn' AND context = 'hotel' AND day_id = ?"
    ).bind(dayId).first();
    expect(hotelTp).not.toBeNull();
  });

  it('缺 date → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-dn/days/1', 'PUT', {
        dayOfWeek: '三',
        label: 'x',
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-dn', num: '1' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(400);
  });

  it('未認證 → 401', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-dn/days/1', 'PUT', {
        date: '2026-04-01', dayOfWeek: '三', label: 'x',
      }),
      env,
      params: { id: 'trip-dn', num: '1' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(401);
  });

  it('無權限 → 403', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-dn/days/1', 'PUT', {
        date: '2026-04-01', dayOfWeek: '三', label: 'x',
      }),
      env,
      auth: mockAuth({ email: 'stranger@test.com' }),
      params: { id: 'trip-dn', num: '1' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(403);
  });

  it('亂碼偵測 → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-dn/days/2', 'PUT', {
        date: '2026-04-02', dayOfWeek: '四', label: 'Day 2',
        timeline: [{ time: '10:00', title: 'test\uFFFDgarbled' }],
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-dn', num: '2' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(400);
  });

  /* Phase 2 POI Unification (v2.1.2.0+) */
  it('Phase 2: entry with maps + poi_type → 寫入 trip_entries.poi_id + pois master', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-dn/days/3', 'PUT', {
        date: '2026-04-03', dayOfWeek: '五', label: 'Day 3',
        timeline: [
          {
            time: '09:00',
            title: '那覇空港',
            poi_type: 'transport',
            // Migration 0045: maps dropped, google_rating renamed to rating.
            rating: 4.2,
          },
          {
            time: '12:00',
            title: '首里城',
            maps: 'https://www.google.com/maps/search/首里城',
          },
        ],
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-dn', num: '3' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(200);

    const dayId = await getDayId(db, 'trip-dn', 3);
    const entries = await db.prepare(
      'SELECT id, title, poi_id FROM trip_entries WHERE day_id = ? ORDER BY sort_order',
    ).bind(dayId).all();
    expect(entries.results).toHaveLength(2);
    for (const e of entries.results as Array<{ poi_id: number | null }>) {
      expect(e.poi_id).not.toBeNull();
    }

    // Migration 0045: pois.maps dropped (use mapsUrl helper); google_rating renamed to rating.
    const transportPoi = await db.prepare(
      "SELECT id, rating FROM pois WHERE name = '那覇空港' AND type = 'transport'",
    ).first() as { id: number; rating: number } | null;
    expect(transportPoi).not.toBeNull();
    expect(transportPoi!.rating).toBe(4.2);

    const attractionPoi = await db.prepare(
      "SELECT id FROM pois WHERE name = '首里城' AND type = 'attraction'",
    ).first();
    expect(attractionPoi).not.toBeNull();
  });

  it('Phase 2: GET /days/:num 回傳 entry.poi JOIN 物件', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/trips/trip-dn/days/3'),
      env,
      params: { id: 'trip-dn', num: '3' },
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as { timeline: Array<{ title: string; poi: { type: string } | null }> };
    const transportEntry = data.timeline.find((e) => e.title === '那覇空港');
    expect(transportEntry).toBeDefined();
    expect(transportEntry!.poi).not.toBeNull();
    expect(transportEntry!.poi!.type).toBe('transport');
    // Migration 0045: poi.maps dropped (use mapsUrl helper to render Google/Apple/Naver URLs).
  });

  it('Phase 2: POST /entries 建立 POI 並回填 poi_id', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-dn/days/2/entries', 'POST', {
        title: '美麗海水族館',
        time: '10:00',
        poi_type: 'attraction',
        // Migration 0045: maps dropped, google_rating renamed to rating.
        rating: 4.5,
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-dn', num: '2' },
    });
    const resp = await callHandler(onRequestPostEntry, ctx);
    expect(resp.status).toBe(201);
    const row = await resp.json() as { id: number; poiId: number; title: string };
    expect(row.poiId).not.toBeNull();
    expect(row.poiId).toBeGreaterThan(0);

    const poi = await db.prepare("SELECT type, name FROM pois WHERE id = ?").bind(row.poiId).first() as { type: string; name: string };
    expect(poi.type).toBe('attraction');
    expect(poi.name).toBe('美麗海水族館');
  });

  it('Phase 2: PATCH /entries/:eid 不接受 poi_id（避免跨 trip 指向）', async () => {
    const dayId = await getDayId(db, 'trip-dn', 3);
    const entry = await db.prepare(
      'SELECT id, poi_id FROM trip_entries WHERE day_id = ? ORDER BY sort_order LIMIT 1',
    ).bind(dayId).first() as { id: number; poi_id: number };
    const originalPoiId = entry.poi_id;

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-dn/entries/${entry.id}`, 'PATCH', {
        poi_id: 99999,
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-dn', eid: String(entry.id) },
    });
    // poi_id 不在 ALLOWED_FIELDS，PATCH 視為沒有有效欄位 → 400
    expect((await callHandler(onRequestPatchEntry, ctx)).status).toBe(400);

    // poi_id 保持原值未被改動
    const row = await db.prepare('SELECT poi_id FROM trip_entries WHERE id = ?').bind(entry.id).first() as { poi_id: number };
    expect(row.poi_id).toBe(originalPoiId);
  });

  it('Phase 2: PUT /days/:num 拒絕非法 poi_type → 400', async () => {
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/trips/trip-dn/days/2', 'PUT', {
        date: '2026-04-02', dayOfWeek: '四', label: 'Day 2',
        timeline: [{ time: '10:00', title: 'bad type', poi_type: 'invalid_type' }],
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-dn', num: '2' },
    });
    expect((await callHandler(onRequestPut, ctx)).status).toBe(400);
  });

  it('Phase 2: PUT /entries/:eid/poi-id 重掛到既有 POI（驗證存在）', async () => {
    const dayId = await getDayId(db, 'trip-dn', 3);
    const entry = await db.prepare(
      'SELECT id, poi_id FROM trip_entries WHERE day_id = ? ORDER BY sort_order LIMIT 1',
    ).bind(dayId).first() as { id: number; poi_id: number };

    const newPoi = await db.prepare(
      "INSERT INTO pois (type, name, source) VALUES ('attraction', 'Admin Override POI', 'test') RETURNING id",
    ).first() as { id: number };

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-dn/entries/${entry.id}/poi-id`, 'PUT', {
        poi_id: newPoi.id,
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-dn', eid: String(entry.id) },
    });
    const resp = await callHandler(onRequestPutPoiId, ctx);
    expect(resp.status).toBe(200);

    const row = await db.prepare('SELECT poi_id FROM trip_entries WHERE id = ?').bind(entry.id).first() as { poi_id: number };
    expect(row.poi_id).toBe(newPoi.id);
  });

  it('Phase 2: PUT /entries/:eid/poi-id 拒絕不存在的 poi_id → 404', async () => {
    const dayId = await getDayId(db, 'trip-dn', 3);
    const entry = await db.prepare(
      'SELECT id FROM trip_entries WHERE day_id = ? ORDER BY sort_order LIMIT 1',
    ).bind(dayId).first() as { id: number };

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-dn/entries/${entry.id}/poi-id`, 'PUT', {
        poi_id: 99999,
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-dn', eid: String(entry.id) },
    });
    expect((await callHandler(onRequestPutPoiId, ctx)).status).toBe(404);
  });

  it('v2.27.0: PUT /entries/:eid/poi-id 阻擋 null 清空（per multi-POI invariant，要用 DELETE entry）', async () => {
    // v2.27.0 起每 entry 至少要有 1 master POI（trip_entry_pois sort_order=1 invariant）。
    // 清空 master 的正確路徑是 DELETE /entries/:eid 刪整個 entry，不是 PUT /poi-id null。
    // pre-v2.27.0 此分支事實上 unreachable（frontend 沒地方傳 null），現在 explicit 阻擋。
    const dayId = await getDayId(db, 'trip-dn', 3);
    const entry = await db.prepare(
      'SELECT id, poi_id FROM trip_entries WHERE day_id = ? ORDER BY sort_order LIMIT 1',
    ).bind(dayId).first() as { id: number; poi_id: number | null };

    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/trip-dn/entries/${entry.id}/poi-id`, 'PUT', {
        poi_id: null,
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: 'trip-dn', eid: String(entry.id) },
    });
    expect((await callHandler(onRequestPutPoiId, ctx)).status).toBe(400);
    // entry.poi_id 不變
    const row = await db.prepare('SELECT poi_id FROM trip_entries WHERE id = ?').bind(entry.id).first() as { poi_id: number | null };
    expect(row.poi_id).toBe(entry.poi_id);
  });
});

// Round 4 fix adv-C5 / Codex F4 regression: PUT /days/:num batch1 DELETE FROM
// trip_entries cascades trip_entry_pois rows (FK ON DELETE CASCADE). Without the
// preservation snapshot+restore, every PUT silently destroyed all alternates.
describe('PUT /api/trips/:id/days/:num — v2.27.0 alternates preservation', () => {
  it('保留 alternates：當新 timeline entry 的 master POI 跟舊 entry 同 → alternates 還在', async () => {
    const TRIP = 'trip-dn-alt';
    await seedTrip(db, { id: TRIP, days: 1 });
    const dayId = await getDayId(db, TRIP, 1);

    // Seed: 1 entry with master "Master-X" + 2 alternates "Alt-A", "Alt-B"
    const masterPoi = await db
      .prepare("INSERT INTO pois (name, type) VALUES ('Master-X', 'attraction') RETURNING id")
      .first<{ id: number }>();
    const altA = await db
      .prepare("INSERT INTO pois (name, type) VALUES ('Alt-A', 'attraction') RETURNING id")
      .first<{ id: number }>();
    const altB = await db
      .prepare("INSERT INTO pois (name, type) VALUES ('Alt-B', 'attraction') RETURNING id")
      .first<{ id: number }>();
    const entry = await db
      .prepare("INSERT INTO trip_entries (day_id, sort_order, time, title, poi_id) VALUES (?, 1, '10:00', 'Master-X', ?) RETURNING id")
      .bind(dayId, masterPoi!.id)
      .first<{ id: number }>();
    await db.batch([
      db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)').bind(entry!.id, masterPoi!.id),
      db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 2)').bind(entry!.id, altA!.id),
      db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 3)').bind(entry!.id, altB!.id),
    ]);

    // Sanity: 3 trip_entry_pois rows for this entry
    const before = await db
      .prepare('SELECT COUNT(*) AS c FROM trip_entry_pois WHERE entry_id = ?')
      .bind(entry!.id)
      .first<{ c: number }>();
    expect(before!.c).toBe(3);

    // PUT /days/:num with same master POI title (find-or-create resolves to same row)
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/${TRIP}/days/1`, 'PUT', {
        date: '2026-05-12',
        dayOfWeek: '二',
        label: 'Updated',
        timeline: [
          { time: '11:00', title: 'Master-X', poi_type: 'attraction' },
        ],
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: TRIP, num: '1' },
    });
    const resp = await callHandler(onRequestPut, ctx);
    expect(resp.status).toBe(200);

    // Verify: alternates Alt-A + Alt-B restored
    const newEntry = await db
      .prepare('SELECT id FROM trip_entries WHERE day_id = ? ORDER BY sort_order LIMIT 1')
      .bind(dayId)
      .first<{ id: number }>();
    const rows = await db
      .prepare('SELECT poi_id, sort_order FROM trip_entry_pois WHERE entry_id = ? ORDER BY sort_order')
      .bind(newEntry!.id)
      .all<{ poi_id: number; sort_order: number }>();
    expect(rows.results.length).toBe(3);
    expect(rows.results[0]!.sort_order).toBe(1);
    expect(rows.results[0]!.poi_id).toBe(masterPoi!.id);
    const altPoiIds = rows.results.slice(1).map((r) => r.poi_id).sort();
    expect(altPoiIds).toEqual([altA!.id, altB!.id].sort());
  });

  // Round 5 regression — adversarial round 6 #1 + testing P0 #1:
  // 兩 OLD entries 共享同 master POI（例如「松屋」連續兩餐），各自有不同 alternates。
  // Round 4 的「key by master_poi_id」snapshot 策略會 collapse 兩個 snapshot 進同 key，
  // 重排後其中一個 entry 拿到對方的 alternates，另一個拿空。
  // Round 5 fix：per-OLD-entry snapshot + claim-once mapping，保證 entry order 對齊。
  it('保留 alternates：兩 entries 共享相同 master POI 時，各自 alternates 不互換', async () => {
    const TRIP = 'trip-dn-alt-shared';
    await seedTrip(db, { id: TRIP, days: 1 });
    const dayId = await getDayId(db, TRIP, 1);

    // Seed: master 共享 "Matsuya"，entry-1 有 alts [Alt-A, Alt-B]，entry-2 有 alts [Alt-C, Alt-D]
    const sharedMaster = await db
      .prepare("INSERT INTO pois (name, type) VALUES ('Matsuya', 'restaurant') RETURNING id")
      .first<{ id: number }>();
    const altA = await db
      .prepare("INSERT INTO pois (name, type) VALUES ('Alt-A', 'restaurant') RETURNING id")
      .first<{ id: number }>();
    const altB = await db
      .prepare("INSERT INTO pois (name, type) VALUES ('Alt-B', 'restaurant') RETURNING id")
      .first<{ id: number }>();
    const altC = await db
      .prepare("INSERT INTO pois (name, type) VALUES ('Alt-C', 'restaurant') RETURNING id")
      .first<{ id: number }>();
    const altD = await db
      .prepare("INSERT INTO pois (name, type) VALUES ('Alt-D', 'restaurant') RETURNING id")
      .first<{ id: number }>();

    const entry1 = await db
      .prepare("INSERT INTO trip_entries (day_id, sort_order, time, title, poi_id) VALUES (?, 1, '08:00', 'Matsuya', ?) RETURNING id")
      .bind(dayId, sharedMaster!.id)
      .first<{ id: number }>();
    const entry2 = await db
      .prepare("INSERT INTO trip_entries (day_id, sort_order, time, title, poi_id) VALUES (?, 2, '18:00', 'Matsuya', ?) RETURNING id")
      .bind(dayId, sharedMaster!.id)
      .first<{ id: number }>();
    await db.batch([
      db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)').bind(entry1!.id, sharedMaster!.id),
      db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 2)').bind(entry1!.id, altA!.id),
      db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 3)').bind(entry1!.id, altB!.id),
      db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)').bind(entry2!.id, sharedMaster!.id),
      db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 2)').bind(entry2!.id, altC!.id),
      db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 3)').bind(entry2!.id, altD!.id),
    ]);

    // PUT /days/:num with two entries both pointing at Matsuya (same as before)
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/trips/${TRIP}/days/1`, 'PUT', {
        date: '2026-05-12',
        dayOfWeek: '二',
        label: 'Updated',
        timeline: [
          { time: '08:30', title: 'Matsuya', poi_type: 'restaurant' },
          { time: '19:00', title: 'Matsuya', poi_type: 'restaurant' },
        ],
      }),
      env,
      auth: mockAuth({ email: 'user@test.com' }),
      params: { id: TRIP, num: '1' },
    });
    const resp = await callHandler(onRequestPut, ctx);
    expect(resp.status).toBe(200);

    // 確認兩個新 entries 各自保留自己原本的 alternates，不互換
    const newEntries = await db
      .prepare('SELECT id, sort_order FROM trip_entries WHERE day_id = ? ORDER BY sort_order')
      .bind(dayId)
      .all<{ id: number; sort_order: number }>();
    expect(newEntries.results.length).toBe(2);

    const e1Rows = await db
      .prepare('SELECT poi_id, sort_order FROM trip_entry_pois WHERE entry_id = ? ORDER BY sort_order')
      .bind(newEntries.results[0]!.id)
      .all<{ poi_id: number; sort_order: number }>();
    const e2Rows = await db
      .prepare('SELECT poi_id, sort_order FROM trip_entry_pois WHERE entry_id = ? ORDER BY sort_order')
      .bind(newEntries.results[1]!.id)
      .all<{ poi_id: number; sort_order: number }>();

    // entry1 應該拿到 [Master, Alt-A, Alt-B]（依序）
    expect(e1Rows.results.map((r) => r.poi_id)).toEqual([sharedMaster!.id, altA!.id, altB!.id]);
    // entry2 應該拿到 [Master, Alt-C, Alt-D]（依序）— 不該變成 [Master, Alt-A, Alt-B] 也不該空
    expect(e2Rows.results.map((r) => r.poi_id)).toEqual([sharedMaster!.id, altC!.id, altD!.id]);
  });
});
