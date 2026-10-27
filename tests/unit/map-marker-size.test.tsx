/**
 * Value: protects=地圖 marker 在 100% 下外框尺寸與 #1445 之前相同; fails_when=markerContent 加回 box-sizing:border-box 或 padding（外框縮 3px／放大）; why_new=map-marker-text-contrast 在 node 環境跑、沒有 document，量不到 markerContent 的樣式; seam=none; no_claim=實際繪製像素（只驗內聯樣式字串）
 *
 * #1445 F16 把 marker 的 width/height 改成 min-width/min-height 讓大字型下能撐開。/ship adversarial 發現第一版
 * 同時加了 box-sizing:border-box 與 padding，100% 下外框（border-box 含邊框）縮了 3px、不是等值。
 */
import { describe, it, expect } from 'vitest';
import { markerStyle, markerContent } from '../../src/lib/mapHelpers';
import type { MapPin } from '../../src/hooks/useMapData';

const PIN: MapPin = { id: 1, index: 3, title: 'X', type: 'attraction', lat: 26.21, lng: 127.72, sortOrder: 1 };

describe('marker 尺寸（100% 等值）', () => {
  it('以 min-width／min-height 取代 width／height，且不加 box-sizing 與 padding', () => {
    const el = markerContent(markerStyle(PIN, false, false));
    expect(el.style.minWidth).toBe('28px');
    expect(el.style.minHeight).toBe('28px');
    expect(el.style.boxSizing).toBe('');
    expect(el.style.padding).toBe('');
  });

  it('focused 的 marker 為 36px', () => {
    const el = markerContent(markerStyle(PIN, true, false));
    expect(el.style.minWidth).toBe('36px');
    expect(el.style.minHeight).toBe('36px');
  });
});
