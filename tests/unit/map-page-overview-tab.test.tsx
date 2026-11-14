/**
 * map-page-overview-tab.test.tsx — TDD red test
 *
 * 驗證 MapPage day tabs 最左有「全部」選項，prepend 於 Day 1 之前。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const mapPagePath = join(process.cwd(), 'src', 'pages', 'MapPage.tsx');
const src = readFileSync(mapPagePath, 'utf-8');

describe('MapPage 全部 tab (map-page-multiday-overview)', () => {
  it('source 含「全部」字串（tab label）', () => {
    const match = src.match(/全部/);
    expect(match, 'MapPage 應含「全部」tab label').not.toBeNull();
  });

  it('全部 tab 出現在 day tabs 渲染迴圈之前（prepend）', () => {
    // 找「全部」首次出現 index 和 dayTabs.map 的位置；前者應早於後者
    const overviewIdx = src.indexOf('全部');
    const tabsMapIdx = src.search(/dayTabs\.map/);
    if (overviewIdx === -1 || tabsMapIdx === -1) {
      expect.fail('無法定位「全部」或 dayTabs.map — 檢查 MapPage 結構');
    }
    expect(overviewIdx, '「全部」tab 應在 dayTabs.map 之前 render（prepend 於 Day 1 前）').toBeLessThan(tabsMapIdx);
  });
});
