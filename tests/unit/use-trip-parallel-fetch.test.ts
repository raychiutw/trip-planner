/**
 * useTrip 的 mapDayResponse 測試
 * （fetchAllDays 並行邏輯已在 v1.2.2 改為單一 batch fetch /days?all=1 取代）
 */
import { describe, it, expect } from 'vitest';

// 獨立測試 mapDayResponse（從 useTrip.ts 提取的邏輯）
function mapDayResponse(raw: Record<string, unknown>) {
  return {
    id: raw.id as number,
    dayNum: raw.dayNum as number,
    date: (raw.date as string | null | undefined) ?? null,
    dayOfWeek: (raw.dayOfWeek as string | null | undefined) ?? null,
    label: (raw.label as string | null | undefined) ?? null,
    updatedAt: raw.updatedAt as string | undefined,
    hotel: (raw.hotel as unknown) ?? null,
    timeline: (raw.timeline as unknown[]) ?? [],
  };
}

describe('mapDayResponse', () => {
  it('passes through camelCase fields', () => {
    const raw = {
      id: 1,
      dayNum: 3,
      date: '2026-07-29',
      dayOfWeek: '三',
      label: '那霸市區',
      updatedAt: '2026-04-07T00:00:00Z',
      hotel: null,
      timeline: [],
    };
    const day = mapDayResponse(raw);
    expect(day.dayNum).toBe(3);
    expect(day.dayOfWeek).toBe('三');
    expect(day.updatedAt).toBe('2026-04-07T00:00:00Z');
  });

  it('handles null/missing fields', () => {
    const raw = { id: 1, dayNum: 1 };
    const day = mapDayResponse(raw);
    expect(day.date).toBeNull();
    expect(day.dayOfWeek).toBeNull();
    expect(day.label).toBeNull();
    expect(day.hotel).toBeNull();
    expect(day.timeline).toEqual([]);
  });
});
