/**
 * ⑨ 連續捲動 source-lock — TripPage 堆疊 render 全部天（往下捲自然進下一天），
 * scroll-spy 依 day header 位置更新 active day + DAY tab 高亮（owner 2026-07-20 回退
 * rev2 單日檢視 57814b67）。
 *
 * deep-link 防護：scroll-spy 的 switchDay + hash 都 gate 在 manualScrollTs 600ms →
 * 點 DAY tab / deep-link / today 定位後短時間內 scroll-spy 不搶回（不蓋正確選天，
 * 即 57814b67 當初移除 scroll-spy 想修的 bug，改用 gate 保留連續捲動同時修掉）。
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const TRIP_PAGE = readFileSync(path.join(ROOT, 'src/pages/TripPage.tsx'), 'utf8');

describe('⑨ TripPage 連續捲動 — 全天堆疊 + scroll-spy', () => {
  it('用 dayNums.map 堆疊 render 全部 DaySection（連續捲動）', () => {
    expect(TRIP_PAGE).toMatch(/dayNums\.map\(\(dayNum\)\s*=>\s*\(/);
  });

  it('scroll-spy 在場：import + 使用 computeActiveDayIndex / getStableViewportH', () => {
    expect(TRIP_PAGE).toContain('computeActiveDayIndex');
    expect(TRIP_PAGE).toContain('getStableViewportH');
  });

  it('DAY tab 換天 = switchDay + scrollToDay 到該天 section（非捲回頂）', () => {
    expect(TRIP_PAGE).toMatch(/handleSwitchDay[\s\S]{0,240}scrollToDay\(dayNum\)/);
  });

  it('scroll-spy switchDay 有 manualScrollTs 600ms gate（deep-link / 手動選天防搶）', () => {
    expect(TRIP_PAGE).toMatch(/Date\.now\(\)\s*-\s*manualScrollTs\.current\s*>\s*600/);
    expect(TRIP_PAGE).toMatch(/settled\s*&&[\s\S]{0,220}switchDay\(activeDayNum\)/);
  });
});
