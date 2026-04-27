/**
 * OceanMap markerIcon — no-emoji regression test.
 *
 * Spec: openspec/changes/terracotta-pages-refactor/specs/terracotta-page-layout/spec.md
 *       Requirement「Marker 視覺規格（移除 emoji）」
 *
 * 對應 DESIGN.md L383「不用 emoji」+ anti-slop L2-5。
 * Hotel marker 必須跟 entry marker 一樣顯示純數字 String(pin.index)，
 * 不得使用 🛏 或任何 emoji 字元。
 */
import { describe, it, expect } from 'vitest';
import type { MapPin } from '../../src/hooks/useMapData';
import { markerIcon } from '../../src/components/trip/OceanMap';

const HOTEL_PIN: MapPin = {
  id: 1,
  type: 'hotel',
  index: 1,
  title: 'Super Hotel 名護',
  lat: 26.6,
  lng: 127.97,
  sortOrder: -1,
};

const ENTRY_PIN: MapPin = {
  id: 2,
  type: 'entry',
  index: 2,
  title: '古宇利大橋',
  lat: 26.7,
  lng: 127.99,
  sortOrder: 0,
};

function getHtml(icon: ReturnType<typeof markerIcon>): string {
  // L.divIcon stores html in options.html
  // Access via the internal options hash
  const html = (icon.options as { html?: string }).html ?? '';
  return typeof html === 'string' ? html : '';
}

describe('OceanMap markerIcon — 純數字（無 emoji）', () => {
  it('hotel pin label = String(pin.index)，無 🛏 emoji', () => {
    const icon = markerIcon(HOTEL_PIN, false, false);
    const html = getHtml(icon);
    expect(html).not.toContain('🛏');
    // 驗 label 為純數字
    expect(html).toMatch(/>1</);
  });

  it('entry pin label = String(pin.index)', () => {
    const icon = markerIcon(ENTRY_PIN, false, false);
    const html = getHtml(icon);
    expect(html).toMatch(/>2</);
  });

  it('hotel + entry 共用同一 label 渲染規則（皆 String(pin.index)）', () => {
    const hotel = getHtml(markerIcon({ ...HOTEL_PIN, index: 5 }, false, false));
    const entry = getHtml(markerIcon({ ...ENTRY_PIN, index: 5 }, false, false));
    // 兩者都應該有 >5< — entry 是純數字、hotel 不再是 🛏
    expect(hotel).toMatch(/>5</);
    expect(entry).toMatch(/>5</);
  });

  it('沒有任何 emoji unicode（U+1F000 - U+1FFFF range）出現在 marker html', () => {
    // 跨多種 pin index 與 state 確認
    const pins: MapPin[] = [
      { ...HOTEL_PIN, index: 1 },
      { ...HOTEL_PIN, index: 99 },
      { ...ENTRY_PIN, index: 1 },
    ];
    for (const pin of pins) {
      for (const focused of [true, false]) {
        for (const past of [true, false]) {
          const html = getHtml(markerIcon(pin, focused, past));
          // /[\u{1F300}-\u{1FAFF}]/u 涵蓋 emoji 主要範圍
          expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
        }
      }
    }
  });
});

describe('OceanMap markerIcon — dayColor inline style (idle only)', () => {
  it('idle marker 帶 dayColor：html 含 inline border-color + color 等於 dayColor', () => {
    const html = getHtml(markerIcon(ENTRY_PIN, false, false, '#7C3AED'));
    expect(html).toMatch(/style="[^"]*border-color:\s*#7C3AED/i);
    expect(html).toMatch(/style="[^"]*color:\s*#7C3AED/i);
  });

  it('active marker 即使有 dayColor 也不套 inline style（保留 src 既有 accent fill via CSS）', () => {
    const html = getHtml(markerIcon(ENTRY_PIN, true, false, '#7C3AED'));
    // active 時不套 inline border-color / color，由 .ocean-map-pin[data-state="active"] CSS 套 accent
    expect(html).not.toMatch(/style="[^"]*border-color/i);
  });

  it('past marker 即使有 dayColor 也不套 inline style（past 是 muted 灰）', () => {
    const html = getHtml(markerIcon(ENTRY_PIN, false, true, '#7C3AED'));
    expect(html).not.toMatch(/style="[^"]*border-color/i);
  });

  it('無 dayColor 參數：html 不含 inline border-color', () => {
    const html = getHtml(markerIcon(ENTRY_PIN, false, false));
    expect(html).not.toMatch(/style="[^"]*border-color/i);
  });

  it('hotel pin 也接受 dayColor（跟 entry 一致）', () => {
    const html = getHtml(markerIcon(HOTEL_PIN, false, false, '#BE123C'));
    expect(html).toMatch(/style="[^"]*border-color:\s*#BE123C/i);
  });
});
