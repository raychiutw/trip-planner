// @vitest-environment node
/**
 * mockup-parity-qa-fixes Sprint 10.5: AddStopPage region pill + filter button
 * + DAY 全大寫 + footer counter 不被 regression。
 *
 * 2026-05-03 modal-to-fullpage migration: AddStopModal.tsx 已 DEL，搬到
 * src/pages/AddStopPage.tsx。region/filter/counter mockup spec 沿用，dayLabel
 * 邏輯從 TripPage inline 算搬進 page 裡 (deriveDayLabel)。
 *
 * Pure-text grep on source 避免 jsdom + React 18 + vi.* API 不相容問題。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/AddStopPage.tsx'),
  'utf8'
);

describe('mockup-parity-qa-fixes AddStopPage region + filter + DAY format', () => {
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

  it('deriveDayLabel 產生「DAY 03 · 7/31（五）」全大寫格式', () => {
    // 2026-05-03 modal-to-fullpage migration: TripPage 原本 inline 算 dayLabel
    // 傳給 modal，現在改在 AddStopPage 裡 fetch days 後 deriveDayLabel 算。
    // v2.21.0 P2 fix: weekday 改讀 camelCase `day.dayOfWeek` (was day_of_week,
    // 對齊 _utils.json deepCamel — 真 API 回 camelCase)。
    expect(SRC).toMatch(/function deriveDayLabel/);
    expect(SRC).toMatch(/DAY \$\{dayPad\}/);
    expect(SRC).toMatch(/padStart\(2,\s*'0'\)/);
    expect(SRC).toMatch(/day\.dayOfWeek/);
    expect(SRC).toContain('DAY ${dayPad} · ${month}/${dom}');
    expect(SRC).toContain('（${weekdayChar}）');
  });

  it('dayNum 從 ?day= URL searchParam 讀取（取代原 modal dayNum prop）', () => {
    // 2026-05-03 modal-to-fullpage migration: TripPage 原本 prop 傳 dayNum，
    // 改全頁後從 useSearchParams() 讀 ?day=N，URL deep-linkable。
    expect(SRC).toMatch(/useSearchParams/);
    expect(SRC).toMatch(/searchParams\.get\(\s*'day'\s*\)/);
  });
});
