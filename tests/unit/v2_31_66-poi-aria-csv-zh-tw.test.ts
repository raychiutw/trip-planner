// @vitest-environment node
/**
 * v2.31.66 polish: 4 處 user-visible「POI」洩漏 → 中文。
 *
 * 1. CSV export 表頭 (src/lib/tripExport.ts) — 用戶下載的 CSV 表頭應全中文：
 *    「POI名」/「POI類型」/「POI評分」/「POI價格」→「景點名稱」/「景點類型」/「景點評分」/「景點價格」
 * 2. 3 處 aria-label="POI 類別" → "景點類別"（screen reader 讀的字）：
 *    ChangePoiPage / ExplorePage / AddStopPage
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (rel: string) =>
  readFileSync(path.resolve(__dirname, '..', '..', rel), 'utf8');

const TRIP_EXPORT = read('src/lib/tripExport.ts');
const CHANGE_POI = read('src/pages/ChangePoiPage.tsx');
const EXPLORE = read('src/pages/ExplorePage.tsx');
const ADD_STOP = read('src/pages/AddStopPage.tsx');

describe('v2.31.66 CSV export 表頭中文化', () => {
  it('表頭不再含「POI名」/「POI類型」/「POI評分」/「POI價格」', () => {
    expect(TRIP_EXPORT).not.toMatch(/'POI名'/);
    expect(TRIP_EXPORT).not.toMatch(/'POI類型'/);
    expect(TRIP_EXPORT).not.toMatch(/'POI評分'/);
    expect(TRIP_EXPORT).not.toMatch(/'POI價格'/);
  });

  it('表頭含「景點名稱」/「景點類型」/「景點評分」/「景點價格」', () => {
    expect(TRIP_EXPORT).toMatch(/'景點名稱'/);
    expect(TRIP_EXPORT).toMatch(/'景點類型'/);
    expect(TRIP_EXPORT).toMatch(/'景點評分'/);
    expect(TRIP_EXPORT).toMatch(/'景點價格'/);
  });
});

describe('v2.31.66 aria-label "POI 類別" → "景點類別"', () => {
  it('ChangePoiPage aria-label 改為「景點類別」', () => {
    expect(CHANGE_POI).not.toMatch(/aria-label="POI 類別"/);
    expect(CHANGE_POI).toMatch(/aria-label="景點類別"/);
  });

  it('ExplorePage aria-label 改為「景點類別」', () => {
    expect(EXPLORE).not.toMatch(/aria-label="POI 類別"/);
    expect(EXPLORE).toMatch(/aria-label="景點類別"/);
  });

  it('AddStopPage aria-label 改為「景點類別」', () => {
    expect(ADD_STOP).not.toMatch(/aria-label="POI 類別"/);
    expect(ADD_STOP).toMatch(/aria-label="景點類別"/);
  });
});
