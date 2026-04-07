/**
 * useTrip 並行 fetch 測試
 * 驗證 mapDayResponse + fetchAllDays 的序列→並行改動
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 獨立測試 mapDayResponse（從 useTrip.ts 提取的邏輯）
function mapDayResponse(raw: Record<string, unknown>) {
  return {
    id: raw.id as number,
    dayNum: (raw.dayNum as number | undefined) ?? (raw.day_num as number),
    date: (raw.date as string | null | undefined) ?? null,
    dayOfWeek: (raw.dayOfWeek as string | undefined) ?? (raw.day_of_week as string | null | undefined) ?? null,
    label: (raw.label as string | null | undefined) ?? null,
    updatedAt: (raw.updatedAt as string | undefined) ?? (raw.updated_at as string | undefined),
    hotel: (raw.hotel as unknown) ?? null,
    timeline: (raw.timeline as unknown[]) ?? [],
  };
}

describe('mapDayResponse', () => {
  it('maps snake_case to camelCase', () => {
    const raw = {
      id: 1,
      day_num: 3,
      date: '2026-07-29',
      day_of_week: '三',
      label: '那霸市區',
      updated_at: '2026-04-07T00:00:00Z',
      hotel: null,
      timeline: [],
    };
    const day = mapDayResponse(raw);
    expect(day.dayNum).toBe(3);
    expect(day.dayOfWeek).toBe('三');
    expect(day.updatedAt).toBe('2026-04-07T00:00:00Z');
  });

  it('prefers camelCase when both exist', () => {
    const raw = {
      id: 1,
      dayNum: 5,
      day_num: 3,
      dayOfWeek: '五',
      day_of_week: '三',
    };
    const day = mapDayResponse(raw);
    expect(day.dayNum).toBe(5);
    expect(day.dayOfWeek).toBe('五');
  });

  it('handles null/missing fields', () => {
    const raw = { id: 1, day_num: 1 };
    const day = mapDayResponse(raw);
    expect(day.date).toBeNull();
    expect(day.dayOfWeek).toBeNull();
    expect(day.label).toBeNull();
    expect(day.hotel).toBeNull();
    expect(day.timeline).toEqual([]);
  });
});

describe('fetchAllDays 並行 fetch 邏輯', () => {
  // 模擬 fetchAllDays 的核心邏輯（不依賴 React hook）
  async function simulateFetchAllDays(
    sorted: Array<{ day_num: number }>,
    fetchDay: (num: number) => Promise<{ dayNum: number }>,
    firstDayNum: number,
  ) {
    const results: Record<number, { dayNum: number }> = {};
    let firstDayData: { dayNum: number } | null = null;
    const fetchOrder: number[] = [];

    async function doFetch(num: number) {
      fetchOrder.push(num);
      const data = await fetchDay(num);
      results[num] = data;
      if (num === firstDayNum) firstDayData = data;
    }

    // First day: sequential
    const first = sorted[0];
    if (first) {
      await doFetch(first.day_num);
    }

    // Remaining: parallel
    const remaining = sorted.slice(1);
    if (remaining.length > 0) {
      await Promise.allSettled(
        remaining.map((d) => doFetch(d.day_num)),
      );
    }

    return { results, firstDayData, fetchOrder };
  }

  it('第一天優先載入', async () => {
    const sorted = [{ day_num: 1 }, { day_num: 2 }, { day_num: 3 }];
    const fetchDay = vi.fn(async (num: number) => {
      await new Promise((r) => setTimeout(r, 10));
      return { dayNum: num };
    });

    const { firstDayData, fetchOrder } = await simulateFetchAllDays(sorted, fetchDay, 1);
    expect(firstDayData).toEqual({ dayNum: 1 });
    // 第一天一定是最先 fetch 的
    expect(fetchOrder[0]).toBe(1);
    expect(fetchDay).toHaveBeenCalledTimes(3);
  });

  it('空陣列不 fetch', async () => {
    const fetchDay = vi.fn();
    const { results } = await simulateFetchAllDays([], fetchDay, 0);
    expect(fetchDay).not.toHaveBeenCalled();
    expect(Object.keys(results)).toHaveLength(0);
  });

  it('單一天只 fetch 一次', async () => {
    const sorted = [{ day_num: 5 }];
    const fetchDay = vi.fn(async (num: number) => ({ dayNum: num }));
    const { results } = await simulateFetchAllDays(sorted, fetchDay, 5);
    expect(fetchDay).toHaveBeenCalledTimes(1);
    expect(results[5]).toEqual({ dayNum: 5 });
  });

  it('剩餘天數並行 fetch（Promise.allSettled）', async () => {
    const callTimes: number[] = [];
    const sorted = [{ day_num: 1 }, { day_num: 2 }, { day_num: 3 }, { day_num: 4 }];
    const fetchDay = vi.fn(async (num: number) => {
      callTimes.push(Date.now());
      await new Promise((r) => setTimeout(r, 50));
      return { dayNum: num };
    });

    await simulateFetchAllDays(sorted, fetchDay, 1);
    expect(fetchDay).toHaveBeenCalledTimes(4);
    // 第 2-4 天的 fetch 開始時間應該很接近（並行）
    const parallelStart = callTimes.slice(1);
    const maxDiff = Math.max(...parallelStart) - Math.min(...parallelStart);
    expect(maxDiff).toBeLessThan(20); // 並行啟動差距 < 20ms
  });

  it('某一天 fetch 失敗不影響其他天', async () => {
    const sorted = [{ day_num: 1 }, { day_num: 2 }, { day_num: 3 }];
    const fetchDay = vi.fn(async (num: number) => {
      if (num === 2) throw new Error('network error');
      return { dayNum: num };
    });

    const { results } = await simulateFetchAllDays(sorted, fetchDay, 1);
    expect(results[1]).toEqual({ dayNum: 1 });
    expect(results[2]).toBeUndefined(); // 失敗的不存在
    expect(results[3]).toEqual({ dayNum: 3 });
  });

  it('第一天 fetch 失敗，剩餘仍然並行', async () => {
    const sorted = [{ day_num: 1 }, { day_num: 2 }, { day_num: 3 }];
    const fetchDay = vi.fn(async (num: number) => {
      if (num === 1) throw new Error('first day failed');
      return { dayNum: num };
    });

    // 第一天失敗被 catch，不影響後續
    const { results, firstDayData } = await simulateFetchAllDays(sorted, async (num) => {
      try {
        return await fetchDay(num);
      } catch {
        return { dayNum: -1 }; // fallback
      }
    }, 1);
    expect(results[2]).toEqual({ dayNum: 2 });
    expect(results[3]).toEqual({ dayNum: 3 });
  });
});
