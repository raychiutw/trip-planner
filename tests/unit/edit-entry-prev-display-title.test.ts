// @vitest-environment node
/**
 * v2.31.28 fix #129 + v2.31.29 fix #130: EditEntryPage 「從「{prev}」移動」
 * header 用 master.name — 與 TimelineRail 對齊。
 *
 * Bug 取證（prod QA）：trip /trip/.../stop/420/edit 的 mode section header 顯示
 * 「從「抵達那霸機場」移動」，但 TripPage TimelineRail 同一 entry 顯示「那霸機場」
 * （POI name 優先）。
 *
 * Root cause 二段式：
 * v2.31.28 嘗試 fix：以為 backend GET /days/:dayNum 會回 displayTitle 欄位（src/lib/mapDay.ts
 * 計算），用 getTimelineEntryDisplayTitle(prev) 取。實際上 mapDay 是 frontend-only
 * 在 DaySection.tsx 才呼叫 — 直接 fetch 的 prev 物件沒 displayTitle 欄位 → fallback
 * 仍取 prev.title。
 *
 * v2.31.29 真正 fix：用 getStopDisplayTitle({poiName: prev.master?.name})
 * — 與 mapDay.ts 內部計算同一規則（primary POI name only）。
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

describe('v2.31.29 EditEntryPage prevEntry displayTitle from master.name', () => {
  it('import getStopDisplayTitle from stopDisplay', () => {
    expect(SRC).toMatch(/getStopDisplayTitle/);
    expect(SRC).toMatch(/from\s+['"]\.\.\/lib\/stopDisplay['"]/);
  });

  it('用 getStopDisplayTitle 配合 master.name 算 derivedTitle', () => {
    // derivedTitle 由 getStopDisplayTitle 推導，再交給 setPrevEntry
    expect(SRC).toMatch(/getStopDisplayTitle\(\{[\s\S]{0,200}poiName:\s*prev\.master\?\.name/);
    expect(SRC).toMatch(/setPrevEntry\(\{[\s\S]{0,80}title:\s*derivedTitle/);
  });

  it('render header 用 prevEntry.title（state 已存 derived title）', () => {
    expect(SRC).toMatch(/從「\{prevEntry\.title\}」移動/);
  });

  it('不 fallback 到 prev.title（master.name 缺漏時顯示未選擇）', () => {
    expect(SRC).not.toMatch(/\?\?\s*prev\.title/);
    expect(SRC).toMatch(/derivedTitle[\s\S]{0,120}（未選擇景點）/);
  });
});
