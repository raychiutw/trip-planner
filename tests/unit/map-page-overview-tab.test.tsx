/**
 * map-page-overview-tab.test.tsx — TDD red test
 *
 * 驗證 MapPage day tabs 最左有「總覽」選項，prepend 於 Day 01 之前。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const mapPagePath = join(process.cwd(), 'src', 'pages', 'MapPage.tsx');
const src = readFileSync(mapPagePath, 'utf-8');

describe('MapPage 總覽 tab (map-page-multiday-overview)', () => {
  it('source 含「總覽」字串（tab label）', () => {
    const match = src.match(/總覽/);
    expect(match, 'MapPage 應含「總覽」tab label').not.toBeNull();
  });

  it('總覽 tab 出現在 day tabs 渲染迴圈之前（prepend）', () => {
    // 找「總覽」首次出現 index 和 dayTabs.map 的位置；前者應早於後者
    const overviewIdx = src.indexOf('總覽');
    const tabsMapIdx = src.search(/dayTabs\.map/);
    if (overviewIdx === -1 || tabsMapIdx === -1) {
      expect.fail('無法定位「總覽」或 dayTabs.map — 檢查 MapPage 結構');
    }
    expect(overviewIdx, '「總覽」tab 應在 dayTabs.map 之前 render（prepend 於 Day 01 前）').toBeLessThan(tabsMapIdx);
  });
});
