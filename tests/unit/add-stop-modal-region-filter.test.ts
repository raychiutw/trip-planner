// @vitest-environment node
/**
 * mockup-parity-qa-fixes Sprint 10.5: AddStopModal region pill + filter button
 * + DAY 全大寫 + footer counter 不被 regression。
 *
 * Pure-text grep on source 避免 jsdom + React 18 + vi.* API 不相容問題。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/components/trip/AddStopModal.tsx'),
  'utf8'
);
const TRIP_PAGE = readFileSync(
  path.resolve(__dirname, '../../src/pages/TripPage.tsx'),
  'utf8'
);

describe('mockup-parity-qa-fixes AddStopModal region + filter + DAY format', () => {
  it('REGION_OPTIONS 含 6 個 hardcode region', () => {
    expect(SRC).toMatch(/REGION_OPTIONS\s*=\s*\[/);
    ['全部地區', '沖繩', '東京', '京都', '首爾', '台南'].forEach((r) => {
      expect(SRC).toContain(`'${r}'`);
    });
  });

  it('region pill render 含 chevron-down icon + dropdown menu', () => {
    expect(SRC).toMatch(/className="tp-add-stop-region-pill"/);
    expect(SRC).toMatch(/data-testid="add-stop-region-pill"/);
    expect(SRC).toMatch(/<Icon name="chevron-down" \/>/);
    expect(SRC).toMatch(/className="tp-add-stop-region-menu"/);
    expect(SRC).toMatch(/data-testid="add-stop-region-menu"/);
  });

  it('filter button trailing search input 含 filter icon + 篩選 label', () => {
    expect(SRC).toMatch(/className="tp-add-stop-filter-btn"/);
    expect(SRC).toMatch(/data-testid="add-stop-filter-btn"/);
    expect(SRC).toMatch(/<Icon name="filter" \/>/);
    expect(SRC).toMatch(/<span>篩選<\/span>/);
  });

  it('footer counter 即使 N=0 也顯示「已選 0 個」格式（不再寫「請先選擇」）', () => {
    const counterBlock = SRC.match(/className="tp-add-stop-counter"[\s\S]*?<\/span>/);
    expect(counterBlock).not.toBeNull();
    expect(counterBlock?.[0]).toMatch(/已選\s*<strong>\{totalSelected\}<\/strong>\s*個\s*·\s*將加入/);
    expect(counterBlock?.[0]).not.toMatch(/從上方挑選或填寫一個項目/);
  });

  it('TripPage 傳給 AddStopModal 的 dayLabel 是「DAY 03 · 7/31（五）」全大寫格式', () => {
    expect(TRIP_PAGE).toMatch(/DAY\s*\$\{dayPad\}/);
    expect(TRIP_PAGE).toMatch(/padStart\(2,\s*'0'\)/);
    expect(TRIP_PAGE).toMatch(/weekdayChar/);
    expect(TRIP_PAGE).toMatch(/'日',\s*'一',\s*'二'/);
  });

  it('defaultRegion prop 接收 trip-context 預設 region', () => {
    expect(SRC).toMatch(/defaultRegion\?:\s*string/);
    expect(SRC).toMatch(/initialRegion = REGION_OPTIONS\.includes\(defaultRegion as RegionOption\)/);
  });
});
