/**
 * #1445 F2：地圖 marker 的編號文字對比。
 *
 * marker 是 Google AdvancedMarkerElement 的 DOM content，e2e 擋掉 Google Maps 後根本不會出現，
 * axe 掃不到；production 實測白底圓內用 day palette 飽和階（-500）當編號色：天藍 2.77:1、
 * 玫瑰 3.67:1，10 色全部不達 4.5:1。這支直接對 markerStyle 的輸出算對比。
 *
 * marker 的 idle 底色恆為白（不隨主題），所以文字色必須是「白底上夠深」的固定 hex，
 * 不能用 var(--day-text-N)（深色主題下那組是給深底用的淺色，疊白底反而更差）。
 */
import { describe, it, expect } from 'vitest';
import { markerStyle } from '../../src/lib/mapHelpers';
import { DAY_PALETTE } from '../../src/lib/dayPalette';
import type { MapPin } from '../../src/hooks/useMapData';

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}
function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const PIN: MapPin = { id: 1, index: 3, title: 'X', type: 'attraction', lat: 26.21, lng: 127.72, sortOrder: 1 };

describe('marker 編號文字對比（idle，白底）', () => {
  DAY_PALETTE.forEach((dayCol, i) => {
    it(`day ${i + 1}（${dayCol}）編號 ≥ 4.5:1`, () => {
      const s = markerStyle(PIN, false, false, dayCol);
      expect(s.text).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(contrast(s.text, s.fill), `${s.text} on ${s.fill}`).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('描邊維持 day 飽和色（polyline 同色系的辨識）', () => {
    expect(markerStyle(PIN, false, false, DAY_PALETTE[0]).stroke).toBe(DAY_PALETTE[0]);
  });

  it('沒有 day 色時維持既有 idle 文字色', () => {
    const s = markerStyle(PIN, false, false);
    expect(s.text).toBe('#6A6A6A');
  });
});

describe('marker 字級（#1445 F16）', () => {
  it('編號字級用 rem（隨使用者字級放大），不是固定 px', () => {
    // 以 CSS 變數引用，fallback 為 rem；變數本身在 tokens.css 定義（手機以 px/17 等值修正）。
    expect(markerStyle(PIN, false, false).fontSize).toMatch(/^var\(--marker-font-size, [\d.]+rem\)$/);
    expect(markerStyle(PIN, true, false).fontSize).toMatch(/^var\(--marker-font-size-focused, [\d.]+rem\)$/);
  });
});
