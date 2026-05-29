/**
 * Integration test — v2.34.39 PR39 (PR35 P1 gap)
 *
 * 涵蓋兩個 endpoint:
 *   - POST /api/pois/find-or-create — POI master 入庫 + dedup
 *   - POST /api/trips/:id/entries/:eid/trip-pois — entry alternate POI（含 audit_log）
 *
 * 對齊 PR32 trip mutation audit_log + PR35 doc 標 P1 MEDIUM gap。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockContext, mockAuth, seedUser, seedTrip, seedEntry, callHandler, jsonRequest, getDayId } from './helpers';
import { onRequestPost as findOrCreate } from '../../functions/api/pois/find-or-create';
import { onRequestPost as addEntryPoi } from '../../functions/api/trips/[id]/entries/[eid]/trip-pois';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;
const ownerEmail = 'owner-pr39@test.com';
const strangerEmail = 'stranger-pr39@test.com';
const tripId = 'trip-pr39';

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedUser(db, ownerEmail);
  await seedUser(db, strangerEmail);
  await seedTrip(db, { id: tripId, owner: ownerEmail });
});

afterAll(disposeMiniflare);

describe('POST /api/pois/find-or-create — PR39', () => {
  async function callFindOrCreate(body: Record<string, unknown>, email = ownerEmail) {
    return callHandler(findOrCreate, mockContext({
      request: jsonRequest('https://test/api/pois/find-or-create', 'POST', body),
      env,
      auth: mockAuth({ email }),
      params: {},
    }));
  }

  it('缺 name → 400 DATA_VALIDATION', async () => {
    const res = await callFindOrCreate({ type: 'restaurant' });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string; detail?: string } };
    expect(body.error.code).toBe('DATA_VALIDATION');
    expect(body.error.detail).toContain('name');
  });

  it('缺 type → 400 DATA_VALIDATION', async () => {
    const res = await callFindOrCreate({ name: 'Foo' });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string; detail?: string } };
    expect(body.error.detail).toContain('type');
  });

  it('name trim 空字串 → 400', async () => {
    const res = await callFindOrCreate({ name: '   ', type: 'restaurant' });
    expect(res.status).toBe(400);
  });

  it('正常 POST → 200 + id (newly created in pois table)', async () => {
    const res = await callFindOrCreate({
      name: 'PR39 拉麵店',
      type: 'restaurant',
      lat: 35.6,
      lng: 139.7,
      address: '東京都新宿区',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { id: number };
    expect(body.id).toBeGreaterThan(0);
    const row = await db.prepare('SELECT name, type FROM pois WHERE id = ?').bind(body.id).first<{ name: string; type: string }>();
    expect(row!.name).toBe('PR39 拉麵店');
    expect(row!.type).toBe('restaurant');
  });

  it('重複 POST same name+type → 同 id (dedup via findOrCreatePoi)', async () => {
    const first = await callFindOrCreate({ name: 'PR39 dedup 店', type: 'restaurant' });
    const a = await first.json() as { id: number };
    const second = await callFindOrCreate({ name: 'PR39 dedup 店', type: 'restaurant' });
    const b = await second.json() as { id: number };
    expect(b.id).toBe(a.id);
  });
});

describe('POST /api/trips/:id/entries/:eid/trip-pois — PR39', () => {
  let dayId: number;
  let entryId: number;

  beforeAll(async () => {
    dayId = await getDayId(db, tripId, 1);
    entryId = await seedEntry(db, dayId, { sortOrder: 1, title: 'PR39 entry' });
  });

  async function callAddPoi(body: Record<string, unknown>, eidOverride: string | number = entryId, email = ownerEmail) {
    return callHandler(addEntryPoi, mockContext({
      request: jsonRequest(`https://test/api/trips/${tripId}/entries/${eidOverride}/trip-pois`, 'POST', body),
      env,
      auth: mockAuth({ email }),
      params: { id: tripId, eid: String(eidOverride) },
    }));
  }

  it('entry id 格式錯（非數字）→ 400 DATA_VALIDATION', async () => {
    const res = await callAddPoi({ name: 'x', type: 'restaurant' }, 'abc');
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string; detail?: string } };
    expect(body.error.detail).toContain('entry');
  });

  it('沒 write perm（stranger）→ 403 PERM_DENIED', async () => {
    const res = await callAddPoi({ name: 'x', type: 'restaurant' }, entryId, strangerEmail);
    expect(res.status).toBe(403);
  });

  it('缺 name / type → 400 DATA_VALIDATION', async () => {
    const res = await callAddPoi({ name: 'only-name' });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string; detail?: string } };
    expect(body.error.detail).toContain('name');
  });

  it('正常 POST → 201 + result row + entry_pois_version 加 1 + audit_log 寫入', async () => {
    const before = await db.prepare('SELECT entry_pois_version FROM trip_entries WHERE id = ?').bind(entryId).first<{ entry_pois_version: number }>();

    const res = await callAddPoi({
      name: 'PR39 entry POI',
      type: 'restaurant',
      lat: 35.6,
      lng: 139.7,
      note: 'happy hour',
    });
    expect(res.status).toBe(201);
    // json() helper auto-deepCamel → snake_case keys → camelCase
    const row = await res.json() as { id: number; entryId: number; poiId: number; sortOrder: number };
    expect(row.entryId).toBe(entryId);
    expect(row.poiId).toBeGreaterThan(0);
    expect(row.sortOrder).toBeGreaterThanOrEqual(1);

    // entry_pois_version 加 1
    const after = await db.prepare('SELECT entry_pois_version FROM trip_entries WHERE id = ?').bind(entryId).first<{ entry_pois_version: number }>();
    expect(after!.entry_pois_version).toBe((before?.entry_pois_version ?? 0) + 1);

    // audit_log 寫入（PR32 already integrated）
    const audit = await db
      .prepare(`SELECT changed_by, table_name FROM audit_log WHERE trip_id = ? AND table_name = 'trip_entry_pois' ORDER BY id DESC LIMIT 1`)
      .bind(tripId)
      .first<{ changed_by: string; table_name: string }>();
    expect(audit?.changed_by).toBe(ownerEmail);
  });

  it('重複 POI 同 entry → 409 DATA_CONFLICT', async () => {
    // 先建立第一個
    const first = await callAddPoi({ name: 'PR39 duplicate', type: 'restaurant' });
    expect(first.status).toBe(201);

    // 同 name+type 第二次
    const dup = await callAddPoi({ name: 'PR39 duplicate', type: 'restaurant' });
    expect(dup.status).toBe(409);
    const body = await dup.json() as { error: { code: string } };
    expect(body.error.code).toBe('DATA_CONFLICT');
  });
});
