/**
 * map-page-polyline-color.test.tsx — TDD red test
 *
 * 驗證 MapPage 使用 dayColor / dayPolylineStyle（從 dayPalette），
 * 並傳給 OceanMap 作 polyline 著色。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const mapPagePath = join(process.cwd(), 'src', 'pages', 'MapPage.tsx');
const src = readFileSync(mapPagePath, 'utf-8');

describe('MapPage polyline 顏色 (map-page-multiday-overview)', () => {
  it('MapPage 從 dayPalette import dayColor 或 dayPolylineStyle', () => {
    const match = src.match(/from\s+['"]\.\.\/lib\/dayPalette['"]/);
    expect(match, 'MapPage 應 import dayPalette 以獲取 dayColor(N)').not.toBeNull();
  });

  it('MapPage 傳 dayNum 或 pinsByDay prop 給 OceanMap', () => {
    // 期望 <OceanMap ...> JSX 含 dayNum 或 pinsByDay prop
    const match = src.match(/<OceanMap[\s\S]*?(dayNum|pinsByDay)/);
    expect(match, 'MapPage 應傳 dayNum 或 pinsByDay prop 給 OceanMap').not.toBeNull();
  });
});
