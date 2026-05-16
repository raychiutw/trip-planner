// @vitest-environment node
/**
 * v2.31.21 fix #122: AddPoiFavoriteToTrip 結束時間 helper text 文字殘缺。
 *
 * Bug 取證（prod QA）：line 557 「可空 — 依停留時間預估推」缺字，
 * 對齊 line 544 開始時間「可空 — 依景點類型自動推算」風格應改為
 * 「可空 — 依停留時間自動推算」。
 *
 * Pure-text grep。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/AddPoiFavoriteToTripPage.tsx'),
  'utf8',
);

describe('v2.31.21 AddPoiFavoriteToTrip helper text', () => {
  it('結束時間 helper 對齊「自動推算」格式', () => {
    expect(SRC).toMatch(/可空 — 依停留時間自動推算/);
  });

  it('原本殘缺文案「預估推」不再出現', () => {
    expect(SRC).not.toMatch(/可空 — 依停留時間預估推[^算]/);
    expect(SRC).not.toMatch(/可空 — 依停留時間預估推$/m);
  });

  it('開始時間 helper 保留既有「自動推算」格式（regression）', () => {
    expect(SRC).toMatch(/可空 — 依景點類型自動推算/);
  });
});
