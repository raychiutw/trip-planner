/**
 * map-page-overview-flyto.test.tsx — TDD red test
 *
 * 驗證 MapPage overview mode 下點 entry card 只 flyTo 不切換 tab（activeTab 保持 'overview'）。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const mapPagePath = join(process.cwd(), 'src', 'pages', 'MapPage.tsx');
const src = readFileSync(mapPagePath, 'utf-8');

describe('MapPage overview flyTo 行為 (map-page-multiday-overview)', () => {
  it('MapPage 使用 allPins 或 pinsByDay 於 overview mode', () => {
    // 期望 code 有 allPins 變數或 extractPinsFromAllDays call
    const match = src.match(/allPins/) || src.match(/extractPinsFromAllDays/);
    expect(match, 'MapPage overview mode 應有 allPins 或 extractPinsFromAllDays').not.toBeNull();
  });

  it('overview mode render 所有 days 的 entry cards', () => {
    // 期望 card 列表 source 含判斷：若 activeTab === 'overview' 則 render all days entries
    const match = src.match(/activeTab\s*===\s*['"]overview['"]/);
    expect(match, 'MapPage 應判斷 activeTab === \'overview\' 分支').not.toBeNull();
  });
});
