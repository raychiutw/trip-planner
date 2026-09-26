/**
 * useMyTrips / useTripSelection — 聊天與側欄共用可存取行程清單及 active trip。
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
 * 以使用者 ID 隔離快取，合併同時讀取；建立／更新通知重讀清單，較舊結果不覆蓋
 * 較新結果。讀取失敗保留已知資料，不能當成已確認的空清單。
 */
import { useEffect, useSyncExternalStore } from 'react';
import { apiFetch } from '../lib/apiClient';
import { EVENT } from '../lib/events';
import { useActiveTrip } from '../contexts/ActiveTripContext';

export interface MyTrip {
  tripId: string;
  name: string;
  title?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  totalDays?: number;
  dayCount?: number;
  countries?: string | null;
}

export type MyTripsState = { trips: MyTrip[] | undefined; status: 'loading' | 'ready' | 'error' };
const PENDING: MyTripsState = { trips: undefined, status: 'loading' };
let ownerId: string | null = null;
let state: MyTripsState = PENDING;
let inflight: Promise<void> | null = null;
let requestId = 0;
let eventsAttached = false;
const listeners = new Set<() => void>();

function notify() { for (const listener of listeners) listener(); }

function refresh() {
  if (!ownerId) return;
  const owner = ownerId;
  const request = ++requestId;
  state = { ...state, status: 'loading' };
  notify();
  inflight = apiFetch<MyTrip[]>('/my-trips')
    .then((data) => {
      if (request !== requestId || owner !== ownerId) return;
      if (!Array.isArray(data)) throw new Error('Invalid trip list');
      state = { trips: data, status: 'ready' };
      notify();
    })
    .catch(() => {
      if (request !== requestId || owner !== ownerId) return;
      state = { ...state, status: 'error' };
      notify();
    })
    .finally(() => { if (request === requestId) inflight = null; });
}

function onTripsUpdated() {
  if (listeners.size > 0) {
    refresh();
  } else {
    requestId++;
    inflight = null;
    state = PENDING;
  }
}

function ensureEvents() {
  if (eventsAttached) return;
  window.addEventListener(EVENT.tripCreated, onTripsUpdated);
  window.addEventListener(EVENT.tripUpdated, onTripsUpdated);
  eventsAttached = true;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Test-only：清 module cache（避免測試互相污染）。 */
export function __clearMyTripsCache(): void {
  ownerId = null;
  state = PENDING;
  inflight = null;
  requestId++;
  notify();
}

/**
 * @param userId auth gate and cache scope; 未登入不抓。
 * @returns `trips === undefined` = 尚未成功讀取；`[]` = 成功確認無行程。
 */
export function useMyTrips(userId: string | null | undefined): MyTripsState {
  const current = useSyncExternalStore(subscribe, () => ownerId === userId ? state : PENDING, () => PENDING);
  useEffect(() => {
    if (!userId) return;
    ensureEvents();
    if (ownerId !== userId) {
      ownerId = userId;
      state = PENDING;
      inflight = null;
      requestId++;
      notify();
    }
    if (!inflight && (state.status === 'error' || (state.status === 'loading' && state.trips === undefined))) refresh();
  }, [userId]);

  return current;
}

/** Shared accessible list and active preference. Explicit targets bypass list fallback. */
export function useTripSelection(
  userId: string | null | undefined,
  options: { explicitTripId?: string | null; fallback?: boolean } = {},
) {
  const list = useMyTrips(userId);
  const { activeTripId, setActiveTrip } = useActiveTrip();
  const explicitTripId = options.explicitTripId;
  const fallback = options.fallback ?? true;

  useEffect(() => {
    if (explicitTripId) {
      if (activeTripId !== explicitTripId) setActiveTrip(explicitTripId);
      return;
    }
    if (!fallback || list.status !== 'ready' || !list.trips) return;
    if (activeTripId && list.trips.some((trip) => trip.tripId === activeTripId)) return;
    const first = list.trips[0]?.tripId ?? null;
    if (first !== activeTripId) setActiveTrip(first);
  }, [explicitTripId, fallback, list.status, list.trips, activeTripId, setActiveTrip]);

  return { ...list, activeTripId: explicitTripId || activeTripId, setActiveTrip };
}
