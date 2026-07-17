/**
 * useMyTrips — app-wide sidebar「我的行程」清單來源（rev2 shell）。
 *
 * rev2：桌機左欄 sidebar 由 primary-nav 改為「我的行程」清單（primary nav
 * 移到底部浮動玻璃膠囊）。清單資料走 GET /api/trips?all=1（與 TripsListPage
 * 同端點）。
 *
 * Module-cached：sidebar 是 app-level 且跨頁面切換保留 mount，但為防任何重掛
 * 重打 /api/trips，快取在 module scope，第一次 fetch 後共用；`tp-trips-updated`
 * event（新增/刪除行程時 dispatch）→ 清快取重抓。
 */
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';

export interface MyTrip {
  tripId: string;
  name: string;
  title?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  dayCount?: number;
}

let cache: MyTrip[] | null = null;
let inflight: Promise<MyTrip[]> | null = null;

function load(): Promise<MyTrip[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = apiFetch<MyTrip[]>('/trips?all=1')
      .then((data) => {
        cache = Array.isArray(data) ? data : [];
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Test-only：清 module cache（避免測試互相污染）。 */
export function __clearMyTripsCache(): void {
  cache = null;
  inflight = null;
}

/**
 * @param enabled auth gate — 未登入不抓（sidebar loading/guest 態自行處理）。
 * @returns `trips === undefined` = 尚未 resolve；`[]` = 已抓、無行程。
 */
export function useMyTrips(enabled: boolean): { trips: MyTrip[] | undefined } {
  const [trips, setTrips] = useState<MyTrip[] | undefined>(cache ?? undefined);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    load()
      .then((t) => { if (alive) setTrips(t); })
      .catch(() => { if (alive) setTrips([]); });

    function onUpdate() {
      cache = null;
      load()
        .then((t) => { if (alive) setTrips(t); })
        .catch(() => {});
    }
    window.addEventListener('tp-trips-updated', onUpdate);
    return () => {
      alive = false;
      window.removeEventListener('tp-trips-updated', onUpdate);
    };
  }, [enabled]);

  return { trips };
}
