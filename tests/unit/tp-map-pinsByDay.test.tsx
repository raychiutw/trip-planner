/**
 * tp-map-pinsByDay.test.tsx — TDD red test
 *
 * 驗證 TpMap 支援 pinsByDay prop（多天多色 polyline），
 * 以及 Segment 接受 dayNum prop。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const tpMapPath = join(process.cwd(), 'src', 'components', 'trip', 'TpMap.tsx');
const src = readFileSync(tpMapPath, 'utf-8');

describe('TpMap pinsByDay 支援 (map-page-multiday-overview)', () => {
  it('TpMapProps 宣告 pinsByDay optional prop', () => {
    const match = src.match(/pinsByDay\??\s*:\s*Map\s*<\s*number\s*,\s*MapPin\[\]\s*>/);
    expect(match, 'TpMapProps 應宣告 pinsByDay?: Map<number, MapPin[]>').not.toBeNull();
  });

  it('Segment 或 SegmentProps 宣告 dayNum optional prop', () => {
    // 既有 Segment 結構：from, to, isActive — 加 dayNum?
    const match = src.match(/interface\s+SegmentProps[\s\S]*?dayNum\??\s*:/)
      || src.match(/dayNum\??\s*:\s*number/);
    expect(match, 'SegmentProps 應含 dayNum?: number').not.toBeNull();
  });

  it('segmentStyle 呼叫 dayPolylineStyle 覆寫顏色', () => {
    const match = src.match(/dayPolylineStyle\s*\(/);
    expect(match, 'TpMap segmentStyle 或 Segment 應用 dayPolylineStyle() 依 dayNum 著色').not.toBeNull();
  });

  it('TpMap import dayPolylineStyle from dayPalette', () => {
    const match = src.match(/from\s+['"]\.\.\/\.\.\/lib\/dayPalette['"]/);
    expect(match, 'TpMap 應 import dayPalette').not.toBeNull();
  });
});
