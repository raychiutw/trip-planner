import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { callHandler, jsonRequest, mockAuth, mockContext, mockEnv, seedUser, seedTrip, seedEntry, getDayId } from './helpers';
import { onRequestPost as importTrip } from '../../functions/api/trips/import';

let db: D1Database;
beforeAll(async () => { db = await createTestDb(); });
afterAll(disposeMiniflare);

function payload(name: string, count = 4) {
  const timeline = Array.from({ length: count }, (_, i) => ({
    sortOrder: i + 10, startTime: '09:00', endTime: '10:00', description: `entry ${i}`, source: 'user',
    stopPois: [
      { name: `${name} alternate ${i}`, type: 'restaurant', sortOrder: 9, description: 'alternate description', note: 'alternate note', reservation: 'alternate booking', reservationUrl: 'https://example.com/alternate' },
      { name: `${name} master ${i}`, type: 'attraction', sortOrder: 1, description: 'master description', note: 'master note', reservation: 'master booking', reservationUrl: 'https://example.com/master' },
    ],
  }));
  return { schemaVersion: 1,
    meta: { name, title: '旅程標題', description: '旅程說明', countries: 'TW', lang: 'ja',
      destinations: [{ name: '台北', lat: 25, lng: 121, dayQuota: 2, subAreas: ['北投'] }] },
    days: [
      { dayNum: 2, date: '2026-09-24', dayOfWeek: '四', label: '抵達', hotel: { name: `${name} hotel`, lat: 25, lng: 121 }, timeline: timeline.slice(0, count / 2) },
      { dayNum: 4, date: '2026-09-26', dayOfWeek: '六', label: '返程', timeline: timeline.slice(count / 2) },
    ],
    segments: [
      { fromEntryIdx: 0, toEntryIdx: 1, mode: 'transit', submode: '火車', min: 20, distanceM: 3000, source: 'manual' },
      { fromEntryIdx: count / 2 - 1, toEntryIdx: count - 1, mode: 'walking', source: 'google', min: 15, distanceM: 800 },
    ],
    notes: {
      flights: [{ airline: '長榮', flightNo: 'BR123', cabinClass: '經濟艙', departAirport: 'TPE', arriveAirport: 'NRT', departAt: '2026-09-24T09:00', arriveAt: '2026-09-24T12:00', note: '航班備註' }],
      lodgings: [{ name: '筆記旅館', address: '台北', checkInAt: '2026-09-24', checkOutAt: '2026-09-26', bookingNo: 'L123', phone: '02-123', note: '住宿備註' }],
      reservations: [{ kind: 'restaurant', title: '午餐', reservedAt: '2026-09-24T12:00', partySize: 2, reservationNo: 'R123', phone: '02-456', note: '預订備註' }],
      pretripNotes: [{ section: '行前', title: '護照', content: '檢查效期' }],
      emergencyContacts: [{ name: '家人', relationship: '姊姊', phone: '0912345678', email: 'family@example.com', kind: 'personal' }],
    },
  };
}

function runImport(body: unknown, requestDb = db) {
  return callHandler(importTrip, mockContext({
    request: jsonRequest('https://test/api/trips/import', 'POST', body),
    env: mockEnv(requestDb), auth: mockAuth(),
  }));
}

async function rows(sql: string, ...values: (string | number)[]) {
  return (await db.prepare(sql).bind(...values).all<Record<string, unknown>>()).results;
}

