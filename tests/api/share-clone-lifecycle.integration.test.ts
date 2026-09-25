import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { withTripCreationFaults, tripStructureCounts } from './trip-creation-helpers';
import { callHandler, jsonRequest, mockAuth, mockContext, mockEnv, seedTrip, userIdFor } from './helpers';
import { hashToken } from '../../functions/api/_share';
import { onRequestPost as cloneTrip } from '../../functions/api/share/[token]/clone';

let db: D1Database;
beforeAll(async () => { db = await createTestDb(); });
afterAll(disposeMiniflare);

async function rows(sql: string, ...values: (string | number)[]) {
  return (await db.prepare(sql).bind(...values).all<Record<string, unknown>>()).results;
}

async function source(name: string, count = 4) {
  await seedTrip(db, { id: name, owner: 'clone-source@test.com', days: 2 });
  const days = await rows('SELECT id FROM trip_days WHERE trip_id = ? ORDER BY day_num', name);
  const entryResults = await db.batch(Array.from({ length: count }, (_, i) => db.prepare(
    'INSERT INTO trip_entries (day_id, sort_order, start_time, end_time, description, source) VALUES (?,?,?,?,?,?) RETURNING id',
  ).bind(days[i < count / 2 ? 0 : 1]!.id, i + 10, '09:00', '10:00', `entry ${i}`, i === 0 ? null : 'user')));
  const entries = entryResults.map(r => r.results[0]!.id as number);
  const poiResults = await db.batch(Array.from({ length: count * 2 + 1 }, (_, i) => db.prepare(
    'INSERT INTO pois (type, name, country, source, address, rating) VALUES (?,?,?,?,?,?) RETURNING id',
  ).bind(i === count * 2 ? 'hotel' : i % 2 ? 'restaurant' : 'attraction', `${name} poi ${i}`, 'TW', 'google', '原地址', 4.5)));
  const pois = poiResults.map(r => r.results[0]!.id as number);
  await db.batch(entries.flatMap((entry, i) => [0, 1].map(j => db.prepare(
    'INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order, description, note, reservation, reservation_url) VALUES (?,?,?,?,?,?,?)',
  ).bind(entry, pois[i * 2 + j], j === 0 ? 1 : 9, j ? '備選說明' : '正選說明', j ? '備選備註' : '正選備註', j ? '備選預訂' : '正選預訂', j ? 'https://example.com/alternate' : 'https://example.com/master'))));
  await db.batch([
    db.prepare('UPDATE trips SET title = ?, description = ?, countries = ?, lang = ? WHERE id = ?').bind('旅程標題', '旅程說明', 'TW', 'ja', name),
    db.prepare('INSERT INTO trip_destinations (trip_id, dest_order, name, lat, lng, day_quota, sub_areas) VALUES (?,9,?,?,?,NULL,?)').bind(name, '台北', 25, 121, '[ "北投" ]'),
    db.prepare('UPDATE trip_days SET hotel_poi_id = ? WHERE id = ?').bind(pois.at(-1), days[0]!.id),
    db.prepare('INSERT INTO trip_segments (trip_id, from_entry_id, to_entry_id, mode, submode, min, distance_m, source, no_travel, version, computed_at) VALUES (?,?,?,\'transit\',\'火車\',20,3000,\'manual\',1,8,123)').bind(name, entries[0], entries[1]),
    db.prepare('INSERT INTO trip_segments (trip_id, from_entry_id, to_entry_id, mode, min, distance_m, source, version, computed_at) VALUES (?,?,?,\'walking\',15,800,\'google\',7,123)').bind(name, entries[count / 2 - 1], entries.at(-1)),
    db.prepare('INSERT INTO trip_flights (trip_id, sort_order, airline, flight_no, note) VALUES (?,8,\'長榮\',\'BR123\',\'航班備註\')').bind(name),
    db.prepare('INSERT INTO trip_lodgings (trip_id, sort_order, name, booking_no, note) VALUES (?,9,\'筆記旅館\',\'L123\',\'住宿備註\')').bind(name),
    db.prepare('INSERT INTO trip_reservations (trip_id, sort_order, kind, title, party_size, note) VALUES (?,10,\'restaurant\',\'午餐\',2,\'預訂備註\')').bind(name),
    db.prepare('INSERT INTO trip_pretrip_notes (trip_id, sort_order, section, title, content, ai_generated, ai_source) VALUES (?,11,\'行前\',\'護照\',\'檢查效期\',1,\'source-ai\')').bind(name),
    db.prepare('INSERT INTO trip_emergency_contacts (trip_id, sort_order, name, relationship, phone, email, kind, ai_generated) VALUES (?,12,\'家人\',\'姊姊\',\'0912345678\',\'family@example.com\',\'personal\',1)').bind(name),
  ]);
  const token = `clone-lifecycle-${name}`;
  await db.prepare('INSERT INTO trip_shares (trip_id, token_hash, visible_sections, created_by) VALUES (?,?,?,?)')
    .bind(name, await hashToken(token), '["flights","lodgings","reservations","pretrip","emergency"]', userIdFor('clone-source@test.com')).run();
  return { name, token, entries };
}

