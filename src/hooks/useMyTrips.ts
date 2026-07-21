/**
 * useMyTrips — app-wide sidebar「我的行程」清單來源（rev2 shell）。
 *
 * rev2：桌機左欄 sidebar 由 primary-nav 改為「我的行程」清單（primary nav
 * 移到底部浮動玻璃膠囊）。清單資料走 `GET /api/my-trips`
 * （`FROM trip_permissions WHERE p.user_id = ?`，純看權限、不看 published）。
 *
 * 2026-07-21 之前打的是 `all=1` 版的公開清單端點 —— 但那個參數需要
 * `ops:trips:read` service-token scope，一般使用者拿不到，於是**靜默降級**成
 * 只回 published 行程，等於用「全站公開行程」冒充「我的行程」。過去看起來能用
 * 純粹因為前端建立行程時寫死 published=1；v2.57.0 移除該預設、v2.57.1 把既有
 * 行程改為不公開後，側邊欄就空了（owner 2026-07-21 回報「尚無行程」）。
 *
 * Module-cached：sidebar 是 app-level 且跨頁面切換保留 mount，但為防任何重掛
 * 重打 /api/my-trips，快取在 module scope，第一次 fetch 後共用；`tp-trips-updated`
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
    inflight = apiFetch<MyTrip[]>('/my-trips')
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
