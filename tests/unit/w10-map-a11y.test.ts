/**
 * W10 · 地圖 a11y — marker/route 非純色區分 + /map safe-area（source-lock）。
 *
 * owner 2026-07-24 選「現在定義 + 做」。調查後定義：W10 的 substantive 要求
 * （marker/route **非純色區分**、/map safe-area 不壓 status bar / home indicator）
 * **已由既有地圖重設計（v2.56.1）+ marker/route 實作滿足** —— marker 帶編號標籤
 * （非純色）、route 對 approx/偶數日用虛線（color-blind aid）、TitleBar 讓 status bar、
 * 地圖浮卡讓 home indicator。故不做 marker 形狀重設計（圓形+編號已 color-blind 合規 +
 * HIG-aligned，重設計＝change-for-change's-sake）。
 *
 * 這裡 source-lock 住這些合規點，防未來重構把 color-blind / safe-area 弄丟。
 * 唯一未做：Google zoom 鈕套樣式（需打 Google 內部 class、fragile + CSS injection 風險），
 * 刻意 defer。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(__dirname, '../..', rel), 'utf8');

describe('W10 marker/route 非純色區分（color-blind）', () => {
  const helpers = read('src/lib/mapHelpers.ts');

  it('marker 帶編號標籤（非純色 → 色盲可靠數字辨識）', () => {
    // markerStyle 的 label = 站序 index（不是只靠 fill 顏色區分）。
    expect(helpers).toMatch(/label:\s*String\(pin\.index\)/);
  });

  it('route 對 approx / 偶數日用虛線（非純色 → 色盲輔助）', () => {
    // segmentStyle 走 dashed（approx fallback 或偶數日），非只靠顏色。
    expect(helpers).toMatch(/dashed\s*=\s*approx/);
    expect(helpers).toMatch(/dashArray|LineDash|Symbol|dashed \?/);
  });
});

describe('W10 /map safe-area 不壓 status bar / home indicator', () => {
  it('地圖浮卡讓 home indicator（bottom 含 nav-overlay-h + safe-area-inset-bottom）', () => {
    const map = read('src/pages/MapPage.tsx');
    expect(map).toMatch(/var\(--nav-overlay-h[^)]*\)[\s\S]{0,60}env\(safe-area-inset-bottom/);
  });

  it('TitleBar 讓 status bar（height/padding 含 safe-area-inset-top）', () => {
    const css = read('css/tokens.css');
    expect(css).toMatch(/env\(safe-area-inset-top/);
  });
});
