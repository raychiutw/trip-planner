/**
 * ocean-map-pinsByDay.test.tsx — TDD red test
 *
 * 驗證 OceanMap 支援 pinsByDay prop（多天多色 polyline），
 * 以及 Segment 接受 dayNum prop。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const oceanMapPath = join(process.cwd(), 'src', 'components', 'trip', 'OceanMap.tsx');
const src = readFileSync(oceanMapPath, 'utf-8');

describe('OceanMap pinsByDay 支援 (map-page-multiday-overview)', () => {
  it('OceanMapProps 宣告 pinsByDay optional prop', () => {
    const match = src.match(/pinsByDay\??\s*:\s*Map\s*<\s*number\s*,\s*MapPin\[\]\s*>/);
    expect(match, 'OceanMapProps 應宣告 pinsByDay?: Map<number, MapPin[]>').not.toBeNull();
  });

  it('Segment 或 SegmentProps 宣告 dayNum optional prop', () => {
    // 既有 Segment 結構：from, to, isActive — 加 dayNum?
    const match = src.match(/interface\s+SegmentProps[\s\S]*?dayNum\??\s*:/)
      || src.match(/dayNum\??\s*:\s*number/);
    expect(match, 'SegmentProps 應含 dayNum?: number').not.toBeNull();
  });

  it('segmentStyle 呼叫 dayPolylineStyle 覆寫顏色', () => {
    const match = src.match(/dayPolylineStyle\s*\(/);
    expect(match, 'OceanMap segmentStyle 或 Segment 應用 dayPolylineStyle() 依 dayNum 著色').not.toBeNull();
  });

  it('OceanMap import dayPolylineStyle from dayPalette', () => {
    const match = src.match(/from\s+['"]\.\.\/\.\.\/lib\/dayPalette['"]/);
    expect(match, 'OceanMap 應 import dayPalette').not.toBeNull();
  });
});