function runClone(token: string, requestDb = db, auth = mockAuth({ email: `${token}@test.com` })) {
  return callHandler(cloneTrip, mockContext({
    request: jsonRequest(`https://test/api/share/${token}/clone`, 'POST', undefined, { 'CF-Connecting-IP': token }),
    env: mockEnv(requestDb), auth, params: { token },
  }));
}

async function sourceBody(tripId: string) {
  return rows(`SELECT e.*, ep.poi_id, ep.sort_order AS poi_order, ep.description AS poi_description, ep.note, ep.reservation,
    p.address, p.rating, p.source AS poi_source, p.country
    FROM trip_entries e JOIN trip_days d ON d.id = e.day_id JOIN trip_entry_pois ep ON ep.entry_id = e.id
    JOIN pois p ON p.id = ep.poi_id WHERE d.trip_id = ? ORDER BY e.id, ep.sort_order`, tripId);
}

describe('分享 clone 的完整建立生命週期（HTTP + 真 D1）', () => {
  it('來源讀取期間 day 消失，缺少關聯的 entry 不會靜默遺失並回成功', async () => {
    const src = await source('clone-missing-day');
    const before = await tripStructureCounts(db);
    const changedSource = new Proxy(db, { get(target, property) {
      if (property === 'prepare') return (sql: string) => {
        const statement = target.prepare(sql);
        if (!sql.startsWith('SELECT id, day_num, date, day_of_week, label FROM trip_days')) return statement;
        return { bind: (...values: unknown[]) => {
          const bound = statement.bind(...values);
          return { all: async () => { const result = await bound.all(); return { ...result, results: result.results.slice(0, 1) }; } };
        } };
      };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    const response = await runClone(src.token, changedSource);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'SYS_DB_ERROR', detail: '複製寫入失敗（entry 缺 day 關聯）' } });
    expect(await tripStructureCounts(db)).toEqual(before);
  });
  it.each([
    { phase: 'trip', sql: /INSERT INTO trips / },
    { phase: 'permission', sql: /INSERT INTO trip_permissions/ },
    { phase: 'destination', sql: /INSERT INTO trip_destinations/ },
    { phase: 'flights', sql: /INSERT INTO trip_flights/ },
    { phase: 'lodgings', sql: /INSERT INTO trip_lodgings/ },
    { phase: 'reservations', sql: /INSERT INTO trip_reservations/ },
    { phase: 'pretrip', sql: /INSERT INTO trip_pretrip_notes/ },
    { phase: 'emergency', sql: /INSERT INTO trip_emergency_contacts/ },
    { phase: 'days', sql: /INSERT INTO trip_days/ },
    { phase: 'poi', sql: /UPDATE pois SET/ },
    { phase: 'entries', sql: /INSERT INTO trip_entries/ },
    { phase: 'junction', sql: /INSERT INTO trip_entry_pois/ },
    { phase: 'audit', sql: /INSERT INTO audit_log/ },
    { phase: 'hotel', sql: /UPDATE trip_days SET hotel_poi_id/ },
    { phase: 'segments', sql: /INSERT INTO trip_segments/ },
  ])('$phase 必要寫入失敗不回成功；補償保護來源，重新操作可建立', async ({ phase, sql }) => {
    const src = await source(`clone-fail-${phase}`);
    const before = await tripStructureCounts(db);
    const sourceBefore = await sourceBody(src.name);
    const response = await runClone(src.token, withTripCreationFaults(db, [{ sql, table: 'injected_clone_write_failure' }]));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'SYS_DB_ERROR',
      detail: ['junction', 'audit'].includes(phase) ? 'entry 建立失敗，請稍後重試' : '複製失敗，請稍後重試' } });
    expect(await tripStructureCounts(db)).toEqual(before);
    expect(await sourceBody(src.name)).toEqual(sourceBefore);
    const retry = await runClone(src.token);
    expect(retry.status).toBe(201);
    const { tripId } = await retry.json();
    expect(await rows('SELECT COUNT(*) AS n FROM trip_entries e JOIN trip_days d ON d.id = e.day_id WHERE d.trip_id = ?', tripId)).toEqual([{ n: 4 }]);
    expect(await rows('SELECT COUNT(*) AS n FROM trip_segments WHERE trip_id = ?', tripId)).toEqual([{ n: 2 }]);
  });

  it('筆記前批已提交，後批故障仍清完本次新行程', async () => {
    const src = await source('clone-late-notes');
    await db.batch(Array.from({ length: 59 }, (_, i) => db.prepare('INSERT INTO trip_flights (trip_id, sort_order, flight_no) VALUES (?,?,?)').bind(src.name, i + 20, `BR${i}`)));
    const before = await tripStructureCounts(db);
    let committed: Record<string, unknown>[] | undefined;
    const response = await runClone(src.token, withTripCreationFaults(db, [{ sql: /INSERT INTO trip_flights/, occurrence: 51, table: 'injected_late_note_failure' }], async () => {
      committed = await rows('SELECT COUNT(*) AS n FROM trip_flights f JOIN trips t ON t.id = f.trip_id WHERE t.name = ?', `${src.name}-複製`);
    }));
    expect(response.status).toBe(503);
    expect(committed).toEqual([{ n: 47 }]);
    expect(await tripStructureCounts(db)).toEqual(before);
  });

  it('60 個 entry 與前批 junction 已提交後，後批故障仍清完本次結構', async () => {
    const src = await source('clone-late-junction', 60);
    const before = await tripStructureCounts(db);
    let committed: Record<string, unknown>[] | undefined;
    const response = await runClone(src.token, withTripCreationFaults(db, [{ sql: /INSERT INTO trip_entry_pois/, occurrence: 101, table: 'injected_late_junction_failure' }], async () => {
      committed = await rows(`SELECT COUNT(DISTINCT e.id) AS entries, COUNT(ep.entry_id) AS junctions
        FROM trips t JOIN trip_days d ON d.trip_id = t.id JOIN trip_entries e ON e.day_id = d.id
        LEFT JOIN trip_entry_pois ep ON ep.entry_id = e.id WHERE t.name = ?`, `${src.name}-複製`);
    }));
    expect(response.status).toBe(503);
    expect(committed).toEqual([{ entries: 60, junctions: 100 }]);
    expect(await tripStructureCounts(db)).toEqual(before);
  }, 180000);

  it('建立與補償都失敗時，同時保存兩個錯誤及可追查的行程／階段', async () => {
    const src = await source('clone-double-failure');
    const sourceBefore = await sourceBody(src.name);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await runClone(src.token, withTripCreationFaults(db, [
        { sql: /INSERT INTO trip_entry_pois/, table: 'injected_clone_creation_failure' },
        { sql: /DELETE FROM trip_entries/, table: 'injected_clone_cleanup_failure' },
      ]));
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({ error: { code: 'SYS_DB_ERROR', detail: 'entry 建立失敗，請稍後重試' } });
      const context = errors.mock.calls.map(call => call[1]).find(value => value?.cleanupError);
      expect(context).toMatchObject({ tripId: expect.stringMatching(/^cln-/), stage: 'entries', cleanup: 'failed',
        error: expect.objectContaining({ message: expect.stringContaining('injected_clone_creation_failure') }),
        cleanupError: expect.objectContaining({ message: expect.stringContaining('injected_clone_cleanup_failure') }),
      });
      expect(await rows('SELECT id FROM trips WHERE name = ?', `${src.name}-複製`)).toHaveLength(1);
      expect(await sourceBody(src.name)).toEqual(sourceBefore);
    } finally { errors.mockRestore(); }
  });

  it.each(['[]', '{bad json', '["unknown"]', '["flights","pretrip"]'])('筆記可見性 %s 保持 default-deny', async (visible) => {
    const src = await source(`clone-visible-${visible.length}`);
    await db.prepare('UPDATE trip_shares SET visible_sections = ? WHERE trip_id = ?').bind(visible, src.name).run();
    const response = await runClone(src.token);
    expect(response.status).toBe(201);
    const { tripId } = await response.json();
    for (const [section, table] of [['flights', 'trip_flights'], ['lodgings', 'trip_lodgings'], ['reservations', 'trip_reservations'], ['pretrip', 'trip_pretrip_notes'], ['emergency', 'trip_emergency_contacts']]) {
      const allowed = visible === '["flights","pretrip"]' && ['flights', 'pretrip'].includes(section!);
      expect(await rows(`SELECT COUNT(*) AS n FROM ${table} WHERE trip_id = ?`, tripId)).toEqual([{ n: allowed ? 1 : 0 }]);
      expect(await rows(`SELECT COUNT(*) AS n FROM ${table} WHERE trip_id = ?`, src.name)).toEqual([{ n: 1 }]);
    }
  });

  it('來源的空名稱、標題、語言與國家沿用 clone 預設，空 POI entry 保留版本 0', async () => {
    const src = await source('clone-defaults');
    await db.batch([
      db.prepare("UPDATE trips SET name = '', title = NULL, countries = NULL, lang = NULL WHERE id = ?").bind(src.name),
      db.prepare('DELETE FROM trip_entry_pois WHERE entry_id = ?').bind(src.entries[0]),
    ]);
    const response = await runClone(src.token);
    expect(response.status).toBe(201);
    const { tripId } = await response.json();
    expect(await rows('SELECT name, title, countries, lang FROM trips WHERE id = ?', tripId)).toEqual([{ name: '-複製', title: null, countries: 'JP', lang: 'zh-TW' }]);
    expect(await rows('SELECT entry_pois_version FROM trip_entries e JOIN trip_days d ON d.id = e.day_id WHERE d.trip_id = ? ORDER BY e.id LIMIT 1', tripId)).toEqual([{ entry_pois_version: 0 }]);
  });

  it.each(['unknown', 'expired', 'revoked'])('%s 分享連結一致回 404，不建立任何資料', async (state) => {
    const src = await source(`clone-share-${state}`);
    if (state === 'expired') await db.prepare('UPDATE trip_shares SET expires_at = 1 WHERE trip_id = ?').bind(src.name).run();
    if (state === 'revoked') await db.prepare("UPDATE trip_shares SET revoked_at = datetime('now') WHERE trip_id = ?").bind(src.name).run();
    const before = await tripStructureCounts(db);
    const response = await runClone(state === 'unknown' ? 'unknown-clone-token-12345' : src.token);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'NOT_FOUND' });
    expect(await tripStructureCounts(db)).toEqual(before);
  });

  it.each([
    { label: '未登入', auth: undefined, status: 401 },
    { label: '無 V2 user', auth: mockAuth({ userId: null }), status: 401 },
    { label: '受限 token', auth: mockAuth({ restrictTrip: 'other-trip' }), status: 403 },
  ])('$label 在分享查詢與建立前拒絕', async ({ auth, status }) => {
    const before = await tripStructureCounts(db);
    const response = await callHandler(cloneTrip, mockContext({ request: jsonRequest('https://test/api/share/unknown/clone', 'POST'),
      env: mockEnv(db), auth, params: { token: 'unknown' } }));
    expect(response.status).toBe(status);
    expect(await tripStructureCounts(db)).toEqual(before);
  });

  it.each(['ip', 'user'])('%s rate limit 在建立前生效，回既有 429 與 Retry-After', async (scope) => {
    const src = await source(`clone-limit-${scope}`);
    const key = scope === 'ip' ? src.token : userIdFor(`${src.token}@test.com`);
    const now = Date.now();
    await db.prepare('INSERT INTO rate_limit_buckets (bucket_key, count, window_start, locked_until) VALUES (?,100,?,?)').bind(`clone:${scope}:${key}`, now, now + 3600000).run();
    const before = await tripStructureCounts(db);
    const response = await runClone(src.token);
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: 'RATE_LIMIT' });
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(await tripStructureCounts(db)).toEqual(before);
  });

  it('1000 趟上限在建立前生效，失敗仍計入嘗試', async () => {
    const src = await source('clone-cap');
    const owner = userIdFor('clone-source@test.com');
    await db.prepare(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<1000)
      INSERT INTO trips (id, name, owner_user_id) SELECT 'clone-cap-'||i, 'cap', ? FROM n`).bind(owner).run();
    const before = await tripStructureCounts(db);
    const response = await runClone(src.token, db, mockAuth({ email: 'clone-source@test.com' }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'DATA_VALIDATION', detail: '行程數已達上限（1000）' } });
    expect(await tripStructureCounts(db)).toEqual(before);
    expect(await rows('SELECT count FROM rate_limit_buckets WHERE bucket_key = ?', `clone:user:${owner}`)).toEqual([{ count: 1 }]);
  });

  it('來源讀完後共用 POI 改變，只 fill-null 且補空不隨後段補償還原', async () => {
    const src = await source('clone-fill-null');
    const before = await tripStructureCounts(db);
    // 在來源 SELECT 與 POI resolve 之間製造真正的 D1 變動，保留已讀取的来源資料。
    await db.prepare(`CREATE TRIGGER clone_catalog_change AFTER INSERT ON trips
      WHEN NEW.name = 'clone-fill-null-複製' BEGIN
        UPDATE pois SET rating = NULL, address = '共用資料的新地址' WHERE name = 'clone-fill-null poi 0';
      END`).run();
    try {
      const response = await runClone(src.token, withTripCreationFaults(db, [{ sql: /INSERT INTO trip_segments/, table: 'injected_fill_null_tail_failure' }]));
      expect(response.status).toBe(503);
      expect(await tripStructureCounts(db)).toEqual(before);
      expect(await rows('SELECT address, rating, country, source FROM pois WHERE name = ?', 'clone-fill-null poi 0')).toEqual([
        { address: '共用資料的新地址', rating: 4.5, country: 'TW', source: 'google' },
      ]);
      expect(await rows('SELECT COUNT(*) AS n FROM trip_entries e JOIN trip_days d ON d.id = e.day_id WHERE d.trip_id = ?', src.name)).toEqual([{ n: 4 }]);
    } finally { await db.prepare('DROP TRIGGER clone_catalog_change').run(); }
    expect((await runClone(src.token)).status).toBe(201);
    expect(await rows('SELECT COUNT(*) AS n FROM pois WHERE name = ?', 'clone-fill-null poi 0')).toEqual([{ n: 1 }]);
  });
  it('前 50 個 entry 已提交後，後批故障清完新結構、保留來源與共用 POI，60 筆重試成功', async () => {
    const src = await source('clone-late-entry', 60);
    const before = await tripStructureCounts(db);
    const sourceBefore = await sourceBody(src.name);
    let committed: Record<string, unknown>[] | undefined;
    const response = await runClone(src.token, withTripCreationFaults(db, [{ sql: /INSERT INTO trip_entries/, occurrence: 51, table: 'injected_late_entry_failure' }], async () => {
      committed = await rows('SELECT COUNT(*) AS n FROM trip_entries e JOIN trip_days d ON d.id = e.day_id JOIN trips t ON t.id = d.trip_id WHERE t.name = ?', `${src.name}-複製`);
    }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'SYS_DB_ERROR', detail: '複製失敗，請稍後重試' } });
    expect(committed).toEqual([{ n: 50 }]);
    expect(await tripStructureCounts(db)).toEqual(before);
    expect(await sourceBody(src.name)).toEqual(sourceBefore);
    const retry = await runClone(src.token);
    expect(retry.status).toBe(201);
    const { tripId } = await retry.json();
    expect(await rows('SELECT COUNT(*) AS n FROM trip_entries e JOIN trip_days d ON d.id = e.day_id WHERE d.trip_id = ?', tripId)).toEqual([{ n: 60 }]);
    expect(await rows('SELECT COUNT(*) AS n FROM trip_entry_pois ep JOIN trip_entries e ON e.id = ep.entry_id JOIN trip_days d ON d.id = e.day_id WHERE d.trip_id = ?', tripId)).toEqual([{ n: 120 }]);
    expect(await rows('SELECT COUNT(*) AS n FROM trip_segments WHERE trip_id = ?', tripId)).toEqual([{ n: 2 }]);
    expect(await rows('SELECT COUNT(*) AS n FROM audit_log WHERE trip_id = ?', tripId)).toEqual([{ n: 60 }]);
  }, 180000);
  it('保留 clone 筆記來源、原始 JSON 與預設；多天關聯、版本與 audit 對應新行程', async () => {
    const src = await source('clone-fidelity');
    const before = await sourceBody(src.name);
    const response = await runClone(src.token);
    expect(response.status).toBe(201);
    const { tripId, daysCreated, ok } = await response.json();
    expect({ daysCreated, ok }).toEqual({ daysCreated: 2, ok: true });
    expect(tripId).toMatch(/^cln-[0-9a-f-]{36}$/);
    expect(await rows('SELECT name, title, description, countries, lang, owner_user_id, published, data_source FROM trips WHERE id = ?', tripId)).toEqual([
      { name: 'clone-fidelity-複製', title: '旅程標題-複製', description: '旅程說明', countries: 'TW', lang: 'ja', owner_user_id: userIdFor(`${src.token}@test.com`), published: 0, data_source: 'cloned' },
    ]);
    expect(await rows('SELECT user_id, role FROM trip_permissions WHERE trip_id = ?', tripId)).toEqual([{ user_id: userIdFor(`${src.token}@test.com`), role: 'owner' }]);
    expect(await rows('SELECT dest_order, day_quota, sub_areas FROM trip_destinations WHERE trip_id = ?', tripId)).toEqual([{ dest_order: 1, day_quota: 0, sub_areas: '[ "北投" ]' }]);
    const entries = await rows('SELECT e.*, d.day_num FROM trip_entries e JOIN trip_days d ON d.id = e.day_id WHERE d.trip_id = ? ORDER BY e.id', tripId);
    expect(entries).toHaveLength(4);
    expect(entries[0]).toMatchObject({ day_num: 1, sort_order: 10, description: 'entry 0', source: 'ai', entry_pois_version: 1 });
    expect(entries[3]).toMatchObject({ day_num: 2, sort_order: 13, description: 'entry 3', source: 'user', entry_pois_version: 1 });
    expect(entries.every(e => !src.entries.includes(e.id as number))).toBe(true);
    expect(await rows('SELECT ep.sort_order, ep.description, ep.note, ep.reservation, ep.reservation_url FROM trip_entry_pois ep WHERE ep.entry_id = ? ORDER BY ep.sort_order', entries[0]!.id as number)).toEqual([
      { sort_order: 1, description: '正選說明', note: '正選備註', reservation: '正選預訂', reservation_url: 'https://example.com/master' },
      { sort_order: 2, description: '備選說明', note: '備選備註', reservation: '備選預訂', reservation_url: 'https://example.com/alternate' },
    ]);
    expect(await rows('SELECT d.day_num, p.name FROM trip_days d JOIN pois p ON p.id = d.hotel_poi_id WHERE d.trip_id = ?', tripId)).toEqual([{ day_num: 1, name: 'clone-fidelity poi 8' }]);
    const segments = await rows('SELECT * FROM trip_segments WHERE trip_id = ? ORDER BY id', tripId);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ from_entry_id: entries[0]!.id, to_entry_id: entries[1]!.id, mode: 'transit', submode: '火車', no_travel: 1, min: 20, source: 'manual', version: 0, computed_at: null });
    expect(segments[1]).toMatchObject({ from_entry_id: entries[1]!.id, to_entry_id: entries[3]!.id, source: 'google', no_travel: null, version: 0, computed_at: expect.any(Number) });
    expect(segments[1]!.computed_at).not.toBe(123);
    const audits = await rows('SELECT record_id, table_name, action, changed_by, diff_json FROM audit_log WHERE trip_id = ? ORDER BY id', tripId);
    expect(audits).toHaveLength(4);
    expect(audits[0]).toMatchObject({ record_id: entries[0]!.id, table_name: 'trip_entries', action: 'insert', changed_by: `${src.token}@test.com` });
    expect(JSON.parse(audits[0]!.diff_json as string)).toMatchObject({ via: 'share-clone', sourceTripId: src.name, sort_order: 10 });
    expect(await rows('SELECT sort_order, airline, flight_no, note FROM trip_flights WHERE trip_id = ?', tripId)).toEqual([{ sort_order: 0, airline: '長榮', flight_no: 'BR123', note: '航班備註' }]);
    expect(await rows('SELECT sort_order, name, booking_no, note FROM trip_lodgings WHERE trip_id = ?', tripId)).toEqual([{ sort_order: 0, name: '筆記旅館', booking_no: 'L123', note: '住宿備註' }]);
    expect(await rows('SELECT sort_order, kind, title, party_size, note FROM trip_reservations WHERE trip_id = ?', tripId)).toEqual([{ sort_order: 0, kind: 'restaurant', title: '午餐', party_size: 2, note: '預訂備註' }]);
    expect(await rows('SELECT sort_order, title, content, ai_generated, ai_source FROM trip_pretrip_notes WHERE trip_id = ?', tripId)).toEqual([{ sort_order: 0, title: '護照', content: '檢查效期', ai_generated: 1, ai_source: 'source-ai' }]);
    expect(await rows('SELECT sort_order, name, relationship, phone, email, kind, ai_generated FROM trip_emergency_contacts WHERE trip_id = ?', tripId)).toEqual([{ sort_order: 0, name: '家人', relationship: '姊姊', phone: '0912345678', email: 'family@example.com', kind: 'personal', ai_generated: 1 }]);
    expect(await sourceBody(src.name)).toEqual(before);
  });
});
