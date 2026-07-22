/**
 * TripPageHost — owner 2026-07-21 回報 #2「開關第三欄面板會刷新第二欄」的
 * root-cause 修復。
 *
 * Root cause：`/trips?selected=X`（TripsListPage embedded 詳情，2-pane）與
 * `/trip/:tripId/{edit|add-stop|...}`（TripStackLayout 中欄，3-pane）是兩個
 * 完全獨立的頂層 Route element，過去各自 inline render 自己的 <TripPage>。
 * 路由在這兩者之間切換時，React 必然 unmount 一份、mount 另一份 —— TripPage
 * 內部沒有跨 mount 的 cache（無 react-query/SWR），重新 mount = 重新打 API，
 * 使用者看到中欄短暫 loading（owner 講的「刷新」）。
 *
 * 修法：整個 app 只 render 一份 <TripPage>，掛在這裡（main.tsx 裡包住
 * <Routes>，不是 <Routes> 的子路由）—— 不管 `/trips` 或 `/trip/:tripId/*`
 * 怎麼切換，這個 host 本身從不 unmount，<TripPage> 也就不會被路由切換牽連著
 * unmount。用 resolveDesktopMiddleColumnTripId 從目前 location 算出「桌機中欄
 * 現在該顯示哪個 tripId」，只有 tripId 本身改變（使用者切去另一個行程）時才
 * 透過 `key={tripId}` 讓它重新 mount（這才是真的該重新抓資料的情況）。
 *
 * <TripPage> 渲染結果透過 React Portal 掛進當下 host（TripsListPage 桌機分支 /
 * TripStackLayout 中欄）留的 placeholder <div>。
 *
 * ⚠️ portal target 取得方式（push-based ref callback，非 pull-based 查詢）：
 * 第一版讓 TripPage 自己 `document.getElementById(id)` + `useEffect` 依
 * `location.pathname` 重查 —— playwright e2e 實測（非只憑推論）抓到 race：
 * TripPage 的 effect 觸發時，新 host 的 placeholder 有時還沒 mount（兩者是各自
 * 獨立的 subtree，沒有 render 順序保證），`getElementById` 撲空後就不會再重試，
 * 中欄永遠空白。改用 TripMainPortalContext：host 的 placeholder
 * `<div ref={(el) => setPortalNode(el)}>` 一 mount，React 在同一個 commit 內
 * 同步呼叫這個 callback —— 不需要猜「另一邊是不是已經好了」。
 *
 * 手機不受影響：手機沒有「中欄」概念，各頁走整頁 drill-down、各自 inline
 * render 自己的 <TripPage>（不消費這個 host，也不透過 TripPageHandleContext）。
 * resolveDesktopMiddleColumnTripId 只在 isDesktop 時呼叫，手機下 tripId 恆為
 * null，這裡完全不 render 任何東西。
 */
import { Suspense, useMemo, useRef, useState, type ForwardRefExoticComponent, type ReactNode, type RefAttributes } from 'react';
import { useLocation } from 'react-router-dom';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { TripPageHandleContext } from '../../contexts/TripPageHandleContext';
import { TripMainPortalContext } from '../../contexts/TripMainPortalContext';
import { resolveDesktopMiddleColumnTripId } from '../../lib/tripStackRoutes';
import { lazyWithRetry } from '../../lib/lazyWithRetry';
import type { TripPageHandle, TripPageProps } from '../../pages/TripPage';

// Lazy-load TripPage's heavy module graph (DndContext, drag-drop, print/export
// libs …) — TripPageHost itself is always mounted (wraps <Routes> in main.tsx),
// so a static import here would pull that whole graph into the main entry
// chunk on every page load (chat/map/favorites/…), even when no trip is being
// viewed. Matching the existing lazy-route convention keeps the dynamic
// import() from firing until `tripId` actually resolves truthy below.
//
// lazyWithRetry's generic signature (`ComponentType<P>`) doesn't preserve the
// forwardRef `ref` typing that TripPage's real (eager) consumers rely on —
// React.lazy's own type only models plain function/class components. Cast
// back to the actual forwardRef shape so `ref={tripPageRef}` below still
// typechecks against TripPageHandle instead of a bogus Component instance.
const TripPage = lazyWithRetry<TripPageProps>(() => import('../../pages/TripPage')) as unknown as
  ForwardRefExoticComponent<TripPageProps & RefAttributes<TripPageHandle>>;

export interface TripPageHostProps {
  children: ReactNode;
}

export default function TripPageHost({ children }: TripPageHostProps) {
  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const tripPageRef = useRef<TripPageHandle>(null);
  const [portalNode, setPortalNode] = useState<Element | null>(null);
  // setPortalNode（useState setter）本身在 re-render 之間已保證 identity 穩定，
  // 這裡用 useMemo 讓整個 context value object 也穩定 —— 否則每次 TripPageHost
  // re-render（例如每次路由變化）都會產生新 object，讓消費這個 context 的 host
  // （TripsListPage/TripStackLayout）跟著不必要 re-render。
  const portalContextValue = useMemo(() => ({ setPortalNode }), [setPortalNode]);
  const tripId = isDesktop
    ? resolveDesktopMiddleColumnTripId(location.pathname, location.search)
    : null;

  return (
    <TripMainPortalContext.Provider value={portalContextValue}>
      <TripPageHandleContext.Provider value={tripPageRef}>
        {children}
        {tripId && (
          <Suspense fallback={null}>
            <TripPage
              key={tripId}
              ref={tripPageRef}
              tripId={tripId}
              noShell
              usePortalMain
              portalNode={portalNode}
            />
          </Suspense>
        )}
      </TripPageHandleContext.Provider>
    </TripMainPortalContext.Provider>
  );
}
