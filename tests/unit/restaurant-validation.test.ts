import { describe, it, expect } from 'vitest';
import { validateRestaurantBody } from '../../functions/api/_validate';

/**
 * Unit tests for restaurants POST/PATCH 端點的必填欄位驗證邏輯。
 * 直接測試 validateRestaurantBody 函式，不需啟動完整 server。
 */

describe('validateRestaurantBody — 必填欄位缺失', () => {
  it('缺 name → 400', () => {
    const result = validateRestaurantBody({});
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain('name');
  });

  it('name 為空字串 → 400', () => {
    const result = validateRestaurantBody({ name: '' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain('name');
  });

  it('name 為 null → 400', () => {
    const result = validateRestaurantBody({ name: null as unknown as string });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain('name');
  });
});

describe('validateRestaurantBody — 必填欄位完整', () => {
  it('提供 name → 通過驗證', () => {
    const result = validateRestaurantBody({ name: '拉麵店' });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.error).toBeUndefined();
  });

  it('含額外欄位也通過驗證', () => {
    const result = validateRestaurantBody({
      name: '首里そば',
      category: '沖繩料理',
      hours: '11:00-20:00',
      price: '¥800',
      rating: 4.2,
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });
});

describe('validateRestaurantBody — 錯誤訊息格式', () => {
  it('錯誤訊息包含 "必填欄位缺失"', () => {
    const result = validateRestaurantBody({});
    expect(result.ok).toBe(false);
    expect(result.error).toBe('必填欄位缺失: name');
  });
});
