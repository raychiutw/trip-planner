// @vitest-environment node
/**
 * Migration 0078 — backfill trip_entries.note → master trip_entry_pois.note + DROP COLUMN
 *
 * 對應 per-POI 備註 cutover（方案 B 單一 PR 直接 DROP）：
 *   1. backfill：對每個 entry 的 master row（sort_order=1）
 *      - master note 空 → SET = trip_entries.note
 *      - 兩者皆非空 → SET = trip_entry_pois.note || char(10) || trip_entries.note（換行串接）
 *      - 只處理 trip_entries.note 非空者
 *      - entry 無 master row → 不可炸（資料原樣保留，note 無處可掛即丟棄）
 *   2. DROP COLUMN trip_entries.note
 *
 * 注意：API test 共用的 Miniflare D1（tests/api/setup.ts）會把「全部」migration（含 0078）
 * 跑一次，所以 schema 斷言（note 欄位已消失）在這個共用 DB 上直接驗即可——這正是
 * 「套到 local D1 驗證欄位已消失」。但 backfill 的「資料效果」必須在 0078 套用「之前」就有
 * legacy 資料才驗得到；共用 DB 已套完 0078，無法回頭塞 trip_entries.note。
 *
 * 因此 backfill 的 3 種合併情境改用「獨立 Miniflare 實例 + 手動套到 0077 → 塞資料 → 套 0078」
 * 的方式驗（migrateUpTo helper），與既有 migration test 對共用 DB 只驗 schema 的慣例互補。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Miniflare } from 'miniflare';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createTestDb, disposeMiniflare } from '../api/setup';

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

/** 把單一 .sql 拆成可逐條 run 的 statement（與 setup.ts extractStatements 同邏輯）。 */
function extractStatements(sql: string): string[] {
  const cleaned = sql.replace(/--[^\n]*/g, '');
  return cleaned
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * 建立一個全新的 Miniflare D1，套用「檔名 <= upToInclusive」的所有 migration。
 * 用來在 0078 套用「之前」塞 legacy trip_entries.note 資料以驗 backfill。
 */
async function freshDbUpTo(upToInclusive: string): Promise<{ db: D1Database; mf: Miniflare }> {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: ['DB'],
  });
  const db = await mf.getD1Database('DB');
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.includes('rollback'))
    .sort()
    .filter((f) => f <= upToInclusive);
  for (const f of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
    for (const stmt of extractStatements(sql)) {
      await db.prepare(stmt).run();
    }
  }
  return { db, mf };
}

/** 套用單一 migration 檔。 */
async function applyMigration(db: D1Database, fileName: string): Promise<void> {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, fileName), 'utf8');
  for (const stmt of extractStatements(sql)) {
    await db.prepare(stmt).run();
  }
}

/** seed 一個 trip + 1 個 day + 1 個 entry（回傳 entryId）。
 *  trips.owner_user_id NOT NULL REFERENCES users(id)（migration 0047），所以先補 user + trip。 */
async function seedEntryRow(db: D1Database, tripId: string, note: string | null): Promise<number> {
  const ownerUserId = `u-${tripId}`;
  await db
    .prepare("INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)")
    .bind(ownerUserId, `${tripId}@test.com`, tripId)
    .run();
  await db
    .prepare("INSERT OR IGNORE INTO trips (id, name, owner_user_id, title, countries, published) VALUES (?, ?, ?, ?, 'JP', 1)")
    .bind(tripId, tripId, ownerUserId, `T-${tripId}`)
    .run();
  const day = await db
    .prepare("INSERT INTO trip_days (trip_id, day_num, date, day_of_week, label) VALUES (?, 1, '2026-06-02', '一', 'Day 1') RETURNING id")
    .bind(tripId)
    .first<{ id: number }>();
  const entry = await db
    // This fresh DB intentionally stops before migration 0081, where the legacy
    // NOT NULL title column still exists. Current runtime/tests do not write it.
    .prepare("INSERT INTO trip_entries (day_id, sort_order, start_time, title, note) VALUES (?, 1, '10:00', 'legacy', ?) RETURNING id")
    .bind(day!.id, note)
    .first<{ id: number }>();
  return entry!.id;
}

/** seed 一個 poi（回傳 id）。 */
async function seedPoiRow(db: D1Database, name: string): Promise<number> {
  const poi = await db
    .prepare("INSERT INTO pois (type, name) VALUES ('attraction', ?) RETURNING id")
    .bind(name)
    .first<{ id: number }>();
  return poi!.id;
}

describe('migration 0078 — schema：trip_entries.note 已 DROP（共用 DB，全 migration 已套）', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30000);

  afterAll(disposeMiniflare);

  it('trip_entries 不再有 note 欄位', async () => {
    const { results } = await db
      .prepare("PRAGMA table_info('trip_entries')")
      .all<{ name: string }>();
    const names = results.map((r) => r.name);
    expect(names).not.toContain('note');
  });

  it('trip_entry_pois.note 欄位仍存在（per-POI 備註的新家）', async () => {
    const { results } = await db
      .prepare("PRAGMA table_info('trip_entry_pois')")
      .all<{ name: string }>();
    const names = results.map((r) => r.name);
    expect(names).toContain('note');
  });
});