/** 只替換指定的外部 D1 statement；其餘建立與補償照常執行真 D1。 */
function withFaults(rules: { sql: RegExp; occurrence?: number; table: string }[], beforeFailure?: () => Promise<void>): D1Database {
  const seen = rules.map(() => 0);
  const failures = new WeakSet<D1PreparedStatement>();
  return new Proxy(db, { get(target, property) {
    if (property === 'prepare') return (sql: string) => {
      const rule = rules.find((rule, i) => rule.sql.test(sql) && ++seen[i]! === (rule.occurrence ?? 1));
      if (!rule) return target.prepare(sql);
      const failure = target.prepare(`SELECT * FROM ${rule.table}`);
      failures.add(failure);
      return new Proxy(failure, { get(stmt, member) {
        if (member === 'bind') return () => failure;
        const value = Reflect.get(stmt, member);
        return typeof value === 'function' ? value.bind(stmt) : value;
      } });
    };
    if (property === 'batch') return async (statements: D1PreparedStatement[]) => {
      if (statements.some(stmt => failures.has(stmt))) await beforeFailure?.();
      return target.batch(statements);
    };
    const value = Reflect.get(target, property);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
}

async function structureCounts() {
  // audit_log 沿用原本保留政策，不是行程結構；其餘各表必須沒有本次殘留。
  const tables = ['trips', 'trip_permissions', 'trip_destinations', 'trip_days', 'trip_entries', 'trip_entry_pois',
    'trip_segments', 'pois', 'trip_flights', 'trip_lodgings', 'trip_reservations', 'trip_pretrip_notes', 'trip_emergency_contacts'];
  return rows(`SELECT ${tables.map(table => `(SELECT COUNT(*) FROM ${table}) AS ${table}`).join(', ')}`);
}

describe('匯入完整行程的生命週期（HTTP + 真 D1）', () => {
  it('trip 與前段筆記已提交後，後批筆記故障仍清完本次新行程', async () => {
    const body = payload('lifecycle-late-notes');
    body.notes.flights = Array.from({ length: 60 }, (_, i) => ({ ...body.notes.flights[0]!, flightNo: `BR${i}` }));
    const before = await structureCounts();
    let committed: Record<string, unknown>[] | undefined;
    const response = await runImport(body, withFaults([{ sql: /INSERT INTO trip_flights/, occurrence: 51, table: 'injected_late_note_failure' }], async () => {
      committed = await rows('SELECT COUNT(*) AS n FROM trip_flights f JOIN trips t ON t.id = f.trip_id WHERE t.name = ?', body.meta.name);
    }));
    expect(response.status).toBe(503);
    expect(committed).toEqual([{ n: 47 }]);
    expect(await structureCounts()).toEqual(before);
  });
  it('補償保護來源行程與共用 POI，只補空欄位且不回復 fill-null；重試仍可建立', async () => {
    const sourceResponse = await runImport(payload('lifecycle-shared-source'));
    expect(sourceResponse.status).toBe(201);
    const { tripId: sourceId } = await sourceResponse.json();
    const sourceStructure = await rows('SELECT d.id AS day, d.hotel_poi_id, e.id AS entry, ep.poi_id, ep.note FROM trip_days d JOIN trip_entries e ON e.day_id = d.id JOIN trip_entry_pois ep ON ep.entry_id = e.id WHERE d.trip_id = ? ORDER BY e.id, ep.sort_order', sourceId);
    await db.prepare('UPDATE pois SET address = ?, source = ?, country = ? WHERE name = ?').bind('原地址', 'google', 'TW', 'lifecycle-shared-source master 0').run();
    const body = payload('lifecycle-shared-copy');
    Object.assign(body.days[0]!.timeline[0]!.stopPois[1]!, { name: 'lifecycle-shared-source master 0', address: '不能覆蓋', rating: 4.9 });
    body.days[0]!.hotel!.name = 'lifecycle-shared-source hotel';
    const before = await structureCounts();
    expect((await runImport(body, withFaults([{ sql: /INSERT INTO trip_segments/, table: 'injected_shared_failure' }]))).status).toBe(503);
    expect(await structureCounts()).toEqual(before);
    expect(await rows('SELECT d.id AS day, d.hotel_poi_id, e.id AS entry, ep.poi_id, ep.note FROM trip_days d JOIN trip_entries e ON e.day_id = d.id JOIN trip_entry_pois ep ON ep.entry_id = e.id WHERE d.trip_id = ? ORDER BY e.id, ep.sort_order', sourceId)).toEqual(sourceStructure);
    expect(await rows('SELECT address, rating, source, country FROM pois WHERE name = ?', 'lifecycle-shared-source master 0')).toEqual([{ address: '原地址', rating: 4.9, source: 'google', country: 'TW' }]);
    expect((await runImport(body)).status).toBe(201);
    expect(await rows('SELECT COUNT(*) AS n FROM pois WHERE name = ?', 'lifecycle-shared-source master 0')).toEqual([{ n: 1 }]);
  });

  it('合法舊格式沿用名稱與欄位預設、master note、重複 POI 去重與無交通語意', async () => {
    const response = await runImport({ schemaVersion: 1, meta: { title: 'lifecycle-legacy-title' }, days: [{ dayNum: 0, timeline: [
      { note: '舊 entry 備註', stopPois: [
        { name: 'lifecycle-legacy-master', type: 'attraction', googleRating: 4.3, place_id: 'legacy-place' },
        { name: 'lifecycle-legacy-master', type: 'attraction', note: '重複不取代' },
        { name: 'lifecycle-legacy-alternate', note: '備選自有備註' },
      ] },
      { title: '合法佔位' },
    ] }], segments: [{ fromEntryIdx: 0, toEntryIdx: 1, mode: 'walking', noTravel: true, min: 99, source: 'manual' }] });
    expect(response.status).toBe(201);
    const { tripId } = await response.json();
    expect(await rows('SELECT name, title, countries, lang FROM trips WHERE id = ?', tripId)).toEqual([{ name: 'lifecycle-legacy-title', title: 'lifecycle-legacy-title', countries: 'JP', lang: 'zh-TW' }]);
    expect(await rows('SELECT e.sort_order, e.source, e.entry_pois_version, d.day_num FROM trip_entries e JOIN trip_days d ON d.id = e.day_id WHERE d.trip_id = ? ORDER BY e.id', tripId)).toEqual([
      { sort_order: 0, source: 'imported', entry_pois_version: 1, day_num: 1 },
      { sort_order: 1, source: 'imported', entry_pois_version: 0, day_num: 1 },
    ]);
    expect(await rows('SELECT p.name, p.type, p.rating, p.place_id, ep.note, ep.sort_order FROM trip_entry_pois ep JOIN pois p ON p.id = ep.poi_id JOIN trip_entries e ON e.id = ep.entry_id JOIN trip_days d ON d.id = e.day_id WHERE d.trip_id = ? ORDER BY ep.sort_order', tripId)).toEqual([
      { name: 'lifecycle-legacy-master', type: 'attraction', rating: 4.3, place_id: 'legacy-place', note: '舊 entry 備註', sort_order: 1 },
      { name: 'lifecycle-legacy-alternate', type: 'other', rating: null, place_id: null, note: '備選自有備註', sort_order: 2 },
    ]);
    expect(await rows('SELECT no_travel, min, distance_m, source FROM trip_segments WHERE trip_id = ?', tripId)).toEqual([{ no_travel: 1, min: null, distance_m: null, source: null }]);
  });

  it.each([
    { label: '未登入', auth: undefined, body: JSON.stringify(payload('lifecycle-unauthenticated')), status: 401 },
    { label: '無 V2 user', auth: mockAuth({ userId: null }), body: JSON.stringify(payload('lifecycle-no-user')), status: 401 },
    { label: '受限 token', auth: mockAuth({ restrictTrip: 'some-trip' }), body: JSON.stringify(payload('lifecycle-restricted')), status: 403 },
    { label: '無效 JSON', auth: mockAuth(), body: '{', status: 400 },
    { label: '實際 body 超限', auth: mockAuth(), body: ' '.repeat(512 * 1024 + 1), status: 400 },
    { label: '格式版本', auth: mockAuth(), body: JSON.stringify({ schemaVersion: 2 }), status: 400 },
    { label: '污染 key', auth: mockAuth(), body: '{"schemaVersion":1,"meta":{"name":"x"},"__proto__":{}}', status: 400 },
    { label: 'entries 超限', auth: mockAuth(), body: JSON.stringify({ schemaVersion: 1, meta: { name: 'x' }, days: [{ timeline: Array(101).fill({}) }] }), status: 400 },
  ])('$label 在建立前拒絕且不寫入任何行程結構', async ({ auth, body, status }) => {
    const before = await structureCounts();
    const response = await callHandler(importTrip, mockContext({
      env: mockEnv(db), auth, request: new Request('https://test/api/trips/import', { method: 'POST', headers: { 'Content-Length': '1' }, body }),
    }));
    expect(response.status).toBe(status);
    expect(await structureCounts()).toEqual(before);
  });

  it('達 1000 趟的使用者不能匯入新行程', async () => {
    const userId = await seedUser(db, 'lifecycle-cap@test.com');
    await db.prepare(`WITH RECURSIVE nums(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM nums WHERE n < 1000)
      INSERT INTO trips(id, name, owner_user_id) SELECT 'lifecycle-cap-' || n, '已存在', ? FROM nums`).bind(userId).run();
    try {
      const before = await structureCounts();
      const response = await callHandler(importTrip, mockContext({ env: mockEnv(db), auth: mockAuth({ email: 'lifecycle-cap@test.com' }), request: jsonRequest('https://test/api/trips/import', 'POST', payload('lifecycle-over-cap')) }));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: { detail: '行程數已達上限（1000）' } });
      expect(await structureCounts()).toEqual(before);
    } finally {
      await db.prepare('DELETE FROM trips WHERE owner_user_id = ?').bind(userId).run();
    }
  });
  it('ID 預檢後被其他建立先佔用時，失敗補償不得刪除對方行程', async () => {
    let occupiedId = '';
    const racedDb = new Proxy(db, { get(target, property) {
      if (property === 'prepare') return (sql: string) => {
        const stmt = target.prepare(sql);
        if (sql !== 'SELECT 1 FROM trips WHERE id = ?') return stmt;
        return { bind(id: string) { return { async first() {
          const existing = await stmt.bind(id).first();
          if (!existing) {
            occupiedId = id;
            await seedTrip(db, { id, owner: 'other-owner@test.com', days: 1 });
            await seedEntry(db, await getDayId(db, id, 1));
          }
          return existing;
        } }; } };
      };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    expect((await runImport(payload('lifecycle-id-race'), racedDb)).status).toBe(503);
    expect(occupiedId).not.toBe('');
    expect(await rows('SELECT owner_user_id FROM trips WHERE id = ?', occupiedId)).toEqual([{ owner_user_id: 'test-user-other-owner-test-com' }]);
    expect(await rows('SELECT COUNT(*) AS n FROM trip_entries e JOIN trip_days d ON d.id = e.day_id WHERE d.trip_id = ?', occupiedId)).toEqual([{ n: 1 }]);
    expect(await rows('SELECT role FROM trip_permissions WHERE trip_id = ?', occupiedId)).toEqual([{ role: 'owner' }]);
  });
  it.each([
    { phase: 'trip', sql: /INSERT INTO trips /, occurrence: 1, count: 4, committedEntries: 0, committedPois: 0 },
    { phase: 'notes', sql: /INSERT INTO trip_lodgings/, occurrence: 1, count: 4, committedEntries: 0, committedPois: 0 },
    { phase: 'days', sql: /INSERT INTO trip_days/, occurrence: 2, count: 4, committedEntries: 0, committedPois: 0 },
    { phase: 'poi resolve', sql: /INSERT OR IGNORE INTO pois/, occurrence: 2, count: 4, committedEntries: 0, committedPois: 0 },
    { phase: 'entries', sql: /INSERT INTO trip_entries/, occurrence: 2, count: 4, committedEntries: 0, committedPois: 0 },
    { phase: 'junction', sql: /INSERT INTO trip_entry_pois/, occurrence: 2, count: 4, committedEntries: 4, committedPois: 0 },
    { phase: 'hotel', sql: /UPDATE trip_days SET hotel_poi_id/, occurrence: 1, count: 4, committedEntries: 4, committedPois: 8 },
    { phase: 'segments', sql: /INSERT INTO trip_segments/, occurrence: 2, count: 4, committedEntries: 4, committedPois: 8 },
    { phase: 'entry after 50 commits', sql: /INSERT INTO trip_entries/, occurrence: 51, count: 60, committedEntries: 50, committedPois: 0 },
    { phase: 'junction after 50 commits', sql: /INSERT INTO trip_entry_pois/, occurrence: 101, count: 60, committedEntries: 60, committedPois: 100 },
  ])('$phase 必要寫入失敗會清完新結構，重試可完整建立', async ({ phase, sql, occurrence, count, committedEntries, committedPois }) => {
    const name = `lifecycle-failure-${phase}`;
    const before = await structureCounts();
    let committed: Record<string, unknown>[] | undefined;
    const response = await runImport(payload(name, count), withFaults([{ sql, occurrence, table: 'injected_write_failure' }], async () => {
      committed = await rows(`SELECT COUNT(DISTINCT e.id) AS entries, COUNT(ep.entry_id) AS junctions
        FROM trips t JOIN trip_days d ON d.trip_id = t.id JOIN trip_entries e ON e.day_id = d.id
        LEFT JOIN trip_entry_pois ep ON ep.entry_id = e.id WHERE t.name = ?`, name);
    }));
    expect(response.status).toBe(503);
    if (phase.startsWith('junction')) await expect(response.json()).resolves.toMatchObject({ error: { detail: 'entry 建立失敗，請稍後重試' } });
    // POI resolve 使用 .first；其餘故障發生在真正 batch 執行前，量到的是已提交資料。
    if (phase !== 'poi resolve') expect(committed).toEqual([{ entries: committedEntries, junctions: committedPois }]);
    expect(await structureCounts()).toEqual(before);
    const retry = await runImport(payload(name, count));
    expect(retry.status).toBe(201);
    const { tripId } = await retry.json();
    expect(await rows('SELECT COUNT(*) AS n FROM trip_entries e JOIN trip_days d ON d.id = e.day_id WHERE d.trip_id = ?', tripId)).toEqual([{ n: count }]);
    expect(await rows('SELECT COUNT(*) AS n FROM trip_entry_pois ep JOIN trip_entries e ON e.id = ep.entry_id JOIN trip_days d ON d.id = e.day_id WHERE d.trip_id = ?', tripId)).toEqual([{ n: count * 2 }]);
    expect(await rows('SELECT COUNT(*) AS n FROM trip_segments WHERE trip_id = ?', tripId)).toEqual([{ n: 2 }]);
    expect(await rows('SELECT p.name FROM trip_days d JOIN pois p ON p.id = d.hotel_poi_id WHERE d.trip_id = ?', tripId)).toEqual([{ name: `${name} hotel` }]);
  }, 180000);
  it('junction 建立與整趟補償都失敗時，回報失敗並同時保存兩個錯誤脈絡', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await runImport(payload('lifecycle-double-failure'), withFaults([
        { sql: /INSERT INTO trip_entry_pois/, table: 'injected_creation_failure' },
        { sql: /DELETE FROM trip_entries/, table: 'injected_cleanup_failure' },
      ]));
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({ error: { code: 'SYS_DB_ERROR' } });
      const context = errors.mock.calls.map(call => call[1]).find(value => value?.cleanupError);
      expect(context).toMatchObject({ tripId: expect.any(String), stage: 'entries', cleanup: 'failed',
        error: expect.objectContaining({ message: expect.stringContaining('injected_creation_failure') }),
        cleanupError: expect.objectContaining({ message: expect.stringContaining('injected_cleanup_failure') }),
      });
      expect(await rows('SELECT id FROM trips WHERE name = ?', 'lifecycle-double-failure')).toHaveLength(1);
    } finally {
      errors.mockRestore();
    }
  });
  it.each([4, 60])('%i 個 entries 完整匯入，保留來源內容及新 ID 關聯', async (count) => {
    const name = `lifecycle-success-${count}`;
    const response = await runImport(payload(name, count));
    expect(response.status).toBe(201);
    const { tripId, daysCreated, ok } = await response.json();
    expect({ daysCreated, ok }).toEqual({ daysCreated: 2, ok: true });
    expect(await rows('SELECT name, title, description, countries, lang, owner_user_id, published, data_source FROM trips WHERE id = ?', tripId)).toEqual([
      { name, title: '旅程標題', description: '旅程說明', countries: 'TW', lang: 'ja', owner_user_id: 'test-user-user-test-com', published: 0, data_source: 'imported' },
    ]);
    expect(await rows('SELECT user_id, role FROM trip_permissions WHERE trip_id = ?', tripId)).toEqual([{ user_id: 'test-user-user-test-com', role: 'owner' }]);
    expect(await rows('SELECT dest_order, name, lat, lng, day_quota, sub_areas FROM trip_destinations WHERE trip_id = ?', tripId)).toEqual([
      { dest_order: 1, name: '台北', lat: 25, lng: 121, day_quota: 2, sub_areas: '["北投"]' },
    ]);
    expect(await rows('SELECT d.day_num, d.date, d.day_of_week, d.label, p.name AS hotel FROM trip_days d LEFT JOIN pois p ON p.id = d.hotel_poi_id WHERE trip_id = ? ORDER BY d.id', tripId)).toEqual([
      { day_num: 2, date: '2026-09-24', day_of_week: '四', label: '抵達', hotel: `${name} hotel` },
      { day_num: 4, date: '2026-09-26', day_of_week: '六', label: '返程', hotel: null },
    ]);
    const entries = await rows('SELECT e.*, d.day_num FROM trip_entries e JOIN trip_days d ON e.day_id = d.id WHERE d.trip_id = ? ORDER BY e.id', tripId);
    expect(entries).toHaveLength(count);
    expect(entries[0]).toMatchObject({ day_num: 2, sort_order: 10, description: 'entry 0', start_time: '09:00', end_time: '10:00', source: 'user', entry_pois_version: 1 });
    expect(entries.at(-1)).toMatchObject({ day_num: 4, sort_order: count + 9, description: `entry ${count - 1}`, entry_pois_version: 1 });
    for (const index of [0, count - 1]) {
      expect(await rows('SELECT p.name, ep.sort_order, ep.description, ep.note, ep.reservation, ep.reservation_url FROM trip_entry_pois ep JOIN pois p ON p.id = ep.poi_id WHERE ep.entry_id = ? ORDER BY ep.sort_order', entries[index]!.id as number)).toEqual([
        { name: `${name} master ${index}`, sort_order: 1, description: 'master description', note: 'master note', reservation: 'master booking', reservation_url: 'https://example.com/master' },
        { name: `${name} alternate ${index}`, sort_order: 2, description: 'alternate description', note: 'alternate note', reservation: 'alternate booking', reservation_url: 'https://example.com/alternate' },
      ]);
    }
    const segments = await rows('SELECT * FROM trip_segments WHERE trip_id = ? ORDER BY id', tripId);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ from_entry_id: entries[0]!.id, to_entry_id: entries[1]!.id, mode: 'transit', submode: '火車', min: 20, distance_m: 3000, source: 'manual', version: 0, computed_at: null, no_travel: null });
    expect(segments[1]).toMatchObject({ from_entry_id: entries[count / 2 - 1]!.id, to_entry_id: entries.at(-1)!.id, source: 'google', version: 0, computed_at: expect.any(Number) });
    const audits = await rows('SELECT record_id, table_name, action, changed_by, diff_json FROM audit_log WHERE trip_id = ? ORDER BY id', tripId);
    expect(audits).toHaveLength(count);
    expect(audits[0]).toMatchObject({ record_id: entries[0]!.id, table_name: 'trip_entries', action: 'insert', changed_by: 'user@test.com' });
    expect(JSON.parse(audits[0]!.diff_json as string)).toMatchObject({ sort_order: 10, via: 'import', poiIds: expect.any(Array) });
    expect(await rows('SELECT sort_order, airline, flight_no, cabin_class, depart_airport, arrive_airport, depart_at, arrive_at, note FROM trip_flights WHERE trip_id = ?', tripId)).toEqual([
      { sort_order: 0, airline: '長榮', flight_no: 'BR123', cabin_class: '經濟艙', depart_airport: 'TPE', arrive_airport: 'NRT', depart_at: '2026-09-24T09:00', arrive_at: '2026-09-24T12:00', note: '航班備註' },
    ]);
    expect(await rows('SELECT sort_order, name, address, check_in_at, check_out_at, booking_no, phone, note FROM trip_lodgings WHERE trip_id = ?', tripId)).toEqual([
      { sort_order: 0, name: '筆記旅館', address: '台北', check_in_at: '2026-09-24', check_out_at: '2026-09-26', booking_no: 'L123', phone: '02-123', note: '住宿備註' },
    ]);
    expect(await rows('SELECT sort_order, kind, title, reserved_at, party_size, reservation_no, phone, note FROM trip_reservations WHERE trip_id = ?', tripId)).toEqual([
      { sort_order: 0, kind: 'restaurant', title: '午餐', reserved_at: '2026-09-24T12:00', party_size: 2, reservation_no: 'R123', phone: '02-456', note: '預订備註' },
    ]);
    expect(await rows('SELECT sort_order, section, title, content FROM trip_pretrip_notes WHERE trip_id = ?', tripId)).toEqual([{ sort_order: 0, section: '行前', title: '護照', content: '檢查效期' }]);
    expect(await rows('SELECT sort_order, name, relationship, phone, email, kind FROM trip_emergency_contacts WHERE trip_id = ?', tripId)).toEqual([
      { sort_order: 0, name: '家人', relationship: '姊姊', phone: '0912345678', email: 'family@example.com', kind: 'personal' },
    ]);
  });
});
