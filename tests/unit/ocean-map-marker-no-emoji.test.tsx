/**
 * ocean-map-marker-no-emoji — verify marker label never produces emoji or
 * decorative symbols (post v2.23.0 Google Maps + v2.31.75 AdvancedMarkerElement migration).
 *
 * v2.23 用 google.maps.MarkerLabel { text }; v2.31.75 改 AdvancedMarkerElement
 * 用 HTMLDivElement.textContent。兩種都用 `String(pin.index)` 純數字，無 emoji
 * 可能。Test 透過 `markerStyle.label` (pure data) lock 此 invariant 不需 DOM。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setupGoogleMapsMock } from './__mocks__/google-maps';
import { markerStyle, markerContent } from '../../src/components/trip/OceanMap';
import type { MapPin } from '../../src/hooks/useMapData';

beforeEach(setupGoogleMapsMock);

const SAMPLE: MapPin = {
  id: 1,
  index: 3,
  title: '首里城公園',
  type: 'attraction',
  lat: 26.21,
  lng: 127.72,
  sortOrder: 1,
};

const HOTEL: MapPin = { ...SAMPLE, id: 2, index: 1, title: 'Hotel ABC', type: 'hotel' };

/**
 * 任何包含 emoji / surrogate pair / 非 BMP 字元 的字串都該 fail 此 detector.
 * Plain ASCII + CJK + 標點都 OK。
 */
function containsEmoji(s: string): boolean {
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (cp > 0xFFFF) return true;
    if (cp >= 0x2600 && cp <= 0x27BF) return true;
  }
  return false;
}

describe('OceanMap markerStyle — no emoji label (post v2.31.75 AdvancedMarkerElement)', () => {
  it('idle entry pin: label 是純數字「3」', () => {
    const style = markerStyle(SAMPLE, false, false);
    expect(style.label).toBe('3');
    expect(containsEmoji(style.label)).toBe(false);
  });

  it('hotel pin: label 也是純數字（不再 🛏）', () => {
    const style = markerStyle(HOTEL, false, false);
    expect(style.label).toBe('1');
    expect(containsEmoji(style.label)).toBe(false);
  });

  it('focused (active) marker: 仍是純數字 + 較大 size', () => {
    const style = markerStyle(SAMPLE, true, false);
    expect(style.label).toBe('3');
    expect(containsEmoji(style.label)).toBe(false);
    expect(style.size).toBeGreaterThan(28); // larger than idle 28 → focused 36
  });

  it('past pin: label 同 idle，色彩降級 mute', () => {
    const style = markerStyle(SAMPLE, false, true);
    expect(style.label).toBe('3');
    expect(containsEmoji(style.label)).toBe(false);
  });

  it('focused pin sets zIndex 1000 (raises above overlapping markers)', () => {
    const style = markerStyle(SAMPLE, true, false);
    expect(style.zIndex).toBe(1000);
  });

  it('idle pin zIndex undefined (Google default)', () => {
    const style = markerStyle(SAMPLE, false, false);
    expect(style.zIndex).toBeUndefined();
  });

  it('dayColor inline style applies to idle marker stroke + label color', () => {
    const style = markerStyle(SAMPLE, false, false, '#FF6B35');
    expect(style.stroke).toBe('#FF6B35');
    expect(style.text).toBe('#FF6B35');
  });

  it('dayColor IGNORED when active (accent color overrides)', () => {
    const style = markerStyle(SAMPLE, true, false, '#FF6B35');
    expect(style.stroke).not.toBe('#FF6B35');
    expect(style.text).not.toBe('#FF6B35');
  });

  it('markerContent renders pure number text (no emoji injection possible via DOM)', () => {
    const style = markerStyle(SAMPLE, false, false);
    const el = markerContent(style);
    expect(el.textContent).toBe('3');
    expect(containsEmoji(el.textContent ?? '')).toBe(false);
  });

  it('markerContent border-radius is 50% (round shape per v2.23 Symbol.CIRCLE replacement)', () => {
    const style = markerStyle(SAMPLE, false, false);
    const el = markerContent(style);
    expect(el.style.borderRadius).toBe('50%');
  });
});
