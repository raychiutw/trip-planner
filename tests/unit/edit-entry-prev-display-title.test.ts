// @vitest-environment node
/**
 * v2.31.28 fix #129: EditEntryPage 「從「{prev}」移動」用 displayTitle
 * 而非 raw entry.title — 與 TimelineRail 對齊。
 *
 * Bug 取證（prod QA）：trip /trip/.../stop/420/edit 的 mode section header 顯示
 * 「從「抵達那霸機場」移動」，但 TripPage TimelineRail 同一 entry 顯示「那霸機場」
 * （POI name）。原因：mapDay computes displayTitle = poiName ?? title，
 * TimelineRail 用 getTimelineEntryDisplayTitle 取 displayTitle，EditEntryPage
 * 卻用 prev.title raw → 兩處 UI 不一致，使用者困惑。
 *
 * Fix：EditEntryPage 也用 getTimelineEntryDisplayTitle，prevEntry state 儲存
 * 已 derived 的 displayTitle 字串。
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/EditEntryPage.tsx'),
  'utf8',
);

describe('v2.31.28 EditEntryPage prevEntry displayTitle', () => {
  it('import getTimelineEntryDisplayTitle from stopDisplay', () => {
    expect(SRC).toMatch(/getTimelineEntryDisplayTitle/);
    expect(SRC).toMatch(/from\s+['"]\.\.\/lib\/stopDisplay['"]/);
  });

  it('DayApi.timeline 含 displayTitle? 欄位', () => {
    // 不再 silent drop backend mapDay 設的 displayTitle
    expect(SRC).toMatch(/displayTitle\?:\s*string\s*\|\s*null/);
  });

  it('setPrevEntry 透過 getTimelineEntryDisplayTitle 取顯示用 title', () => {
    expect(SRC).toMatch(/setPrevEntry\([\s\S]{0,200}getTimelineEntryDisplayTitle\(prev\)/);
  });

  it('render header 用 prevEntry.title（state 已存 displayTitle 字串）', () => {
    // 渲染端維持 prevEntry.title，只是來源換 displayTitle
    expect(SRC).toMatch(/從「\{prevEntry\.title\}」移動/);
  });
});
