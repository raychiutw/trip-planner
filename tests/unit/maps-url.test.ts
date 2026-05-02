/**
 * mapsUrl unit tests — verify URL shape per provider + coords vs name fallback.
 */
import { describe, it, expect } from 'vitest';
import { buildMapsUrl } from '../../src/lib/mapsUrl';

const TOKYO_TOWER = {
  name: '東京タワー',
  address: '東京都港区芝公園4-2-8',
  lat: 35.6586,
  lng: 139.7454,
};

describe('buildMapsUrl', () => {
  it('Google: with coords → query=lat,lng', () => {
    const url = buildMapsUrl(TOKYO_TOWER, 'google');
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
    expect(url).toContain(encodeURIComponent('35.6586,139.7454'));
  });

  it('Google: no coords → query=name+address', () => {
    const url = buildMapsUrl({ name: '東京タワー', address: '東京都港区' }, 'google');
    expect(url).toContain(encodeURIComponent('東京タワー 東京都港区'));
  });

  it('Apple: with coords → ll= + q= (label)', () => {
    const url = buildMapsUrl(TOKYO_TOWER, 'apple');
    expect(url).toMatch(/^https:\/\/maps\.apple\.com\/\?ll=/);
    expect(url).toContain('ll=' + encodeURIComponent('35.6586,139.7454'));
    expect(url).toContain('q=' + encodeURIComponent('東京タワー 東京都港区芝公園4-2-8'));
  });

  it('Apple: no coords → ?q=name only', () => {
    const url = buildMapsUrl({ name: '東京タワー' }, 'apple');
    expect(url).toBe('https://maps.apple.com/?q=' + encodeURIComponent('東京タワー'));
  });

  it('Naver: keyword search regardless of coords', () => {
    const a = buildMapsUrl(TOKYO_TOWER, 'naver');
    const b = buildMapsUrl({ name: '東京タワー' }, 'naver');
    expect(a).toMatch(/^https:\/\/map\.naver\.com\/v5\/search\//);
    expect(b).toMatch(/^https:\/\/map\.naver\.com\/v5\/search\//);
    expect(a).toContain(encodeURIComponent('東京タワー'));
  });

  it('default provider is google', () => {
    expect(buildMapsUrl(TOKYO_TOWER)).toBe(buildMapsUrl(TOKYO_TOWER, 'google'));
  });

  it('skips falsy address in label', () => {
    const url = buildMapsUrl({ name: '東京タワー', address: null }, 'apple');
    expect(url).toContain('q=' + encodeURIComponent('東京タワー'));
    expect(url).not.toContain(encodeURIComponent('null'));
  });

  it('treats lat=NaN as no coords', () => {
    const url = buildMapsUrl({ name: 'X', lat: NaN, lng: NaN }, 'google');
    expect(url).not.toMatch(/query=NaN/);
    expect(url).toContain('query=X');
  });

  it('treats lat=0 / lng=0 as valid (null island)', () => {
    const url = buildMapsUrl({ name: 'X', lat: 0, lng: 0 }, 'google');
    expect(url).toContain(encodeURIComponent('0,0'));
  });
});
