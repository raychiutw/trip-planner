/**
 * owner 2026-07-22 #5：「第二欄功能開啟到第三欄再關閉時，畫面會跳到其他頁後再關閉」。
 *
 * 關閉第三欄 = TripStackLayout 的 closeStack → navigate('/trips?selected=:id')，
 * 換到 TripsListPage 這棵 tree。問題出在 effectiveSelectedId 的 fallback 在清單
 * 載入完成前就先算了一輪：
 *
 *   myIds === null（載入中）→ visibleTrips = []
 *   → visibleTrips.some(t => t.tripId === selectedFromUrl) 必為 false
 *   → fallback 到 visibleTrips[0] → undefined → null
 *   → showEmbeddedTrip = false → 中欄空一拍 / 露出清單
 *   → /api/trips 回來後才把行程放回中欄
 *
 * 那一拍就是使用者看到的「跳到其他頁後再關閉」。清單多筆時更糟：fallback 有機會
 * 先命中別的行程，畫面會閃到不相干的行程再跳回來。
 *
 * 這裡把那段判斷抽成純函式測，涵蓋載入中 / 載入完成 / selected 失效三種情形。
 */
import { describe, it, expect } from 'vitest';

/** 與 TripsListPage 的 effectiveSelectedId 同一份邏輯。 */
function resolveEffectiveSelected(
  selectedFromUrl: string | null,
  visibleTrips: { tripId: string }[],
  tripsLoaded: boolean,
): string | null {
  if (selectedFromUrl && (!tripsLoaded || visibleTrips.some((t) => t.tripId === selectedFromUrl))) {
    return selectedFromUrl;
  }
  return visibleTrips[0]?.tripId ?? null;
}

const TRIPS = [{ tripId: 'okinawa-Ray' }, { tripId: 'okinawa-HuiYun' }];

describe('關閉第三欄回 /trips?selected=X 時中欄不閃', () => {
  it('清單載入中 → 信任 URL 的 selected，不 fallback 成 null', () => {
    expect(resolveEffectiveSelected('okinawa-Ray', [], false)).toBe('okinawa-Ray');
  });

  it('清單載入中且有多筆快取殘留 → 仍以 URL 為準，不閃到別的行程', () => {
    expect(resolveEffectiveSelected('okinawa-Ray', TRIPS, false)).toBe('okinawa-Ray');
  });

  it('載入完成且 selected 可見 → 照舊回傳它', () => {
    expect(resolveEffectiveSelected('okinawa-Ray', TRIPS, true)).toBe('okinawa-Ray');
  });

  it('載入完成但 selected 不可見（已封存/刪除/無權限）→ fallback 到第一筆', () => {
    expect(resolveEffectiveSelected('deleted-trip', TRIPS, true)).toBe('okinawa-Ray');
  });

  it('載入完成、selected 不可見、且一筆都沒有 → null', () => {
    expect(resolveEffectiveSelected('deleted-trip', [], true)).toBeNull();
  });

  it('沒有 selected → 照舊 fallback 到第一筆（不受本次改動影響）', () => {
    expect(resolveEffectiveSelected(null, TRIPS, true)).toBe('okinawa-Ray');
    expect(resolveEffectiveSelected(null, TRIPS, false)).toBe('okinawa-Ray');
  });
});
