// @vitest-environment node
/**
 * v2.31.48 fix: TripSheet 4 個 tabpanel `hidden` HTML attr 被 CSS `display: flex`
 * 覆蓋，所有 placeholder（itinerary + chat）跟 active map tab 同時顯示。
 *
 * Bug 取證（v2.31.46 sticky map portal 部署後 prod QA）：
 *   - desktop /trips?selected=X sheet 顯：「行程已顯示在左側 / Per-trip chat
 *     COMING SOON」 兩個 placeholder + 中間夾 map tab content（hidden 沒生效）
 *   - JS 檢查：`role="tabpanel"` 有 `hidden=true`，但 `getComputedStyle.display = "flex"`
 *   - Root cause: TripSheet.tsx:51 `.trip-sheet-placeholder { display: flex }`
 *     specificity 蓋過 HTML `hidden` attr 預設 `display: none`。
 *
 * Fix：CSS `[role="tabpanel"][hidden] { display: none }` 強制隱藏 hidden tabpanel。
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/components/trip/TripSheet.tsx'),
  'utf8',
);

describe('v2.31.48 TripSheet hidden tabpanel CSS', () => {
  it('SCOPED_STYLES 含 [role="tabpanel"][hidden] { display: none }', () => {
    expect(SRC).toMatch(/\[role=["']tabpanel["']\]\[hidden\]\s*\{\s*display:\s*none/);
  });

  it('保留既有 .trip-sheet-placeholder { display: flex }（active panel 仍 flex）', () => {
    expect(SRC).toMatch(/\.trip-sheet-placeholder\s*\{[\s\S]{0,80}display:\s*flex/);
  });
});
