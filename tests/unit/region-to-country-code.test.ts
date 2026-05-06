/**
 * regionToCountryCode contract — v2.23.3 hotfix verification.
 *
 * Bug：用戶選「東京」filter 但 usePoiSearch 沒傳 regionCode → Google fallback to
 * caller IP（台灣）→ Taipei results。修：city 中文 → ISO alpha-2 mapping。
 */
import { describe, it, expect } from 'vitest';
import { regionToCountryCode } from '../../src/lib/maps/region';

describe('regionToCountryCode', () => {
  it('Japan cities → JP', () => {
    expect(regionToCountryCode('東京')).toBe('JP');
    expect(regionToCountryCode('沖繩')).toBe('JP');
    expect(regionToCountryCode('京都')).toBe('JP');
    expect(regionToCountryCode('大阪')).toBe('JP');
    expect(regionToCountryCode('北海道')).toBe('JP');
  });

  it('Korea cities → KR', () => {
    expect(regionToCountryCode('首爾')).toBe('KR');
    expect(regionToCountryCode('釜山')).toBe('KR');
  });

  it('Taiwan cities → TW', () => {
    expect(regionToCountryCode('台北')).toBe('TW');
    expect(regionToCountryCode('台南')).toBe('TW');
  });

  it('「全部地區」→ undefined（no bias, accepted IP fallback）', () => {
    expect(regionToCountryCode('全部地區')).toBeUndefined();
  });

  it('null / empty → undefined', () => {
    expect(regionToCountryCode(null)).toBeUndefined();
    expect(regionToCountryCode(undefined)).toBeUndefined();
    expect(regionToCountryCode('')).toBeUndefined();
  });

  it('未收錄 city（user 自訂輸入）→ undefined', () => {
    expect(regionToCountryCode('火星')).toBeUndefined();
    expect(regionToCountryCode('Atlantis')).toBeUndefined();
  });

  it('trims surrounding whitespace', () => {
    expect(regionToCountryCode('  東京  ')).toBe('JP');
  });
});
