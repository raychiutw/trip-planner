import { describe, it, expect } from 'vitest';
import { validateEntryBody } from '../../functions/api/_validate';

/**
 * Unit tests for entries PATCH 端點的必填欄位驗證邏輯。
 * 直接測試 validateEntryBody 函式，不需啟動完整 server。
 */

describe('validateEntryBody — 必填欄位缺失', () => {
  it('缺 title → 400', () => {
    const result = validateEntryBody({});
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain('title');
  });

  it('title 為空字串 → 400', () => {
    const result = validateEntryBody({ title: '' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain('title');
  });

  it('title 為 null → 400', () => {
    const result = validateEntryBody({ title: null as unknown as string });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain('title');
  });
});

describe('validateEntryBody — 必填欄位完整', () => {
  it('提供 title → 通過驗證', () => {
    const result = validateEntryBody({ title: '首里城' });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.error).toBeUndefined();
  });

  it('含額外欄位也通過驗證', () => {
    const result = validateEntryBody({
      title: '美麗海水族館',
      time: '10:00',
      description: '世界第二大的水族館',
      googleRating: 4.5,
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });
});

describe('validateEntryBody — 錯誤訊息格式', () => {
  it('錯誤訊息包含 "必填欄位缺失"', () => {
    const result = validateEntryBody({});
    expect(result.ok).toBe(false);
    expect(result.error).toBe('必填欄位缺失: title');
  });
});
