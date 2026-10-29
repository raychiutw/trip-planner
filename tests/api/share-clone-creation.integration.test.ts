import { beforeAll, afterAll, expect, it } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { callHandler, getDayId, jsonRequest, mockAuth, mockContext, mockEnv, mockServiceAuth, seedEntry, seedEntryAlternate, seedHotelForDay, seedPoi, seedTrip, seedUser, userIdFor } from './helpers';
import { onRequestPost as createShare } from '../../functions/api/trips/[id]/shares';
import { onRequestPost as cloneShare } from '../../functions/api/share/[token]/clone';

let db: D1Database;
let token: string;
const sourceId = 'clone-creation-source';
const owner = 'clone-creation-owner@test.com';

beforeAll(async () => {
  db = await createTestDb();
  await seedTrip(db, { id: sourceId, owner, days: 1 });
  const dayId = await getDayId(db, sourceId, 1);
  const firstPoi = await seedPoi(db, { name: 'clone-creation-first', type: 'attraction' });
  const secondPoi = await seedPoi(db, { name: 'clone-creation-second', type: 'attraction' });
  const first = await seedEntry(db, dayId, { sortOrder: 1, poiId: firstPoi });
  const second = await seedEntry(db, dayId, { sortOrder: 2, poiId: secondPoi });
  const alternate = await seedPoi(db, { name: 'clone-creation-alternate', type: 'restaurant' });
  await seedEntryAlternate(db, { entryId: first, poiId: alternate });
  await db.prepare("UPDATE trip_entry_pois SET description = '正選說明', note = '正選備註', reservation = '已預訂', reservation_url = 'https://example.com/booking' WHERE entry_id = ? AND sort_order = 1").bind(first).run();
  await db.prepare("UPDATE trip_entry_pois SET description = '備選說明', note = '備選備註', reservation = '候補' WHERE entry_id = ? AND sort_order = 2").bind(first).run();
  const hotel = await seedPoi(db, { name: 'clone-creation-hotel', type: 'hotel' });
  await seedHotelForDay(db, dayId, hotel);
  await db.prepare("INSERT INTO trip_segments (trip_id, from_entry_id, to_entry_id, mode, version) VALUES (?, ?, ?, 'walking', 0)")
    .bind(sourceId, first, second).run();
  await db.prepare("INSERT INTO trip_flights (trip_id, airline, flight_no) VALUES (?, 'BR', '112')").bind(sourceId).run();
  await db.prepare("INSERT INTO trip_lodgings (trip_id, name, booking_no) VALUES (?, '住宿', 'BOOK-1')").bind(sourceId).run();
  await db.prepare("INSERT INTO trip_reservations (trip_id, kind, title) VALUES (?, 'restaurant', '晚餐')").bind(sourceId).run();
  await db.prepare("INSERT INTO trip_pretrip_notes (trip_id, section, title, content, ai_generated, ai_source) VALUES (?, 'general', '提醒', '帶護照', 1, 'imported')").bind(sourceId).run();
  await db.prepare("INSERT INTO trip_emergency_contacts (trip_id, name, phone) VALUES (?, '隱藏聯絡人', '0900')").bind(sourceId).run();
  const share = await callHandler(createShare as never, mockContext({
    request: jsonRequest(`https://x/api/trips/${sourceId}/shares`, 'POST', { visibleSections: ['flights', 'lodgings', 'reservations', 'pretrip'] }),
    env: mockEnv(db), auth: mockAuth({ email: owner }), params: { id: sourceId },
  }));
  token = (await share.json() as { token: string }).token;
});
afterAll(disposeMiniflare);

