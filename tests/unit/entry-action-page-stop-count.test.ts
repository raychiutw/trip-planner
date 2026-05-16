// @vitest-environment node
/**
 * v2.31.16 fix: EntryActionPage Day stopCount 永遠 0 顯示「空」。
 *
 * Bug found in prod QA：EntryActionPage 用 /api/trips/:id/days (no all=1)
 * 端點拿 day list，讀 `d.entryCount` 但 backend 該端點不回此欄位 → 永遠
 * undefined → fallback 0 → UI 顯示「空」誤導 user 以為該 day 沒 stops。
 *
 * Fix：改用 /days?all=1 拿 timeline 然後 `timeline.length`（已存在 endpoint）。
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/EntryActionPage.tsx'),
  'utf8',
);

describe('v2.31.16 EntryActionPage stopCount', () => {
  it('fetch 路徑用 /days?all=1（拿 timeline）', () => {
    expect(SRC).toMatch(/\/trips\/\$\{encodeURIComponent\(tripId\)\}\/days\?all=1/);
  });

  it('stopCount 從 timeline.length 算（不再用 entryCount）', () => {
    expect(SRC).toMatch(/stopCount:\s*Array\.isArray\(d\.timeline\)\s*\?\s*d\.timeline\.length\s*:\s*0/);
  });

  it('DaysApiRow 含 timeline 欄位（取代 entryCount）', () => {
    const match = SRC.match(/interface DaysApiRow[\s\S]*?\n\}/);
    expect(match).not.toBeNull();
    expect(match![0]).toMatch(/timeline\?\s*:\s*unknown\[\]/);
  });
});
