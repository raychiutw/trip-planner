/**
 * TripPageHandleContext — owner 2026-07-21 回報 #2 修復用。
 *
 * TripPageHost.tsx 是桌機唯一實際 render <TripPage> 的地方（見該檔），它自己持有
 * 那份 TripPageHandle ref。TripsListPage（desktop embedded 詳情）與 TripStackLayout
 * （中欄）不再各自 render <TripPage>，改只留 portal placeholder；但兩處的
 * TripActionsMenu 仍需要一份 ref 呼叫「列印 / 下載」（見 TripActionsMenu 的
 * tripPageRef prop）。這個 context 讓它們拿到 TripPageHost 持有的那一份 ref，
 * 而不是各自建立、永遠不會被實際 <TripPage> attach 到的 dead ref。
 *
 * 手機不受影響 —— 手機各頁走整頁 drill-down，各自 inline render 自己的
 * <TripPage ref={localRef}>，不消費這個 context（沒有 Provider 也安全：
 * default value 是一個 no-op 的 { current: null }）。
 */
import { createContext, useContext, type RefObject } from 'react';
import type { TripPageHandle } from '../pages/TripPage';

const NOOP_REF: RefObject<TripPageHandle | null> = { current: null };

export const TripPageHandleContext = createContext<RefObject<TripPageHandle | null>>(NOOP_REF);

export function useTripPageHandle(): RefObject<TripPageHandle | null> {
  return useContext(TripPageHandleContext);
}
