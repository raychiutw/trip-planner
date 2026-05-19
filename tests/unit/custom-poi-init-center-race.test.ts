/**
 * v2.32.1 fix — LocationPickerMap initialCenter race regression test。
 *
 * Bug context：ChangePoiPage / AddStopPage / AddCustomStopPage 用 useGoogleMap
 * 一 mount 就鎖 initialCenter。原本 customDestinations 初值 []，render 跑
 * `<CustomPoiForm initialCenter={Tokyo-fallback}>`，等 fetch resolve 後 React
 * 重 render，但 useGoogleMap 不接受 dynamic center → 地圖永遠卡 Tokyo。
 *
 * Fix：初值改 null（區分「未載入」與「載入後 0 個」），render 等 destinations !== null
 * 才 mount CustomPoiForm。fetch fail 走 catch setDestinations([]) → fallback chain
 * 仍走 Tokyo 但至少 mount。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const CHANGE_POI_SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/ChangePoiPage.tsx'),
  'utf8',
);

const ADD_STOP_SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/AddStopPage.tsx'),
  'utf8',
);

const ADD_CUSTOM_STOP_SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/AddCustomStopPage.tsx'),
  'utf8',
);

describe('ChangePoiPage — destinations init null + render gate', () => {
  it('customDestinations 初值為 null（非 []）', () => {
    expect(CHANGE_POI_SRC).toMatch(/useState<TripDestApiLite\[\]\s*\|\s*null>\(null\)/);
  });

  it('fetch effect 改 mount-gated（不再 tab !== custom return）', () => {
    expect(CHANGE_POI_SRC).not.toMatch(/if \(!tripId \|\| tab !== 'custom'\) return/);
  });

  it('fetch catch fallback 標 [] 避免永遠卡 null', () => {
    const idx = CHANGE_POI_SRC.indexOf('customDestinations');
    const ctx = CHANGE_POI_SRC.slice(0, idx + 5000);
    expect(ctx).toMatch(/setCustomDestinations\(\[\]\)/);
  });

  it('<CustomPoiForm> render 等 customDestinations !== null', () => {
    expect(CHANGE_POI_SRC).toMatch(/tab === 'custom' && customDestinations !== null/);
  });

  it('未載入時顯 placeholder loading', () => {
    expect(CHANGE_POI_SRC).toContain('change-poi-custom-loading');
  });
});

describe('AddStopPage — destinations init null + render gate', () => {
  it('customDestinations 初值為 null', () => {
    expect(ADD_STOP_SRC).toMatch(/useState<TripDestApiLite\[\]\s*\|\s*null>\(null\)/);
  });

  it('fetch effect 改 mount-gated', () => {
    expect(ADD_STOP_SRC).not.toMatch(/if \(!auth\.user \|\| !tripId \|\| tab !== 'custom'\) return/);
  });

  it('<CustomPoiForm> render 等 customDestinations !== null', () => {
    expect(ADD_STOP_SRC).toMatch(/tab === 'custom' && customDestinations !== null/);
  });

  it('未載入顯 placeholder loading', () => {
    expect(ADD_STOP_SRC).toContain('add-stop-custom-loading');
  });
});

describe('AddCustomStopPage — destinations init null + render gate', () => {
  it('destinations 初值為 null', () => {
    expect(ADD_CUSTOM_STOP_SRC).toMatch(/useState<TripDestApi\[\]\s*\|\s*null>\(null\)/);
  });

  it('LocationPickerMap render 等 destinations !== null', () => {
    expect(ADD_CUSTOM_STOP_SRC).toMatch(/destinations === null \?[\s\S]{0,200}<LocationPickerMap/);
  });
});
