/**
 * init-local-db.js TABLES 順序測試
 *
 * FK 依賴圖（從 migrations/*.sql 的 REFERENCES 建出來）：
 * - trip_days        → trips
 * - trip_entries     → trip_days, pois (migration 0026)
 * - trip_pois        → trips, trip_days, trip_entries, pois
 * - poi_relations    → pois
 * - trip_doc_entries → trip_docs
 * - trip_requests    → trips
 * - trip_permissions → trips
 *
 * Import 必須父表在前，子表在後；否則 FK-enforced import 會把子表 row 跳掉。
 * 歷史 bug：trip_entries 排在 pois 前 → trip_entries / trip_pois import 0 rows。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SCRIPT = path.resolve(__dirname, '../../scripts/init-local-db.js');

function extractTables(): string[] {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  const match = src.match(/const\s+TABLES\s*=\s*\[([^\]]+)\]/);
  if (!match) throw new Error('找不到 init-local-db.js 裡的 TABLES 陣列');
  return match[1]
    .split(',')
    .map((s) => s.trim().replace(/['"]/g, ''))
    .filter(Boolean);
}

function expectParentBeforeChild(tables: string[], parent: string, child: string) {
  const p = tables.indexOf(parent);
  const c = tables.indexOf(child);
  expect(p, `TABLES 未包含 ${parent}`).toBeGreaterThanOrEqual(0);
  expect(c, `TABLES 未包含 ${child}`).toBeGreaterThanOrEqual(0);
  expect(
    p,
    `TABLES 順序錯誤：${parent}（idx ${p}）必須在 ${child}（idx ${c}）之前，否則 FK import 會略過 ${child}`,
  ).toBeLessThan(c);
}

describe('init-local-db.js TABLES FK-safe order', () => {
  const tables = extractTables();

  it('trips 必須在 trip_days 之前（FK: trip_days.trip_id → trips.id）', () => {
    expectParentBeforeChild(tables, 'trips', 'trip_days');
  });

  it('pois 必須在 trip_entries 之前（FK: trip_entries.poi_id → pois.id, migration 0026）', () => {
    expectParentBeforeChild(tables, 'pois', 'trip_entries');
  });

  it('trip_days 必須在 trip_entries 之前（FK: trip_entries.day_id → trip_days.id）', () => {
    expectParentBeforeChild(tables, 'trip_days', 'trip_entries');
  });

  it('trips 必須在 trip_pois 之前（FK: trip_pois.trip_id → trips.id）', () => {
    expectParentBeforeChild(tables, 'trips', 'trip_pois');
  });

  it('pois 必須在 trip_pois 之前（FK: trip_pois.poi_id → pois.id）', () => {
    expectParentBeforeChild(tables, 'pois', 'trip_pois');
  });

  it('trip_entries 必須在 trip_pois 之前（FK: trip_pois.entry_id → trip_entries.id）', () => {
    expectParentBeforeChild(tables, 'trip_entries', 'trip_pois');
  });

  it('pois 必須在 poi_relations 之前（FK: poi_relations.poi_id → pois.id）', () => {
    expectParentBeforeChild(tables, 'pois', 'poi_relations');
  });

  it('trip_docs 必須在 trip_doc_entries 之前（FK: trip_doc_entries.doc_id → trip_docs.id）', () => {
    expectParentBeforeChild(tables, 'trip_docs', 'trip_doc_entries');
  });

  it('trips 必須在 trip_requests 之前', () => {
    expectParentBeforeChild(tables, 'trips', 'trip_requests');
  });

  it('trips 必須在 trip_permissions 之前', () => {
    expectParentBeforeChild(tables, 'trips', 'trip_permissions');
  });
});