function failStatements(patterns: RegExp[]): D1Database {
  return new Proxy(db, { get(target, property) {
    if (property === 'prepare') return (sql: string) => {
      const hit = patterns.find((pattern) => pattern.test(sql));
      if (hit) {
        patterns.splice(patterns.indexOf(hit), 1);
        const failure = target.prepare('SELECT json(?)').bind('injected-invalid-json');
        return new Proxy(failure, { get(stmt, member) {
          if (member === 'bind') return () => failure;
          const value = Reflect.get(stmt, member);
          return typeof value === 'function' ? value.bind(stmt) : value;
        } });
      }
      return target.prepare(sql);
    };
    const value = Reflect.get(target, property);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
}

async function clone(email: string, requestDb = db) {
  await seedUser(db, email);
  return callHandler(cloneShare as never, mockContext({
    request: jsonRequest(`https://x/api/share/${token}/clone`, 'POST'),
    env: mockEnv(requestDb), auth: mockAuth({ email }), params: { token },
  }));
}

it('建立及補償都失敗時，回應可辨識清理未完成', async () => {
  const response = await clone('clone-cleanup-fail@test.com', failStatements([/INSERT INTO trip_segments/, /DELETE FROM trips WHERE id/]));
  expect(response.status).toBeGreaterThanOrEqual(500);
  await expect(response.json()).resolves.toMatchObject({ error: { detail: expect.stringContaining('清理失敗') } });
});

it('複製可見內容並保留來源；新行程的 owner、POI 欄位、住宿與 segment 正確', async () => {
  const email = 'clone-complete@test.com';
  const response = await clone(email);
  expect(response.status).toBe(201);
  const { tripId } = await response.json() as { tripId: string };
  expect(tripId).toMatch(/^cln-/);
  const trip = await db.prepare('SELECT name, owner_user_id, published, data_source, lang FROM trips WHERE id = ?')
    .bind(tripId).first<{ name: string; owner_user_id: string; published: number; data_source: string; lang: string }>();
  expect(trip).toMatchObject({ owner_user_id: userIdFor(email), published: 0, data_source: 'cloned', lang: 'zh-TW' });
  expect(trip?.name).toMatch(/-複製$/);
  const links = await db.prepare(`SELECT e.entry_pois_version, ep.sort_order, ep.description, ep.note, ep.reservation, ep.reservation_url
    FROM trip_entry_pois ep JOIN trip_entries e ON e.id = ep.entry_id JOIN trip_days d ON d.id = e.day_id
    WHERE d.trip_id = ? AND e.sort_order = 1 ORDER BY ep.sort_order`).bind(tripId).all();
  expect(links.results).toEqual([
    { entry_pois_version: 1, sort_order: 1, description: '正選說明', note: '正選備註', reservation: '已預訂', reservation_url: 'https://example.com/booking' },
    { entry_pois_version: 1, sort_order: 2, description: '備選說明', note: '備選備註', reservation: '候補', reservation_url: null },
  ]);
  const hotel = await db.prepare('SELECT COUNT(*) AS n FROM trip_days WHERE trip_id = ? AND hotel_poi_id IS NOT NULL').bind(tripId).first<{ n: number }>();
  expect(hotel?.n).toBe(1);
  const segment = await db.prepare(`SELECT COUNT(*) AS n FROM trip_segments s
    JOIN trip_entries e ON e.id = s.from_entry_id JOIN trip_days d ON d.id = e.day_id
    JOIN trip_entries e2 ON e2.id = s.to_entry_id JOIN trip_days d2 ON d2.id = e2.day_id
    WHERE s.trip_id = ? AND d.trip_id = ? AND d2.trip_id = ?`).bind(tripId, tripId, tripId).first<{ n: number }>();
  expect(segment?.n).toBe(1);
  for (const [table, count] of [['trip_flights', 1], ['trip_lodgings', 1], ['trip_reservations', 1], ['trip_pretrip_notes', 1], ['trip_emergency_contacts', 0]] as const) {
    const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE trip_id = ?`).bind(tripId).first<{ n: number }>();
    expect(row?.n).toBe(count);
  }
  const pretrip = await db.prepare('SELECT title, content, ai_generated, ai_source FROM trip_pretrip_notes WHERE trip_id = ?').bind(tripId).first();
  expect(pretrip).toEqual({ title: '提醒', content: '帶護照', ai_generated: 1, ai_source: 'imported' });
  expect(await db.prepare('SELECT airline, flight_no FROM trip_flights WHERE trip_id = ?').bind(tripId).first())
    .toEqual({ airline: 'BR', flight_no: '112' });
  expect(await db.prepare('SELECT name, booking_no FROM trip_lodgings WHERE trip_id = ?').bind(tripId).first())
    .toEqual({ name: '住宿', booking_no: 'BOOK-1' });
  expect(await db.prepare('SELECT kind, title FROM trip_reservations WHERE trip_id = ?').bind(tripId).first())
    .toEqual({ kind: 'restaurant', title: '晚餐' });
  const audit = await db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE trip_id = ? AND action = 'insert'").bind(tripId).first<{ n: number }>();
  expect(audit?.n).toBe(2);
  expect(await db.prepare('SELECT id FROM trips WHERE id = ?').bind(sourceId).first()).not.toBeNull();
});

it.each([
  ['day', /INSERT INTO trip_days/], ['entry', /INSERT INTO trip_entries/],
  ['junction', /INSERT INTO trip_entry_pois/], ['hotel', /UPDATE trip_days SET hotel_poi_id/],
  ['segment', /INSERT INTO trip_segments/],
] as const)('%s 寫入失敗時不留下複製行程，來源行程仍可用', async (phase, sql) => {
  const email = `clone-${phase}-fail@test.com`;
  const response = await clone(email, failStatements([sql]));
  expect(response.status).toBeGreaterThanOrEqual(500);
  const trip = await db.prepare('SELECT id FROM trips WHERE owner_user_id = ? AND data_source = ?')
    .bind(userIdFor(email), 'cloned').first();
  expect(trip).toBeNull();
  expect(await db.prepare('SELECT id FROM trips WHERE id = ?').bind(sourceId).first()).not.toBeNull();
});

it('60 筆 entry 已分批提交後 segment 失敗會清理，重新複製仍完整成功', async () => {
  const largeId = 'clone-large-source';
  await seedTrip(db, { id: largeId, owner, days: 2 });
  const firstDay = await getDayId(db, largeId, 1);
  const secondDay = await getDayId(db, largeId, 2);
  const poiId = await seedPoi(db, { name: 'clone-large-poi', type: 'attraction' });
  const inserts = Array.from({ length: 60 }, (_, i) => db.prepare('INSERT INTO trip_entries (day_id, sort_order, start_time) VALUES (?, ?, ?) RETURNING id')
    .bind(i < 30 ? firstDay : secondDay, i % 30 + 1, '10:00'));
  const created = await db.batch(inserts);
  const entryIds = created.map((result) => (result.results[0] as { id: number }).id);
  await db.batch(entryIds.map((id) => db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)').bind(id, poiId)));
  await db.prepare("INSERT INTO trip_segments (trip_id, from_entry_id, to_entry_id, mode, version) VALUES (?, ?, ?, 'walking', 0)")
    .bind(largeId, entryIds[30], entryIds[31]).run();
  const share = await callHandler(createShare as never, mockContext({
    request: jsonRequest(`https://x/api/trips/${largeId}/shares`, 'POST', {}),
    env: mockEnv(db), auth: mockAuth({ email: owner }), params: { id: largeId },
  }));
  const largeToken = (await share.json() as { token: string }).token;
  const email = 'clone-large@test.com';
  await seedUser(db, email);
  const run = (requestDb = db) => callHandler(cloneShare as never, mockContext({
    request: jsonRequest(`https://x/api/share/${largeToken}/clone`, 'POST'),
    env: mockEnv(requestDb), auth: mockAuth({ email }), params: { token: largeToken },
  }));
  const auditsBefore = await db.prepare('SELECT COUNT(*) AS n FROM audit_log WHERE changed_by = ?')
    .bind(email).first<{ n: number }>();
  const failed = await run(failStatements([/INSERT INTO trip_segments/]));
  expect(failed.status).toBeGreaterThanOrEqual(500);
  const left = await db.prepare("SELECT COUNT(*) AS n FROM trips WHERE owner_user_id = ? AND data_source = 'cloned'")
    .bind(userIdFor(email)).first<{ n: number }>();
  expect(left?.n).toBe(0);
  const auditsAfter = await db.prepare('SELECT COUNT(*) AS n FROM audit_log WHERE changed_by = ?')
    .bind(email).first<{ n: number }>();
  expect(auditsAfter?.n).toBe(auditsBefore?.n);
  const sourceEntries = await db.prepare('SELECT COUNT(*) AS n FROM trip_entries e JOIN trip_days d ON d.id = e.day_id WHERE d.trip_id = ?')
    .bind(largeId).first<{ n: number }>();
  expect(sourceEntries?.n).toBe(60);
  const retry = await run();
  expect(retry.status).toBe(201);
  const { tripId } = await retry.json() as { tripId: string };
  const totals = await db.prepare(`SELECT
    (SELECT COUNT(*) FROM trip_days WHERE trip_id = ?) AS days,
    (SELECT COUNT(*) FROM trip_entries e JOIN trip_days d ON d.id = e.day_id WHERE d.trip_id = ?) AS entries,
    (SELECT COUNT(*) FROM trip_segments WHERE trip_id = ?) AS segments,
    (SELECT COUNT(*) FROM audit_log WHERE trip_id = ?) AS audits`)
    .bind(tripId, tripId, tripId, tripId).first();
  expect(totals).toEqual({ days: 2, entries: 60, segments: 1, audits: 60 });
});

it('未知、撤銷、過期分享維持 404；未登入及受限身分不能複製', async () => {
  const email = 'clone-access@test.com';
  await seedUser(db, email);
  const post = (shareToken: string, auth = mockAuth({ email })) => callHandler(cloneShare as never, mockContext({
    request: jsonRequest(`https://x/api/share/${shareToken}/clone`, 'POST'),
    env: mockEnv(db), auth, params: { token: shareToken },
  }));
  expect((await post('unknown-share-token-123456789')).status).toBe(404);
  for (const [state, value] of [['revoked_at', '2026-01-01'], ['expires_at', 1]] as const) {
    const response = await callHandler(createShare as never, mockContext({
      request: jsonRequest(`https://x/api/trips/${sourceId}/shares`, 'POST', {}),
      env: mockEnv(db), auth: mockAuth({ email: owner }), params: { id: sourceId },
    }));
    const share = await response.json() as { id: number; token: string };
    await db.prepare(`UPDATE trip_shares SET ${state} = ? WHERE id = ?`).bind(value, share.id).run();
    expect((await post(share.token)).status).toBe(404);
  }
  expect((await post(token, mockServiceAuth())).status).toBe(401);
  expect((await post(token, mockAuth({ email, restrictTrip: sourceId }))).status).toBe(403);
});

it('速率限制與行程數上限仍在建立前生效', async () => {
  const limited = 'clone-rate-limit@test.com';
  await seedUser(db, limited);
  await db.prepare('INSERT INTO rate_limit_buckets (bucket_key, count, window_start, locked_until) VALUES (?, 11, ?, ?)')
    .bind(`clone:user:${userIdFor(limited)}`, Date.now(), Date.now() + 60_000).run();
  expect((await clone(limited)).status).toBe(429);

  const capped = 'clone-cap@test.com';
  await seedUser(db, capped);
  for (let start = 0; start < 1000; start += 50) {
    await db.batch(Array.from({ length: 50 }, (_, i) => db.prepare('INSERT INTO trips (id, name, owner_user_id) VALUES (?, ?, ?)')
      .bind(`cap-${start + i}`, `Cap ${start + i}`, userIdFor(capped))));
  }
  const response = await clone(capped);
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toMatchObject({ error: { detail: expect.stringContaining('行程數已達上限') } });
});
