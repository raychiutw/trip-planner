/**
 * ocean-map-marker-no-emoji — verify markerIcon never produces emoji label or
 * decorative symbols (post v2.23.0 Google Maps rewrite).
 *
 * Old Leaflet version used `L.divIcon({ html: '...' })` which COULD smuggle
 * emoji into HTML; v2.23 uses `google.maps.MarkerLabel` { text } where the
 * text is `String(pin.index)` — pure number, no emoji possible. This test
 * locks that invariant against future regressions (someone adding 🛏 hotel
 * icon back, etc).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setupGoogleMapsMock } from './__mocks__/google-maps';
import { markerIcon } from '../../src/components/trip/OceanMap';
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
    // Emoji ranges (loose): surrogate pairs (cp > 0xFFFF) + Misc Symbols/Dingbats blocks
    if (cp > 0xFFFF) return true;
    if (cp >= 0x2600 && cp <= 0x27BF) return true;
  }
  return false;
}

describe('OceanMap markerIcon — no emoji label (post v2.23.0)', () => {
  it('idle entry pin: label.text 是純數字「3」', () => {
    const opts = markerIcon(SAMPLE, false, false);
    expect(opts.label.text).toBe('3');
    expect(containsEmoji(opts.label.text)).toBe(false);
  });

  it('hotel pin: label.text 也是純數字（不再 🛏）', () => {
    const opts = markerIcon(HOTEL, false, false);
    expect(opts.label.text).toBe('1');
    expect(containsEmoji(opts.label.text)).toBe(false);
  });

  it('focused (active) marker: 仍是純數字 + 較大 size', () => {
    const opts = markerIcon(SAMPLE, true, false);
    expect(opts.label.text).toBe('3');
    expect(containsEmoji(opts.label.text)).toBe(false);
    expect(opts.icon.scale).toBeGreaterThan(15); // larger than idle 14
  });

  it('past pin: label 同 idle，色彩降級 mute', () => {
    const opts = markerIcon(SAMPLE, false, true);
    expect(opts.label.text).toBe('3');
    expect(containsEmoji(opts.label.text)).toBe(false);
  });

  it('icon path 是 SymbolPath.CIRCLE（不是任何 SVG path with decorative shape）', () => {
    const opts = markerIcon(SAMPLE, false, false);
    // SymbolPath.CIRCLE = 0 in our mock; in real google.maps it's enum 0
    expect(opts.icon.path).toBe(0);
  });

  it('focused pin sets zIndex 1000 (raises above overlapping markers)', () => {
    const opts = markerIcon(SAMPLE, true, false);
    expect(opts.zIndex).toBe(1000);
  });

  it('idle pin zIndex undefined (Google default)', () => {
    const opts = markerIcon(SAMPLE, false, false);
    expect(opts.zIndex).toBeUndefined();
  });

  it('dayColor inline style applies to idle marker stroke + label color', () => {
    const opts = markerIcon(SAMPLE, false, false, '#FF6B35');
    expect(opts.icon.strokeColor).toBe('#FF6B35');
    expect(opts.label.color).toBe('#FF6B35');
  });

  it('dayColor IGNORED when active (accent color overrides)', () => {
    const opts = markerIcon(SAMPLE, true, false, '#FF6B35');
    expect(opts.icon.strokeColor).not.toBe('#FF6B35');
    expect(opts.label.color).not.toBe('#FF6B35');
  });
});
