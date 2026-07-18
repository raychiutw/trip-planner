/**
 * rev2 one-day-view source-lock — TripPage 只 render「當前 day」（非全日捲動堆疊），
 * 對照 owner 簽核 mockup Section 01（單日內容 + DAY tab 切換，docs/artifacts/2026-07-17-v3-desktop-prototype.html）。
 * scroll-spy（scroll → 依 day header 位置改 currentDayNum + hash）已移除：單日模式無跨天捲動可追蹤，
 * 且它在「預設 render day1」時會強制 switchDay(1) 蓋掉 #dayN / ?focusDay deep-link。
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const TRIP_PAGE = readFileSync(path.join(ROOT, 'src/pages/TripPage.tsx'), 'utf8');

describe('rev2 one-day-view — TripPage 單日呈現', () => {
  it('不再用 dayNums.map 把所有 DaySection 堆疊（全日捲動已移除）', () => {
    expect(TRIP_PAGE).not.toMatch(/dayNums\.map\(\(dayNum\)\s*=>\s*\(/);
  });

  it('只 render 一個 DaySection：currentDayNum（未定 → 落首日 dayNums[0]）', () => {
    expect(TRIP_PAGE).toMatch(/currentDayNum\s*>\s*0\s*\?\s*currentDayNum\s*:\s*\(dayNums\[0\]/);
    expect(TRIP_PAGE).toContain('<DaySection');
  });

  it('scroll-spy 移除：不再 import / 使用 computeActiveDayIndex', () => {
    expect(TRIP_PAGE).not.toContain('computeActiveDayIndex');
  });

  it('DAY tab 換天 = switchDay + 捲回頂（非 scrollToDay 到換天當下尚未 render 的 header）', () => {
    expect(TRIP_PAGE).toMatch(/handleSwitchDay[\s\S]{0,240}scrollTo\(\{\s*top:\s*0/);
  });
});
