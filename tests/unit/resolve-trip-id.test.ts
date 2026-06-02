/**
 * resolveTripId — TripPage 要渲染哪個 trip 的決策（v2.43.x bugfix 回歸測試）。
 *
 * Bug（QA 2026-06-02 prod 抓到）：明確導航到自己的私人 clone（?selected=cln-…，
 * published=0，不在 permission-filtered /api/trips）時，silently fallback 到第一個
 * published trip → 看到別的 trip 行程。
 */
import { describe, it, expect } from 'vitest';
import { resolveTripId } from '../../src/lib/resolveTripId';

const TRIPS = [
  { tripId: 'okinawa-HuiYun', published: 1 },
  { tripId: 'okinawa-Ray', published: 1 },
];

describe('resolveTripId', () => {
  it('明確 tripId 在清單裡 → 用該筆', () => {
    expect(resolveTripId('okinawa-Ray', true, TRIPS)).toBe('okinawa-Ray');
  });

  it('明確 tripId 不在清單（私人 clone）→ 信任它，不 fallback defaultTrip', () => {
    // 這是 bug 的核心：cln-X 不在 /api/trips，但它是明確導航目標 → 應回 cln-X。
    expect(resolveTripId('cln-X', true, TRIPS)).toBe('cln-X');
  });

  it('非明確 tripId（localStorage pref）不在清單 → fallback 第一個 published', () => {
    expect(resolveTripId('stale-pref-id', false, TRIPS)).toBe('okinawa-HuiYun');
  });

  it('無 tripId → fallback 第一個 published', () => {
    expect(resolveTripId(null, false, TRIPS)).toBe('okinawa-HuiYun');
  });

  it('無 tripId 且無 published trip → null', () => {
    expect(resolveTripId(null, false, [{ tripId: 'x', published: 0 }])).toBeNull();
  });

  it('明確 tripId 不在清單且無任何 published → 仍回該明確 tripId', () => {
    expect(resolveTripId('cln-Y', true, [])).toBe('cln-Y');
  });
});
