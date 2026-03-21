import { describe, it, expect } from 'vitest';
import { validateDayBody } from '../../functions/api/_validate';

/**
 * Unit tests for days PUT 端點的必填欄位驗證邏輯。
 * 直接測試 validateDayBody 函式，不需啟動完整 server。
 */

describe('validateDayBody — 必填欄位缺失', () => {
  it('缺 date → 400', () => {
    const result = validateDayBody({ dayOfWeek: '一', label: '抵達那霸' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain('date');
  });

  it('缺 dayOfWeek → 400', () => {
    const result = validateDayBody({ date: '2026-07-01', label: '抵達那霸' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain('dayOfWeek');
  });

  it('缺 label → 400', () => {
    const result = validateDayBody({ date: '2026-07-01', dayOfWeek: '三' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain('label');
  });

  it('同時缺 date 與 dayOfWeek → 400，error 同時包含兩者', () => {
    const result = validateDayBody({ label: '抵達' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain('date');
    expect(result.error).toContain('dayOfWeek');
  });

  it('三個欄位全缺 → 400，error 包含 date、dayOfWeek、label', () => {
    const result = validateDayBody({});
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain('date');
    expect(result.error).toContain('dayOfWeek');
    expect(result.error).toContain('label');
  });
});

describe('validateDayBody — date 格式驗證', () => {
  it('date 格式錯誤（缺分隔符）→ 400', () => {
    const result = validateDayBody({ date: '20260701', dayOfWeek: '三', label: '抵達那霸' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain('YYYY-MM-DD');
  });

  it('date 格式錯誤（非數字）→ 400', () => {
    const result = validateDayBody({ date: '2026/07/01', dayOfWeek: '三', label: '抵達那霸' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain('YYYY-MM-DD');
  });

  it('date 格式錯誤（文字）→ 400', () => {
    const result = validateDayBody({ date: '七月一日', dayOfWeek: '三', label: '抵達那霸' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain('YYYY-MM-DD');
  });
});

describe('validateDayBody — label 長度驗證', () => {
  it('label 超過 8 字 → 400', () => {
    const result = validateDayBody({ date: '2026-07-01', dayOfWeek: '三', label: '123456789' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain('8 字');
  });

  it('label 剛好 8 字 → 通過驗證', () => {
    const result = validateDayBody({ date: '2026-07-01', dayOfWeek: '三', label: '12345678' });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });
});

describe('validateDayBody — 全部正確', () => {
  it('所有必填欄位完整且格式正確 → 通過驗證（不被驗證擋）', () => {
    const result = validateDayBody({
      date: '2026-07-01',
      dayOfWeek: '三',
      label: '抵達那霸',
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.error).toBeUndefined();
  });

  it('含額外欄位（weather、hotel、timeline）也通過驗證', () => {
    const result = validateDayBody({
      date: '2026-07-05',
      dayOfWeek: '日',
      label: '南部一日',
      weather: { label: '那霸', icon: 'sunny' },
      hotel: { name: '縣民ビーチホテル', checkout: '11:00' },
      timeline: [],
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  it('中文 label（≤ 8 字）通過驗證', () => {
    const result = validateDayBody({
      date: '2026-07-03',
      dayOfWeek: '五',
      label: '美麗海水族館',
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });
});
