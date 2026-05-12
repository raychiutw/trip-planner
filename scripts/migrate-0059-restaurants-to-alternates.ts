#!/usr/bin/env bun
/**
 * migrate-0059-restaurants-to-alternates.ts — meal stop primary POI backfill
 *
 * 舊資料有一批用餐 entry 的 master POI 仍是商圈/景點 wrapper，而真正的餐廳選擇
 * 存在 `trip_pois.context='timeline'`。這會讓「設定餐廳為首選」後，行程一覽仍看
 * 到舊 wrapper，因為 overview 讀的是 stop 的 canonical POI。
 *
 * 本 backfill 對「用餐 entry + restaurant choices」執行：
 *   1. 依 `trip_pois.sort_order` 排序餐廳選擇。
 *   2. 將第一順位餐廳寫成 `trip_entry_pois.sort_order=1`。
 *   3. 其餘餐廳接在後面，既有非餐廳 stop_pois 保留並往後移。
 *   4. 同步 `trip_entries.poi_id` 到第一順位餐廳，讓 legacy list/overview 立即一致。
 *   5. bump `trip_entries.entry_pois_version`，讓舊編輯頁 state refetch。
 *
 * ## Idempotency
 *
 * 每個 entry 先用 pure planner 算 desired order。若 `trip_entries.poi_id` 與
 * `trip_entry_pois` 順序已一致，直接 skip。套用時用 temporary sort offset +
 * upsert，避免 UNIQUE(entry_id, sort_order) / UNIQUE(entry_id, poi_id) swap collision，
 * 同時維持 D1 remote-compatible SQL（不包 explicit transaction）。
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
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildMealStopPrimaryPoiApplySql,
  planMealStopPrimaryPoiBackfill,
  sqlPositiveInteger,
  type ExistingStopPoiRow,
  type MealStopBackfillInput,
  type MealStopPrimaryPoiPlan,
  type RestaurantChoiceRow,
} from './lib/meal-stop-primary-poi-backfill';

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
const REPORT_PATH = path.join(REPORT_DIR, `0059-meal-stop-primary-poi-${TS}.json`);

fs.mkdirSync(REPORT_DIR, { recursive: true });

type D1JsonRow = {
  results?: unknown[];
  meta?: {
    rows_written?: number;
    changes?: number;
  };
};

type RestaurantCandidateRow = {
  entry_id: number;
  title: string | null;
  description: string | null;
  note: string | null;
  current_poi_id: number | null;
  tp_id: number;
  poi_id: number;
  tp_sort: number | null;
  poi_name: string | null;
  poi_type: string | null;
};

type ExistingStopPoiQueryRow = {
  entry_id: number;
  poi_id: number;
  sort_order: number;
  poi_name: string | null;
};

type PlannedDetail = {
  entryId: number;
  title: string | null;
  firstRestaurantPoiId: number;
  firstRestaurantName: string | null;
  desiredPoiIds: number[];
  changed: boolean;
};

function flattenSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

function d1Args(extra: string[]): string[] {
  return ['d1', 'execute', DB_NAME, REMOTE ? '--remote' : '--local', '--json', ...extra];
}

function parseD1Json(out: string): D1JsonRow[] {
  return JSON.parse(out) as D1JsonRow[];
}

function d1Query(sql: string): unknown[] {
  const flat = flattenSql(sql);
  try {
    const out = execFileSync('wrangler', d1Args(['--command', flat]), {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return parseD1Json(out)[0]?.results ?? [];
  } catch (err: unknown) {
    const e = err as { stderr?: Buffer | string; stdout?: Buffer | string };
    console.error('D1 query failed:', e.stderr?.toString() ?? e.stdout?.toString() ?? err);
    throw err;
  }
}

function d1Exec(sql: string): { rowsAffected: number } {
  const flat = flattenSql(sql);
  try {
    const out = execFileSync('wrangler', d1Args(['--command', flat]), {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = parseD1Json(out);
    return {
      rowsAffected: parsed.reduce(
        (sum, row) => sum + (row.meta?.rows_written ?? row.meta?.changes ?? 0),
        0,
      ),
    };
  } catch (err: unknown) {
    const e = err as { stderr?: Buffer | string; stdout?: Buffer | string };
    console.error('D1 exec failed:', e.stderr?.toString() ?? e.stdout?.toString() ?? err);
    throw err;
  }
}

function pushUnique<T>(list: T[], value: T): void {
  if (!list.includes(value)) list.push(value);
}

function firstRestaurantName(input: MealStopBackfillInput, plan: MealStopPrimaryPoiPlan): string | null {
  return input.restaurants.find((row) => row.poiId === plan.firstRestaurantPoiId)?.poiName ?? null;
}

console.log('\nMigration 0059 — meal stop primary POI backfill');
console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}`);
console.log(`Target: ${REMOTE ? 'REMOTE (production)' : 'LOCAL (.wrangler dev)'}\n`);

const candidateRows = d1Query(`
  SELECT e.id AS entry_id,
         e.title,
         e.description,
         e.note,
         e.poi_id AS current_poi_id,
         tp.id AS tp_id,
         tp.poi_id,
         tp.sort_order AS tp_sort,
         p.name AS poi_name,
         p.type AS poi_type
  FROM trip_entries e
  JOIN trip_pois tp ON tp.entry_id = e.id AND tp.context = 'timeline'
  JOIN pois p ON p.id = tp.poi_id
  WHERE p.type = 'restaurant'
  ORDER BY e.id, COALESCE(tp.sort_order, 0), tp.id
`) as RestaurantCandidateRow[];

const entryIds: number[] = [];
for (const row of candidateRows) {
  pushUnique(entryIds, row.entry_id);
}

if (entryIds.length === 0) {
  console.log('找不到任何有餐廳 choice 的 timeline entry。Nothing to migrate.');
  fs.writeFileSync(
    REPORT_PATH,
    JSON.stringify({ ts: TS, mode: DRY_RUN ? 'dry-run' : 'apply', remote: REMOTE, affectedEntries: 0 }, null, 2),
  );
  console.log(`Report: ${REPORT_PATH}`);
  process.exit(0);
}

const existingRows = d1Query(`
  SELECT tep.entry_id,
         tep.poi_id,
         tep.sort_order,
         p.name AS poi_name
  FROM trip_entry_pois tep
  LEFT JOIN pois p ON p.id = tep.poi_id
  WHERE tep.entry_id IN (${entryIds.map((id) => sqlPositiveInteger(id, 'entry_id')).join(',')})
  ORDER BY tep.entry_id, tep.sort_order
`) as ExistingStopPoiQueryRow[];

const inputsByEntry = new Map<number, MealStopBackfillInput>();

for (const row of candidateRows) {
  let input = inputsByEntry.get(row.entry_id);
  if (!input) {
    input = {
      entryId: row.entry_id,
      title: row.title,
      description: row.description,
      note: row.note,
      currentEntryPoiId: row.current_poi_id,
      existingStopPois: [],
      restaurants: [],
    };
    inputsByEntry.set(row.entry_id, input);
  }
  input.restaurants.push({
    poiId: row.poi_id,
    tripPoiId: row.tp_id,
    tripPoiSortOrder: row.tp_sort,
    poiName: row.poi_name,
    poiType: row.poi_type,
  } satisfies RestaurantChoiceRow);
}

for (const row of existingRows) {
  const input = inputsByEntry.get(row.entry_id);
  if (!input) continue;
  input.existingStopPois.push({
    poiId: row.poi_id,
    sortOrder: row.sort_order,
    poiName: row.poi_name,
  } satisfies ExistingStopPoiRow);
}

const plans: Array<{ input: MealStopBackfillInput; plan: MealStopPrimaryPoiPlan }> = [];
const unchanged: PlannedDetail[] = [];
const skippedNotMeal: Array<{ entryId: number; title: string | null }> = [];

for (const input of inputsByEntry.values()) {
  const plan = planMealStopPrimaryPoiBackfill(input);
  if (!plan) {
    skippedNotMeal.push({ entryId: input.entryId, title: input.title ?? null });
    continue;
  }
  const detail: PlannedDetail = {
    entryId: input.entryId,
    title: input.title ?? null,
    firstRestaurantPoiId: plan.firstRestaurantPoiId,
    firstRestaurantName: firstRestaurantName(input, plan),
    desiredPoiIds: plan.desiredPoiIds,
    changed: plan.changed,
  };
  if (plan.changed) {
    plans.push({ input, plan });
  } else {
    unchanged.push(detail);
  }
}

console.log(`有餐廳 choice 的 entry: ${inputsByEntry.size}`);
console.log(`需升級的用餐 entry:   ${plans.length}`);
console.log(`已符合新結構:         ${unchanged.length}`);
console.log(`非用餐 entry 略過:     ${skippedNotMeal.length}\n`);

let applied = 0;
const errors: Array<{ entryId: number; error: string }> = [];
const plannedDetails: PlannedDetail[] = [];

for (const { input, plan } of plans) {
  const detail: PlannedDetail = {
    entryId: input.entryId,
    title: input.title ?? null,
    firstRestaurantPoiId: plan.firstRestaurantPoiId,
    firstRestaurantName: firstRestaurantName(input, plan),
    desiredPoiIds: plan.desiredPoiIds,
    changed: plan.changed,
  };
  plannedDetails.push(detail);
  console.log(
    `  ${DRY_RUN ? '[DRY]' : '[APPLY]'} entry=${input.entryId} ${input.title ?? '(untitled)'} ` +
      `→ master poi=${plan.firstRestaurantPoiId}` +
      `${detail.firstRestaurantName ? ` (${detail.firstRestaurantName})` : ''}; ` +
      `stop_pois=${plan.desiredPoiIds.join(',')}`,
  );

  if (!APPLY) continue;

  try {
    d1Exec(buildMealStopPrimaryPoiApplySql(plan));
    applied += 1;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push({ entryId: input.entryId, error: msg });
  }
}

console.log('\n=== Summary ===');
console.log(`Candidates with restaurants: ${inputsByEntry.size}`);
console.log(`Would change / changed:      ${plans.length}${DRY_RUN ? ' (would change)' : ''}`);
console.log(`Applied entries:             ${applied}`);
console.log(`Already current:             ${unchanged.length}`);
console.log(`Skipped non-meal:            ${skippedNotMeal.length}`);
console.log(`Errors:                      ${errors.length}`);

const report = {
  ts: TS,
  mode: DRY_RUN ? 'dry-run' : 'apply',
  remote: REMOTE,
  candidatesWithRestaurants: inputsByEntry.size,
  plannedChanges: plans.length,
  applied,
  alreadyCurrent: unchanged,
  skippedNotMeal,
  errors,
  details: plannedDetails,
};
fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
console.log(`\nReport: ${REPORT_PATH}`);

if (errors.length > 0) {
  console.error('\nErrors occurred — review report');
  process.exit(1);
}
