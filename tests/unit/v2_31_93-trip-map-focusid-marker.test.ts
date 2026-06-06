/**
 * v2.31.93：點 stop 地圖 marker 不切 focused 視覺 + 被點 stop 沒浮在最高被壓住。
 *
 * User 反映：
 *   1. 點行程的 stop 地圖的 icon 沒有換被點選的 marker（參考地圖頁的方式）
 *   2. 被點的 stop 沒有浮在最高 被壓住了
 *
 * Fix：
 *   - TripMapRail 加 `focusedEntryId` state，entryFocused isExpanding=true 設、
 *     isExpanding=false 清；pass 給 TpMap `focusId={focusedEntryId}` 觸發
 *     既有 focusId useEffect 換 marker accent 視覺 + flyTo zoom 13。
 *   - TpMap.markerContent 加 isFocused 偵測（zIndex ≥ 1000）→ box-shadow
 *     換 outer accent ring + 加深 drop shadow + z-index:1000 浮頂。
 *
 * 與 MapPage focusId flow 對齊（地圖頁點 marker 已是同邏輯，這版讓 desktop
 * rail 行為一致）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TRIP_MAP_RAIL = readFileSync(
  resolve(__dirname, '../../src/components/trip/TripMapRail.tsx'),
  'utf8',
);
const OCEAN_MAP = readFileSync(
  resolve(__dirname, '../../src/components/trip/TpMap.tsx'),
  'utf8',
);
// v2.33.57 round 11: markerContent + markerStyle 拆到 src/lib/mapHelpers.ts
const MAP_HELPERS = readFileSync(
  resolve(__dirname, '../../src/lib/mapHelpers.ts'),
  'utf8',
);

describe('v2.31.93: TripMapRail focusId marker + 浮頂視覺', () => {
  it('TripMapRail 有 focusedEntryId state', () => {
    expect(TRIP_MAP_RAIL).toMatch(/setFocusedEntryId/);
    expect(TRIP_MAP_RAIL).toMatch(/focusedEntryId/);
  });

  it('TripMapRail 把 focusedEntryId pass 給 TpMap focusId prop', () => {
    expect(TRIP_MAP_RAIL).toMatch(/focusId=\{focusedEntryId\}/);
  });

  it('isExpanding=true 時 setFocusedEntryId(entryId)、isExpanding=false 時 setFocusedEntryId(undefined)', () => {
    expect(TRIP_MAP_RAIL).toMatch(/isExpanding === true/);
    expect(TRIP_MAP_RAIL).toMatch(/isExpanding === false/);
    expect(TRIP_MAP_RAIL).toMatch(/setFocusedEntryId\(entryId\)/);
    expect(TRIP_MAP_RAIL).toMatch(/setFocusedEntryId\(undefined\)/);
  });

  it('markerContent 含 isFocused 偵測（zIndex ≥ 1000）', () => {
    expect(MAP_HELPERS).toMatch(/const\s+isFocused\s*=\s*typeof\s+style\.zIndex\s*===\s*'number'\s*&&\s*style\.zIndex\s*>=\s*1000/);
  });

  it('markerContent focused 時用 accent outer ring (169,122,74,0.35) + 加深 drop shadow (42,31,24,0.35)', () => {
    expect(MAP_HELPERS).toMatch(/rgba\(169,\s*122,\s*74,\s*0?\.35\)/);
    expect(MAP_HELPERS).toMatch(/rgba\(42,\s*31,\s*24,\s*0?\.35\)/);
  });

  it('markerContent focused 時 inline style 含 z-index:1000 浮頂', () => {
    // markerContent 內 isFocused 條件 render `z-index: 1000;`
    expect(MAP_HELPERS).toMatch(/isFocused\s*\?\s*'z-index:\s*1000;'/);
  });
});
