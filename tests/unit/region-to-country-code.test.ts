/**
 * regionToCountryCode contract — v2.23.3 hotfix verification.
 *
 * Bug：用戶選「東京」filter 但 usePoiSearch 沒傳 regionCode → Google fallback to
 * caller IP（台灣）→ Taipei results。修：city 中文 → ISO alpha-2 mapping。
 */
import { describe, it, expect } from 'vitest';
import { regionToCountryCode, regionToLocationBias, regionToApiParam } from '../../src/lib/maps/region';

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

describe('regionToLocationBias', () => {
  it('東京 → JP locationBias circle 中心 ≈ 35.67, 139.65（v2.23.4 city-level bias）', () => {
    const b = regionToLocationBias('東京');
    expect(b).toBeDefined();
    expect(b!.countryCode).toBe('JP');
    expect(b!.lat).toBeCloseTo(35.67, 1);
    expect(b!.lng).toBeCloseTo(139.65, 1);
    expect(b!.radiusMeters).toBeGreaterThan(0);
    expect(b!.radiusMeters).toBeLessThanOrEqual(50000);
  });

  it('沖繩 → JP locationBias 那霸（≈ 26.21, 127.68）', () => {
    const b = regionToLocationBias('沖繩');
    expect(b!.countryCode).toBe('JP');
    expect(b!.lat).toBeCloseTo(26.21, 1);
    expect(b!.lng).toBeCloseTo(127.68, 1);
  });

  it('「全部地區」/ 未收錄 / null → undefined', () => {
    expect(regionToLocationBias('全部地區')).toBeUndefined();
    expect(regionToLocationBias('Atlantis')).toBeUndefined();
    expect(regionToLocationBias(null)).toBeUndefined();
  });
});

describe('regionToApiParam', () => {
  it('keep city 中文 raw（API endpoint 用來查 locationBias）', () => {
    expect(regionToApiParam('東京')).toBe('東京');
    expect(regionToApiParam('沖繩')).toBe('沖繩');
  });

  it('「全部地區」→ undefined（URL 不加 region 參數）', () => {
    expect(regionToApiParam('全部地區')).toBeUndefined();
  });

  it('null / empty / whitespace-only → undefined', () => {
    expect(regionToApiParam(null)).toBeUndefined();
    expect(regionToApiParam(undefined)).toBeUndefined();
    expect(regionToApiParam('')).toBeUndefined();
    expect(regionToApiParam('   ')).toBeUndefined();
  });

  it('trims whitespace', () => {
    expect(regionToApiParam('  東京  ')).toBe('東京');
  });
});
