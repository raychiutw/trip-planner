/**
 * TripMainPortalContext — owner 2026-07-21 回報 #2「開關第三欄面板會刷新第二欄」修復。
 *
 * 修法沿革（第一版 v.s. 這版）：第一版讓 TripPage 自己用
 * `document.getElementById(portalTargetId)` + `useEffect(..., [portalTargetId,
 * location.pathname])` 去「找」目前的 portal placeholder —— 這是 pull-based
 * polling，實測（playwright e2e，非只憑推論）發現真實瀏覽器下有 race：
 * TripPage 的 effect 觸發時，新 host（TripsListPage / TripStackLayout）的
 * placeholder <div> 有時還沒完成 mount（兩者是各自獨立的 lazy chunk / 獨立
 * subtree，沒有 render 順序保證），`getElementById` 撲空後就再也不會重試，
 * 導致內容永遠沒被 portal 進去（中欄整個空白，比「刷新」更嚴重）。
 *
 * 改用 push-based 的 callback ref：host 的 placeholder <div ref={setPortalNode}>
 * 一 mount，React 在同一個 commit 內就同步呼叫這個 ref callback —— 不需要猜
 * 「另一邊是不是已經好了」，命中率 100%。unmount 時 React 也會同步呼叫
 * ref callback 帶 null，讓 TripPageHost 知道「目前沒有 host 在顯示」。
 */
import { createContext, useContext } from 'react';

export interface TripMainPortalContextValue {
  /** Host 的 placeholder <div> mount/unmount 時呼叫（React ref callback 語意）。 */
  setPortalNode: (node: Element | null) => void;
}

const NOOP: TripMainPortalContextValue = { setPortalNode: () => {} };

export const TripMainPortalContext = createContext<TripMainPortalContextValue>(NOOP);

export function useTripMainPortal(): TripMainPortalContextValue {
  return useContext(TripMainPortalContext);
}
