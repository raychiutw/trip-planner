// @vitest-environment jsdom
/**
 * getTotalKm — 每日累積距離改吃 segments 即時值（2026-07-07 user 回報）
 *
 * 原本 sum entry.travel.distanceM（day fetch snapshot）— 車程重算後
 * TravelPill 走 segmentMap 立即更新，累積 km 卻停在舊 snapshot。
 * 驗：即時值優先 / stale（computed_at=NULL）不計舊值 / 缺 row fallback
 * snapshot / segments 未載入全 fallback（原行為不變）。
 */
import { describe, it, expect } from 'vitest';
import { getTotalKm } from '../../src/components/trip/DaySection';
import type { TripSegment } from '../../src/hooks/useTripSegments';

function seg(from: number, to: number, distanceM: number | null, computedAt: number | null = 1): [string, TripSegment] {
  return [`${from}-${to}`, {
    id: from * 100 + to, tripId: 't1', fromEntryId: from, toEntryId: to,
    mode: 'driving', min: 10, distanceM, source: 'google', computedAt, updatedAt: 1,
  }];
}

const entry = (id: number, travelDistanceM?: number | null) => ({
  id,
  travel: travelDistanceM != null ? { distanceM: travelDistanceM } : undefined,
});

describe('getTotalKm — segments 即時值優先', () => {
  it('segmentMap 有值 → 用即時值（忽略 stale snapshot）', () => {
    const map = new Map([seg(1, 2, 5000), seg(2, 3, 7000)]);
    // snapshot 是舊值 999999，不該被用
    expect(getTotalKm([entry(1, 999999), entry(2, 999999), entry(3)], map)).toBe(12);
  });

  it('pair 缺 row → 該段 fallback snapshot；其餘用即時值', () => {
    const map = new Map([seg(1, 2, 5000)]);
    // 2-3 缺 row → 用 entry(2).travel 4000
    expect(getTotalKm([entry(1, 999999), entry(2, 4000), entry(3)], map)).toBe(9);
  });

  it('stale 段（computed_at=NULL，換 POI 等重算）不計舊值 — 對齊 pill 不顯示行為', () => {
    const map = new Map([seg(1, 2, 5000, null), seg(2, 3, 7000)]);
    expect(getTotalKm([entry(1, 999999), entry(2), entry(3)], map)).toBe(7);
  });

  it('segments 未載入（空 map）→ 全 fallback snapshot（原行為）', () => {
    expect(getTotalKm([entry(1, 5000), entry(2, 7000), entry(3)], new Map())).toBe(12);
  });

  it('完全無資料 → null', () => {
    expect(getTotalKm([entry(1), entry(2)], new Map())).toBeNull();
  });
});
