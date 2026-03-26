import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * Test the V1/V2 routing logic independently.
 * The logic in main.tsx:
 *   const forceV1 = params.get('v1') === '1';
 *   const forceV2 = params.get('v2') === '1';
 *   const storedV2 = localStorage.getItem('tripline-v2') === '1';
 *   const useV2 = !forceV1 && (forceV2 || storedV2);
 */
function resolveV2(search: string, lsValue: string | null): boolean {
  const params = new URLSearchParams(search);
  const forceV1 = params.get('v1') === '1';
  const forceV2 = params.get('v2') === '1';
  const storedV2 = lsValue === '1';
  return !forceV1 && (forceV2 || storedV2);
}

describe('V1/V2 路由切換邏輯', () => {
  it('預設使用 V1（無 query string、無 localStorage）', () => {
    expect(resolveV2('', null)).toBe(false);
  });

  it('?v2=1 啟用 V2', () => {
    expect(resolveV2('?v2=1', null)).toBe(true);
  });

  it('?v1=1 強制使用 V1', () => {
    expect(resolveV2('?v1=1', null)).toBe(false);
  });

  it('localStorage tripline-v2=1 啟用 V2', () => {
    expect(resolveV2('', '1')).toBe(true);
  });

  it('?v1=1 覆蓋 localStorage V2（v1 優先級最高）', () => {
    expect(resolveV2('?v1=1', '1')).toBe(false);
  });
});
