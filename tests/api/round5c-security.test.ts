/**
 * round5c-security.test.ts — v2.33.43 security audit final batch
 *
 * 原本是純 source-grep（讀三個原始檔比對字串）。改走 HTTP 邊界，驗 3 個 fix 的實際行為：
 *  1. middleware checkCsrf Bearer 也走 Origin check (defense in depth)
 *  2. entries/[eid].ts catch 對 UNIQUE / FK constraint re-classify 為 409
 *  3. trip-pois.ts INSERT + UPDATE entry_pois_version 進 db.batch (atomic)
 *
 * 第 2 項的 UNIQUE / FK 約束在目前 schema 並不存在（trip_entries 沒有 (day_id, sort_order) UNIQUE，
 * 子表 FK 皆 CASCADE / SET NULL），所以測試暫時建立一個會觸發約束的 index／子表，驗完即拆除。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, seedTrip, seedEntry, getDayId } from './helpers';
import { createApi, type Api } from './http';
import { cleanupTrips } from './cleanup-trips';

const BASE = 'https://test.com';
const OWNER = 'r5c-owner@test.com';
const TRIP = 'r5c-trip';
let db: D1Database;
let api: Api;
let dayId: number;

beforeAll(async () => {
  db = await createTestDb();
  api = createApi({ env: mockEnv(db) });
  await seedTrip(db, { id: TRIP, owner: OWNER, days: 2 });
  dayId = await getDayId(db, TRIP, 1);
});

afterAll(async () => {
  await db.prepare('DROP INDEX IF EXISTS tmp_r5c_entries_unique').run();
  await db.prepare('DROP TABLE IF EXISTS tmp_r5c_child').run();
  await db.prepare('DELETE FROM audit_log WHERE trip_id = ?').bind(TRIP).run();
  await cleanupTrips(db, [TRIP], ['r5c-%']);
  await disposeMiniflare();
});

async function descriptionOf(entryId: number): Promise<string | null> {
  return (await db.prepare('SELECT description FROM trip_entries WHERE id = ?').bind(entryId).first<{ description: string | null }>())?.description ?? null;
}

describe('v2.33.43 round 5c — middleware Bearer CSRF defense in depth', () => {
  it('Bearer 走 Origin allowlist check (如有 Origin)', async () => {
    const entryId = await seedEntry(db, dayId, { sortOrder: 90 });
    const token = await api.tokenFor(OWNER);
    const patch = (origin?: string) => api.request('PATCH', `${BASE}/api/trips/${TRIP}/entries/${entryId}`, {
      bearer: token,
      headers: origin ? { Origin: origin } : {},
      json: { description: `by-${origin ?? 'none'}` },
    });

    // 不明 Origin：即使帶合法 Bearer 也擋（XSS 偷走的 token 從 evil.com 發請求）
    const evil = await patch('https://evil.com');
    expect(evil.status).toBe(403);
    expect(await descriptionOf(entryId)).toBeNull();

    // 合法 Origin、或沒有 Origin（CLI / 排程）：放行並寫入
    const ok = await patch('https://trip-planner-dby.pages.dev');
    expect(ok.status).toBe(200);
    expect(await descriptionOf(entryId)).toBe('by-https://trip-planner-dby.pages.dev');
    const cli = await patch();
    expect(cli.status).toBe(200);
    expect(await descriptionOf(entryId)).toBe('by-none');
  });

  // 註解內容本身不是可觀察的行為，沒有對應的 HTTP 斷言；保留原始碼比對，交給 #1503。
  it('comment 標 v2.33.43 audit context（原始碼比對，待 #1503）', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../functions/api/_middleware.ts'), 'utf-8');
    expect(src).toMatch(/v2\.33\.43.+Bearer/);
  });
});

describe('v2.33.43 round 5c — entries/[eid] catch re-classify', () => {
  it('PATCH catch UNIQUE → DATA_CONFLICT (409)', async () => {
    const day2 = await getDayId(db, TRIP, 2);
    const a = await seedEntry(db, day2, { sortOrder: 1 });
    const b = await seedEntry(db, day2, { sortOrder: 2 });
    await db.prepare('CREATE UNIQUE INDEX tmp_r5c_entries_unique ON trip_entries(day_id, sort_order)').run();
    try {
      const res = await api.request('PATCH', `${BASE}/api/trips/${TRIP}/entries/${b}`, {
        as: OWNER,
        json: { sort_order: 1 },
      });
      expect(res.status).toBe(409);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('DATA_CONFLICT');
      const row = await db.prepare('SELECT sort_order FROM trip_entries WHERE id = ?').bind(b).first<{ sort_order: number }>();
      expect(row?.sort_order).toBe(2); // 沒被寫進去
    } finally {
      await db.prepare('DROP INDEX IF EXISTS tmp_r5c_entries_unique').run();
    }
    expect(a).not.toBe(b);
  });

  it('DELETE catch FK → DATA_CONFLICT (409)', async () => {
    const entryId = await seedEntry(db, dayId, { sortOrder: 91 });
    await db.prepare('CREATE TABLE tmp_r5c_child (id INTEGER PRIMARY KEY, entry_id INTEGER REFERENCES trip_entries(id))').run();
    try {
      await db.prepare('INSERT INTO tmp_r5c_child (entry_id) VALUES (?)').bind(entryId).run();
      const res = await api.request('DELETE', `${BASE}/api/trips/${TRIP}/entries/${entryId}`, { as: OWNER });
      expect(res.status).toBe(409);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('DATA_CONFLICT');
      const still = await db.prepare('SELECT 1 FROM trip_entries WHERE id = ?').bind(entryId).first();
      expect(still).not.toBeNull();
    } finally {
      await db.prepare('DROP TABLE IF EXISTS tmp_r5c_child').run();
    }
  });
});

describe('v2.33.43 round 5c — trip-pois.ts atomic batch', () => {
  const versionOf = async (entryId: number) =>
    (await db.prepare('SELECT entry_pois_version AS v FROM trip_entries WHERE id = ?').bind(entryId).first<{ v: number }>())!.v;
  const addPoi = (entryId: number, name: string) =>
    api.request('POST', `${BASE}/api/trips/${TRIP}/entries/${entryId}/trip-pois`, {
      as: OWNER,
      json: { name, type: 'attraction' },
    });

  it('INSERT + UPDATE entry_pois_version 同 db.batch([...])', async () => {
    const entryId = await seedEntry(db, dayId, { sortOrder: 92 });
    expect(await versionOf(entryId)).toBe(0);
    const res = await addPoi(entryId, 'r5c-poi-atomic');
    expect(res.status).toBe(201);
    // 新增成功 → INSERT 與 version bump 一起落地
    const rows = await db.prepare('SELECT COUNT(*) AS n FROM trip_entry_pois WHERE entry_id = ?').bind(entryId).first<{ n: number }>();
    expect(rows!.n).toBe(1);
    expect(await versionOf(entryId)).toBe(1);
  });

  it('UNIQUE handling 留住（rollback 後 re-classify）', async () => {
    const entryId = await seedEntry(db, dayId, { sortOrder: 93 });
    expect((await addPoi(entryId, 'r5c-poi-dup')).status).toBe(201);
    const versionAfterFirst = await versionOf(entryId);

    const dup = await addPoi(entryId, 'r5c-poi-dup');
    expect(dup.status).toBe(409);
    const err = ((await dup.json()) as { error: { code: string; detail?: string } }).error;
    expect(err.code).toBe('DATA_CONFLICT');
    expect(err.detail).toBe('此 POI 已存在於該 entry');
    // batch 失敗整批 rollback：沒有多一筆、version 也沒被 bump
    const rows = await db.prepare('SELECT COUNT(*) AS n FROM trip_entry_pois WHERE entry_id = ?').bind(entryId).first<{ n: number }>();
    expect(rows!.n).toBe(1);
    expect(await versionOf(entryId)).toBe(versionAfterFirst);
  });
});
