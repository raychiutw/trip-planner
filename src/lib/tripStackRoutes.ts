/**
 * tripStackRoutes — owner 2026-07-21 回報 #2「開關第三欄面板會刷新第二欄」的
 * root-cause 修復用：判斷「桌機中欄現在該顯示哪個 tripId」的純函式。
 *
 * Context：`/trips?selected=X`（TripsListPage embedded 詳情，2-pane）與
 * `/trip/:tripId/{edit|add-stop|...}`（TripStackLayout 中欄，3-pane）過去是
 * 兩個完全獨立的頂層 Route element，各自 inline render 一份 <TripPage>。
 * 路由切換時 React 必然 unmount 一份、mount 另一份 → TripPage 內部 useTrip
 * 重新打 API，中欄可見的 loading 閃爍（owner 講的「刷新」）。
 *
 * 修法（見 TripPageHost.tsx）：整個 app 只 render 一份 <TripPage>，掛在
 * <Routes> 之上、不受路由切換影響，用這支函式從目前 location 算出「該顯示
 * 哪個 tripId」，並把渲染結果 portal 進當下 host 留的 placeholder div。
 *
 * 這支函式必須跟 src/entries/main.tsx 的 route 表同步 —— 見
 * tests/unit/trip-stack-routes.test.ts 對 main.tsx 原始碼做 cross-check，
 * 避免之後加/刪操作路由時，這裡的清單悄悄跟 route 表脫鉤。
 */

/**
 * TripStackLayout 底下「操作面板」的 9 條相對路徑（相對於 /trip/:tripId/）。
 * 對應 src/entries/main.tsx 的 `<Route element={<TripStackLayout />}>` 區塊。
 */
export const TRIP_STACK_OPERATION_PATTERNS: readonly RegExp[] = [
  /^edit$/,
  /^add-stop$/,
  /^add-entry$/,
  /^collab$/,
  /^health$/,
  /^notes$/,
  /^stop\/[^/]+\/copy$/,
  /^stop\/[^/]+\/move$/,
  /^stop\/[^/]+\/change-poi$/,
  /^stop\/[^/]+\/edit$/,
] as const;

/** 桌機中欄的 <TripPage> 共用 portal target id（TripsListPage 與 TripStackLayout 共用）。 */
export const TRIP_MAIN_PORTAL_ID = 'trip-main-portal';

/**
 * 算出「桌機中欄現在該顯示哪個 tripId」，null = 不該顯示（非 trip 相關頁、
 * 或該頁面本身就是獨立整頁如 /trip/:id/map、/trip/:id/print，不經過中欄）。
 *
 * 只在桌機呼叫 —— 手機沒有「中欄」概念（各頁整頁 drill-down），呼叫端自行
 * 以 isDesktop 為 gate（見 TripPageHost.tsx），這支函式本身不管 viewport。
 */
export function resolveDesktopMiddleColumnTripId(pathname: string, search: string): string | null {
  if (pathname === '/trips') {
    return new URLSearchParams(search).get('selected');
  }
  const match = pathname.match(/^\/trip\/([^/]+)\/(.+)$/);
  if (!match) return null;
  const tripId = match[1];
  const rest = match[2];
  if (!tripId || !rest) return null;
  const isOperationRoute = TRIP_STACK_OPERATION_PATTERNS.some((re) => re.test(rest));
  return isOperationRoute ? tripId : null;
}
