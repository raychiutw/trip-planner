/**
 * daily-check.js queryProdDataHygiene — migration 0078 note cutover
 *
 * trip_entries.note 已 DROP（備註改 per-(entry, poi) trip_entry_pois.note）。
 * prod-data-hygiene 的 test-marker 掃描原本讀 te.note，DROP 後該 SQL 會
 * "no such column: te.note"。Cutover：marker 掃描改讀 master（sort_order=1）的
 * trip_entry_pois.note，保留「偵測測試標記 leak 進正式行程備註」的原意。
 *
 * Source-grep 守住（對齊既有 daily-check-*.test.ts pattern）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(__dirname, '../../scripts/daily-check.js'),
  'utf8',
);

describe('queryProdDataHygiene — migration 0078 note cutover', () => {
  it('不再 reference 已 DROP 的 te.note（避免 "no such column" prod fail）', () => {
    expect(SRC).not.toMatch(/te\.note/);
  });

  it('marker 掃描改讀 trip_entry_pois 的 note（per-POI 備註）', () => {
    // JOIN trip_entry_pois 並用其 note 欄位做 LIKE 掃描
    expect(SRC).toMatch(/JOIN trip_entry_pois/);
    expect(SRC).toMatch(/tep\.note LIKE/);
  });

  it('只掃 master（sort_order = 1）— 對齊 entry-level note 的語意繼承', () => {
    expect(SRC).toMatch(/tep\.sort_order = 1/);
  });
});
