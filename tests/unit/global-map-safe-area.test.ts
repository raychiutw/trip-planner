/**
 * GlobalMapPage（root tab 底部導覽「地圖」/map）安全區收邊 — #1163。
 *
 * 對齊既有已修過的行程地圖頁（MapPage.tsx，見 w10-map-a11y.test.ts）：浮動 header
 * 吃裝置上緣 inset（env(safe-area-inset-top)），底部浮層（帳號圓圈以外的可互動
 * 元件：trip switcher、mobile POI card、bottom carousel）同時吃裝置下緣 inset
 * 與 root tab 讓位高度變數（--nav-overlay-h + env(safe-area-inset-bottom)）。
 *
 * 只斷言「有引用正確的變數」，不鎖視覺 px 數值（owner 已知的坑：純視覺數值鎖進
 * 測試會因日後微調假紅）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(
  join(__dirname, '../../src/pages/GlobalMapPage.tsx'),
  'utf8',
);

describe('#1163 GlobalMapPage /map 安全區收邊', () => {
  it('浮動 header（trip switcher）吃裝置上緣 inset', () => {
    const block = /\.tp-global-map-header\s*\{[^}]*\}/.exec(src)?.[0] ?? '';
    expect(block).toMatch(/env\(safe-area-inset-top/);
  });

  it('帳號圓圈浮層吃裝置上緣 inset', () => {
    const block = /\.tp-global-map-account\s*\{[^}]*\}/.exec(src)?.[0] ?? '';
    expect(block).toMatch(/env\(safe-area-inset-top/);
  });

  it('底部景點卡（bottom carousel）同時吃 --nav-overlay-h 與裝置下緣 inset', () => {
    const block = /\.tp-global-map-mobile-stack,\s*\n\.tp-map-entry-stack\s*\{[^}]*\}/.exec(src)?.[0] ?? '';
    expect(block).toMatch(/var\(--nav-overlay-h[^)]*\)[\s\S]{0,80}env\(safe-area-inset-bottom/);
  });

  it('mobile POI 詳情卡同時吃 --nav-overlay-h 與裝置下緣 inset', () => {
    const block = /\.tp-global-map-mobile-poi\s*\{[^}]*\}/.exec(src)?.[0] ?? '';
    expect(block).toMatch(/var\(--nav-overlay-h[^)]*\)[\s\S]{0,80}env\(safe-area-inset-bottom/);
  });
});
