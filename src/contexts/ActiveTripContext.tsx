/**
 * ActiveTripContext — app-level「目前選擇的行程」 state.
 *
 * Section 5 (terracotta-mockup-parity-v2 / E4): mockup 採 5-tab global IA
 * (聊天 / 行程 / 地圖 / 探索 / 帳號)，所有 nav 都是 global route，不再帶 trip
 * 參數。/map 跟 /chat 都需要知道「user 目前在規劃哪個 trip」 才能合理 default。
 *
 * 本 context 是 single source of truth：
 *   - localStorage `LS_KEY_TRIP_PREF` 持久化（既有 key，繼承既有資料）
 *   - 進入 `/trip/:tripId` 自動 setActiveTrip(tripId) (TripPage useEffect)
 *   - 跨 tab 同步（window 'storage' event）
 *   - /map / /chat / /explore 預設 active trip 對應內容
 *
 * Migration：既有 GlobalMapPage / ChatPage / TripPage 各自 lsGet/lsSet
 * `LS_KEY_TRIP_PREF` 散用，這個 context 統一。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LS_KEY_TRIP_PREF, LS_PREFIX, lsGet, lsRemove, lsSet } from '../lib/localStorage';

interface ActiveTripContextValue {
  /** 目前 active trip id (null = 沒選 trip) */
  activeTripId: string | null;
  /** 設定 active trip — null 等於清除 */
  setActiveTrip: (tripId: string | null) => void;
}

const ActiveTripContext = createContext<ActiveTripContextValue | null>(null);

export interface ActiveTripProviderProps {
  children: ReactNode;
}

export function ActiveTripProvider({ children }: ActiveTripProviderProps) {
  const [activeTripId, setActiveTripIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return lsGet<string>(LS_KEY_TRIP_PREF);
  });

  const setActiveTrip = useCallback((tripId: string | null) => {
    setActiveTripIdState(tripId);
    if (tripId == null) {
      lsRemove(LS_KEY_TRIP_PREF);
    } else {
      lsSet(LS_KEY_TRIP_PREF, tripId);
    }
  }, []);

  // 跨 tab sync — 另一 tab 改 trip-pref 同步本 tab state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const lsKey = `${LS_PREFIX}${LS_KEY_TRIP_PREF}`;
    function onStorage(e: StorageEvent) {
      if (e.key !== lsKey) return;
      if (e.newValue == null) {
        setActiveTripIdState(null);
        return;
      }
      // re-parse via lsGet 以套 expiry 邏輯
      setActiveTripIdState(lsGet<string>(LS_KEY_TRIP_PREF));
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<ActiveTripContextValue>(
    () => ({ activeTripId, setActiveTrip }),
    [activeTripId, setActiveTrip],
  );

  return <ActiveTripContext.Provider value={value}>{children}</ActiveTripContext.Provider>;
}

/**
 * useActiveTrip — 讀 + 寫目前 active trip id。
 *
 * 規則：
 *   - 進入 `/trip/:tripId` → 自動 setActiveTrip(tripId) (TripPage 已 wired)
 *   - /chat / /map / /explore mount 時讀 activeTripId 預設
 *   - 從 trip card click 進入時也算 set（TripsListPage / TripPickerSheet）
 */
export function useActiveTrip(): ActiveTripContextValue {
  const ctx = useContext(ActiveTripContext);
  if (ctx == null) {
    // SSR / 未包 provider 時 fallback：直接讀 localStorage（非 reactive，唯讀）
    if (typeof window === 'undefined') {
      return { activeTripId: null, setActiveTrip: () => {} };
    }
    return {
      activeTripId: lsGet<string>(LS_KEY_TRIP_PREF),
      setActiveTrip: (id) => {
        if (id == null) lsRemove(LS_KEY_TRIP_PREF);
        else lsSet(LS_KEY_TRIP_PREF, id);
      },
    };
  }
  return ctx;
}
