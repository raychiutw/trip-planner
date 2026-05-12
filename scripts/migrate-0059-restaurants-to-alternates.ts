#!/usr/bin/env bun
/**
 * migrate-0059-restaurants-to-alternates.ts — v2.28.0 Phase 1 backfill
 *
 * 把 `trip_pois` context='timeline' 的 rows 同步進 `trip_entry_pois` 當 alternates，
 * 讓 v2.27.0 EditEntryPage alternates section 看得到 user 既有的「備案餐廳/景點」。
 *
 * ## 背景
 *
 * `restaurants` legacy TABLE 自 v2.14 後完全 dead — restaurant 資料早就存在
 * `trip_pois` context='timeline' + `pois` type='restaurant'。v2.27.0 引入
 * `trip_entry_pois` master/alternates 但**沒**動 trip_pois — 結果 entry.alternates=[]
 * 但 entry.restaurants[] 有 2 個 (entry 424 user report)。
 *
 * 修法：trip_pois 既有 context='timeline' rows → INSERT 對應 trip_entry_pois
 * (sort_order = master_count + trip_pois.sort_order)。POI 已存在不需 find-or-create，
 * trip_pois 也不動 — 僅 trip_entry_pois 補 row 讓 alternates 系統看得到。
 *
 * ## Idempotency
 *
 * UNIQUE (entry_id, poi_id) on trip_entry_pois → INSERT OR IGNORE 重跑安全。
 * 已被當作 master 的 POI（trip_entry_pois sort_order=1）會被 UNIQUE 擋掉（同 poi_id），
 * 不會重複建 alternate row。
 *
 * ## Usage
 *
 * ```bash
 * # Local dev DB
 * bun run scripts/migrate-0059-restaurants-to-alternates.ts --dry-run
 * bun run scripts/migrate-0059-restaurants-to-alternates.ts --apply
 *
 * # Remote prod
 * bun run scripts/migrate-0059-restaurants-to-alternates.ts --dry-run --remote
 * bun run scripts/migrate-0059-restaurants-to-alternates.ts --apply --remote
 * ```
 *
 * ## Bump entry_pois_version
 *
 * 為每個受影響 entry bump trip_entries.entry_pois_version (v2.27.0 OCC counter)。
 * 確保 backfill 後 user 的舊 page state 收到 STALE_ENTRY 而 refetch — 否則他們的
 * EditEntryPage 仍以為自己看的是 0 個 alternates，後續 setMaster 帶舊 version=0
 * 會跟新狀態（有 alternates）的 version=1 衝突。
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const APPLY = args.includes('--apply');
const REMOTE = args.includes('--remote');

if (!DRY_RUN && !APPLY) {
  console.error('必須指定 --dry-run 或 --apply');
  process.exit(1);
}
if (DRY_RUN && APPLY) {
  console.error('--dry-run 與 --apply 不可同時使用');
  process.exit(1);
}

const DB_NAME = 'trip-planner-db';
const REPORT_DIR = path.join(__dirname, '..', '.gstack', 'migration-reports');
const TS = new Date().toISOString().replace(/[:.]/g, '-');
const REPORT_PATH = path.join(REPORT_DIR, `0059-restaurants-to-alternates-${TS}.json`);

fs.mkdirSync(REPORT_DIR, { recursive: true });

function d1Query(sql: string): unknown[] {
  const cmd = `wrangler d1 execute ${DB_NAME} ${REMOTE ? '--remote' : '--local'} --json --command ${JSON.stringify(sql)}`;
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const parsed = JSON.parse(out) as Array<{ results: unknown[] }>;
    return parsed[0]?.results ?? [];
  } catch (err: unknown) {
    const e = err as { stderr?: Buffer | string; stdout?: Buffer | string };
    console.error('D1 query failed:', e.stderr?.toString() ?? e.stdout?.toString() ?? err);
    throw err;
  }
}

function d1Exec(sql: string): { rowsAffected: number } {
  const cmd = `wrangler d1 execute ${DB_NAME} ${REMOTE ? '--remote' : '--local'} --json --command ${JSON.stringify(sql)}`;
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const parsed = JSON.parse(out) as Array<{ meta?: { rows_written?: number; changes?: number } }>;
    return { rowsAffected: parsed[0]?.meta?.rows_written ?? parsed[0]?.meta?.changes ?? 0 };
  } catch (err: unknown) {
    const e = err as { stderr?: Buffer | string };
    console.error('D1 exec failed:', e.stderr?.toString() ?? err);
    throw err;
  }
}

console.log(`\nMigration 0059 — restaurants (trip_pois timeline) → trip_entry_pois alternates`);
console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}`);
console.log(`Target: ${REMOTE ? 'REMOTE (production)' : 'LOCAL (.wrangler dev)'}\n`);

// Step 1: find candidate trip_pois rows that need an alternate row in trip_entry_pois
// 條件：
//   - trip_pois.context = 'timeline'
//   - trip_pois.entry_id IS NOT NULL
//   - 對應 (entry_id, poi_id) 還不在 trip_entry_pois (否則 INSERT OR IGNORE 也 skip 但統計會錯)
const candidates = d1Query(`
  SELECT tp.id AS tp_id, tp.entry_id, tp.poi_id, tp.sort_order AS tp_sort,
         p.name AS poi_name, p.type AS poi_type
  FROM trip_pois tp
  JOIN pois p ON p.id = tp.poi_id
  LEFT JOIN trip_entry_pois tep ON tep.entry_id = tp.entry_id AND tep.poi_id = tp.poi_id
  WHERE tp.context = 'timeline'
    AND tp.entry_id IS NOT NULL
    AND tep.id IS NULL
  ORDER BY tp.entry_id, tp.sort_order
`) as Array<{ tp_id: number; entry_id: number; poi_id: number; tp_sort: number; poi_name: string; poi_type: string }>;

console.log(`找到 ${candidates.length} 個 trip_pois rows 需要 backfill 成 alternates。\n`);

if (candidates.length === 0) {
  console.log('Nothing to migrate.');
  fs.writeFileSync(REPORT_PATH, JSON.stringify({ ts: TS, candidates: 0, applied: 0 }, null, 2));
  console.log(`Report: ${REPORT_PATH}`);
  process.exit(0);
}

// Group by entry_id
const byEntry = new Map<number, Array<{ poiId: number; tpSort: number; poiName: string; poiType: string }>>();
for (const c of candidates) {
  if (!byEntry.has(c.entry_id)) byEntry.set(c.entry_id, []);
  byEntry.get(c.entry_id)!.push({ poiId: c.poi_id, tpSort: c.tp_sort, poiName: c.poi_name, poiType: c.poi_type });
}

console.log(`受影響 entry 數: ${byEntry.size}\n`);

// Step 2: for each entry, find current max sort_order in trip_entry_pois
let totalInsertedAlternates = 0;
let totalBumpedEntries = 0;
const errors: Array<{ entryId: number; error: string }> = [];

for (const [entryId, items] of byEntry) {
  try {
    const maxRow = d1Query(`
      SELECT COALESCE(MAX(sort_order), 0) AS max_so FROM trip_entry_pois WHERE entry_id = ${entryId}
    `) as Array<{ max_so: number }>;
    const maxSo = maxRow[0]?.max_so ?? 0;

    let insertedForEntry = 0;
    let nextSo = maxSo;
    for (const item of items) {
      nextSo += 1;
      const sql = `
        INSERT OR IGNORE INTO trip_entry_pois (entry_id, poi_id, sort_order, added_at, updated_at)
        VALUES (${entryId}, ${item.poiId}, ${nextSo}, datetime('now'), datetime('now'))
      `;
      console.log(`  ${DRY_RUN ? '[DRY]' : '[APPLY]'} entry=${entryId} poi=${item.poiId} (${item.poiName} · ${item.poiType}) → trip_entry_pois.sort_order=${nextSo}`);
      if (APPLY) {
        const result = d1Exec(sql);
        if (result.rowsAffected > 0) insertedForEntry += 1;
      } else {
        insertedForEntry += 1; // dry-run estimate
      }
    }

    // Bump entry_pois_version so EditEntryPage clients re-fetch (避免 stale view)
    if (insertedForEntry > 0 && APPLY) {
      d1Exec(`UPDATE trip_entries SET entry_pois_version = entry_pois_version + 1 WHERE id = ${entryId}`);
      totalBumpedEntries += 1;
    } else if (insertedForEntry > 0) {
      totalBumpedEntries += 1; // dry-run estimate
    }
    totalInsertedAlternates += insertedForEntry;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ entry ${entryId} failed: ${msg}`);
    errors.push({ entryId, error: msg });
  }
}

console.log(`\n=== Summary ===`);
console.log(`Candidates:             ${candidates.length}`);
console.log(`Inserted alternates:    ${totalInsertedAlternates}${DRY_RUN ? ' (would insert)' : ''}`);
console.log(`Bumped entries:         ${totalBumpedEntries}${DRY_RUN ? ' (would bump)' : ''}`);
console.log(`Errors:                 ${errors.length}`);

const report = {
  ts: TS,
  mode: DRY_RUN ? 'dry-run' : 'apply',
  remote: REMOTE,
  candidates: candidates.length,
  affectedEntries: byEntry.size,
  inserted: totalInsertedAlternates,
  bumpedVersions: totalBumpedEntries,
  errors,
  details: APPLY ? null : Array.from(byEntry.entries()).map(([entryId, items]) => ({ entryId, items })),
};
fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
console.log(`\nReport: ${REPORT_PATH}`);

if (errors.length > 0) {
  console.error('\n⚠️  Errors occurred — review report');
  process.exit(1);
}
