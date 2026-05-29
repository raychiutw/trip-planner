/**
 * Regression — PR45: GET /api/trips/:id/notes aggregator 必須回 lodgings 帶 day_ids
 *
 * v2.34.44 PR44 把 trip_lodgings.day_id INT 改成 trip_lodging_days junction table,
 * `_shared.ts::listNotesSection` 已加 batch fetch junction rows → day_ids[]，但
 * 主 aggregator endpoint `functions/api/trips/[id]/notes.ts` 走自己的 raw SELECT,
 * 不經 listNotesSection → lodgings 永遠缺 day_ids → frontend `.map(d.id)` crash
 * (TypeError: Cannot read properties of undefined (reading 'map'))。
 *
 * 此 test 鎖 aggregator 路徑必含 junction batch fetch。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const NOTES_AGG = resolve(
  __dirname,
  '../../functions/api/trips/[id]/notes.ts',
);

describe('PR45 — notes aggregator must populate lodgings.day_ids', () => {
  const src = readFileSync(NOTES_AGG, 'utf-8');

  it('queries trip_lodging_days junction table', () => {
    expect(src).toMatch(/FROM\s+trip_lodging_days\s+WHERE\s+lodging_id\s+IN/);
  });

  it('attaches day_ids array to each lodging row', () => {
    expect(src).toMatch(/day_ids:\s*byLodgingId\.get/);
  });

  it('falls back to empty array when lodging has no junction rows', () => {
    expect(src).toMatch(/byLodgingId\.get\([^)]+\)\s*\?\?\s*\[\]/);
  });

  it('returns lodgingsWithDayIds (not raw lodgings.results) in response', () => {
    expect(src).toMatch(/lodgings:\s*lodgingsWithDayIds/);
  });
});
