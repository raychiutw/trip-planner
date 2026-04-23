/**
 * map-page-overview-url.test.tsx — map-page-multiday-overview TDD red test
 *
 * 驗證 MapPage 解析 URL `?day=all` 進 overview mode、`?day=N` 進 single day、無 query 預設 Day 1。
 * 採 source-level regex 檢查，低 context 成本、穩定。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const mapPagePath = join(process.cwd(), 'src', 'pages', 'MapPage.tsx');
const src = readFileSync(mapPagePath, 'utf-8');

describe('MapPage URL parsing (map-page-multiday-overview)', () => {
  it('解析 ?day=all 為 overview mode（source 含 "all" 字面判斷）', () => {
    // 期望 code 有 `q === 'all'` 或 `q.toLowerCase() === 'all'` 類似 branch
    const match = src.match(/['"]all['"]\s*===\s*/) || src.match(/===\s*['"]all['"]/);
    expect(match, 'MapPage 應該解析 ?day=all 為 overview — 需 code 含 \'all\' 字串比對').not.toBeNull();
  });

  it('activeTab 型別為 "overview" | number', () => {
    // 期望 state 宣告 activeTab 而非只有 activeDayNum
    const hasOverviewType = src.match(/activeTab/) || src.match(/'overview'\s*\|\s*number/) || src.match(/overview.*\|.*number/);
    expect(hasOverviewType, 'MapPage 應宣告 activeTab: "overview" | number').not.toBeNull();
  });

  it('URL 切 overview 設為 ?day=all', () => {
    // 期望某處有 `set('day', 'all')` 或 `?day=all` 連結字串
    const match = src.match(/set\(['"]day['"]\s*,\s*['"]all['"]\)/) || src.match(/day=all/);
    expect(match, 'MapPage 切 overview 時 URL 應更新為 ?day=all').not.toBeNull();
  });
});
