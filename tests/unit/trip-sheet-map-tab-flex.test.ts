// @vitest-environment node
/**
 * v2.31.49 hotfix: v2.31.48 hidden tabpanel fix 後 map tab collapse 到 4px。
 *
 * Bug 取證（v2.31.48 部署後 prod QA）：
 *   - desktop sticky map sheet：itinerary + chat hidden 後 display:none 正確
 *   - 但 active map tab `<div role="tabpanel" id="trip-sheet-panel-map">`
 *     沒 className 也沒 flex 屬性 → trip-sheet-body (display:flex column)
 *     裡 collapse 成 4px 高
 *   - JS check: `mapTab.getBoundingClientRect().height === 4`
 *   - 結果 sheet 大片空白，Google Map 沒空間 render
 *
 * Root cause：v2.31.48 之前 placeholders 設 `display: flex; flex: 1` 撐
 * sheet-body height，map 作為兄弟也跟著拿空間。Placeholders 改 hidden
 * 後 map 失去 height 來源。
 *
 * Fix：CSS `[role="tabpanel"]:not([hidden]) { flex: 1; min-height: 0 }`
 * 強制 active tabpanel 拿 flex:1 撐滿 sheet-body。min-height:0 給 TripMapRail
 * 100% height rule 拿得到實際高度。
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

describe('v2.31.49 TripSheet active tabpanel flex 撐 height', () => {
  it('SCOPED_STYLES 含 [role="tabpanel"]:not([hidden]) flex:1 + min-height:0', () => {
    expect(SRC).toMatch(/\[role=["']tabpanel["']\]:not\(\[hidden\]\)\s*\{[\s\S]{0,80}flex:\s*1/);
    expect(SRC).toMatch(/\[role=["']tabpanel["']\]:not\(\[hidden\]\)\s*\{[\s\S]{0,80}min-height:\s*0/);
  });

  it('保留 v2.31.48 [hidden] display:none rule', () => {
    expect(SRC).toMatch(/\[role=["']tabpanel["']\]\[hidden\]\s*\{\s*display:\s*none/);
  });
});
