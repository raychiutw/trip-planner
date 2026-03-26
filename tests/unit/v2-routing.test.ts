import { describe, it, expect } from 'vitest';
import { resolveV2 } from '../../src/lib/v2routing';

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
