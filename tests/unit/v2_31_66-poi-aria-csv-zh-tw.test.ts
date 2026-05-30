// @vitest-environment node
/**
 * v2.31.66 polish: user-visible「POI」洩漏 → 中文。
 *
 * 3 處 aria-label="POI 類別" → "景點類別"（screen reader 讀的字）：
 * ChangePoiPage / ExplorePage / AddStopPage.
 *
 * (v2.37.0 PR2: the CSV-export-header half of this test was removed with the CSV
 * export itself — only the aria-label assertions remain.)
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (rel: string) =>
  readFileSync(path.resolve(__dirname, '..', '..', rel), 'utf8');

const CHANGE_POI = read('src/pages/ChangePoiPage.tsx');
const EXPLORE = read('src/pages/ExplorePage.tsx');
const ADD_STOP = read('src/pages/AddStopPage.tsx');

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
