/**
 * resolveTripId — 決定 TripPage 要渲染哪個 trip id。
 *
 * v2.43.x bugfix：原本 TripPage inline 解析在「明確導航目標不在 permission-filtered
 * `/api/trips`（該端點排除使用者自己的私人 clone，published=0）」時，會 silently
 * fallback 到第一個 published trip（defaultTrip）→ 使用者從列表點自己的私人 clone
 * （?selected=cln-…）卻看到「別的 trip 的行程」（TitleBar 用 selected 顯正確標題、
 * timeline 卻渲染 defaultTrip 的內容，標題與行程錯配）。QA 2026-06-02 prod 實測抓到。
 *
 * 規則：
 *  1. tripId 在 trips 清單裡 → 用該筆。
 *  2. tripId 是「明確導航目標」(URL param / prop ?selected= / 舊 ?trip=) 但不在清單
 *     → 仍信任它（真正存取權由 useTrip 的 fetch 驗證；403/404 會走 error state，
 *     而不是 silently 顯示另一個 trip）。
 *  3. 否則（非明確來源，如 localStorage pref，或無 tripId）→ fallback 第一個 published。
 *  4. 都沒有 → null（caller 顯示 unpublished / empty）。
 */
export interface ResolveTripCandidate {
  tripId: string;
  published?: number | null;
}

export function resolveTripId(
  tripId: string | null,
  isExplicit: boolean,
  trips: ResolveTripCandidate[],
): string | null {
  const match = tripId ? trips.find((t) => t.tripId === tripId) : null;
  if (match) return match.tripId;
  // 規則 2：明確導航目標不在 permission-filtered /api/trips（排除使用者自己的私人
  // clone）也信任它 — 存取權交給 useTrip 的實際 fetch 驗證，絕不 silently 換成別的 trip。
  if (isExplicit && tripId) return tripId;
  // 2026-07-21：candidates 改由 /api/my-trips 供應（純看 trip_permissions），
  // 每一筆都是使用者有權限的行程 —— published 與可否存取無關，直接取第一筆。
  // 舊版是 `find(t => t.published === 1)`，既有行程全部改為不公開後回 undefined，
  // 連 fallback 都沒有，畫面停在 unpublished 錯誤態。
  const defaultTrip = trips[0];
  return defaultTrip ? defaultTrip.tripId : null;
}