describe('migration 0078 — backfill 合併策略（單一 fresh DB：套到 0077 → 塞所有情境 → 套 0078 一次）', () => {
  // v2.33.84 教訓：unit-node project 不強制單 worker，per-test new Miniflare 會 port 競爭 +
  // 每次重套 78 個 migration 過慢 timeout。改成「一個 fresh Miniflare、所有情境一次 seed、
  // 套 0078 一次、各自斷言」，把 5 instance × 78 migration 收斂成 1 × 78。
  let db: D1Database;
  let mf: Miniflare;
  const ids: Record<string, number> = {};

  beforeAll(async () => {
    const fresh = await freshDbUpTo('0077_trip_shares_anonymous.sql');
    db = fresh.db;
    mf = fresh.mf;

    // 情境 A：master note 空 → 用 entry note
    ids.aEntry = await seedEntryRow(db, 'm78-empty-master', '整體備註 A');
    const aPoi = await seedPoiRow(db, 'POI-A');
    await db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order, note) VALUES (?, ?, 1, NULL)').bind(ids.aEntry, aPoi).run();

    // 情境 B：master note 與 entry note 皆非空 → 換行串接（poi note 在前）
    ids.bEntry = await seedEntryRow(db, 'm78-both', '整體備註 B');
    const bPoi = await seedPoiRow(db, 'POI-B');
    await db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order, note) VALUES (?, ?, 1, ?)').bind(ids.bEntry, bPoi, '正選備註 B').run();

    // 情境 C：entry note = NULL → master note 不變
    ids.cNull = await seedEntryRow(db, 'm78-entry-null', null);
    const cNullPoi = await seedPoiRow(db, 'POI-C-null');
    await db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order, note) VALUES (?, ?, 1, ?)').bind(ids.cNull, cNullPoi, '正選備註 C').run();

    // 情境 D：entry note = '' 空字串 → master note 不變（不串接空白）
    ids.dEmpty = await seedEntryRow(db, 'm78-entry-empty', '');
    const dEmptyPoi = await seedPoiRow(db, 'POI-C-empty');
    await db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order, note) VALUES (?, ?, 1, ?)').bind(ids.dEmpty, dEmptyPoi, '正選備註 D').run();

    // 情境 E：entry 無 master row（無 trip_entry_pois）→ migration 不炸
    ids.eNoMaster = await seedEntryRow(db, 'm78-no-master', '孤兒備註');

    // 情境 F：backfill 只動 master，不污染 alternate
    ids.fEntry = await seedEntryRow(db, 'm78-alt-untouched', '整體備註 E');
    const fMaster = await seedPoiRow(db, 'POI-E-master');
    const fAlt = await seedPoiRow(db, 'POI-E-alt');
    await db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order, note) VALUES (?, ?, 1, NULL)').bind(ids.fEntry, fMaster).run();
    await db.prepare('INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order, note) VALUES (?, ?, 2, ?)').bind(ids.fEntry, fAlt, '備選原備註').run();

    // 套用 0078（含 backfill + DROP COLUMN）一次
    await applyMigration(db, '0078_drop_trip_entries_note.sql');
  }, 60000);

  afterAll(async () => {
    await mf.dispose();
  });

  async function masterNote(entryId: number): Promise<string | null> {
    const row = await db.prepare('SELECT note FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1').bind(entryId).first<{ note: string | null }>();
    return row ? row.note : null;
  }

  it('master note 空 → 用 entry note', async () => {
    expect(await masterNote(ids.aEntry!)).toBe('整體備註 A');
  });

  it('master note 已存在 + entry note 也存在 → 換行串接（poi note 在前）', async () => {
    expect(await masterNote(ids.bEntry!)).toBe('正選備註 B\n整體備註 B');
  });

  it('entry note = NULL → master note 不變', async () => {
    expect(await masterNote(ids.cNull!)).toBe('正選備註 C');
  });

  it('entry note = 空字串 → master note 不變（不串接空白）', async () => {
    expect(await masterNote(ids.dEmpty!)).toBe('正選備註 D');
  });

  it('entry 無 master row → migration 不炸，無資料可寫', async () => {
    const cnt = await db.prepare('SELECT COUNT(*) AS n FROM trip_entry_pois WHERE entry_id = ?').bind(ids.eNoMaster).first<{ n: number }>();
    expect(cnt!.n).toBe(0);
  });

  it('backfill 只動 master（sort_order=1），不污染 alternate 的 note', async () => {
    expect(await masterNote(ids.fEntry!)).toBe('整體備註 E');
    const alt = await db.prepare('SELECT note FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 2').bind(ids.fEntry).first<{ note: string | null }>();
    expect(alt!.note).toBe('備選原備註');
  });

  it('0078 套用後該 fresh DB 的 trip_entries 也沒有 note 欄位', async () => {
    const { results } = await db.prepare("PRAGMA table_info('trip_entries')").all<{ name: string }>();
    expect(results.map((r) => r.name)).not.toContain('note');
  });
});
