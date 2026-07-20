/**
 * 找出元素真正的捲動祖先。
 *
 * AppShell 用 `.app-shell-main { overflow-y: auto }` 當捲動容器，且
 * `.app-shell { height: 100dvh }` 保證 **document 永不捲動**。所以任何綁
 * `window` / `document.scrollY` 的捲動邏輯在本專案都是死碼 —— 而且不會有測試
 * 抓到，它只是「永遠不觸發」，看起來像設計。
 *
 * TitleBar 的宿主不只一種：多數頁面是 `.app-shell-main`，但 TripsListPage /
 * ExplorePage / PoiFavoritesPage / NewTripPage / CollabPage / 三個 settings 頁
 * 都有自己的 `height:100% + overflow-y:auto` shell，所以不能寫死容器。
 *
 * ⚠ 這支只找**祖先**。若真正的 scroller 是兄弟節點（ChatPage 的 `.tp-chat-body`
 * 是 flex 子元素，TitleBar 是它兄弟），這裡會往上找到永不溢出的 `.app-shell-main`
 * 而回傳一個 scrollTop 恆 0 的容器 —— 那種頁面要用 TitleBar 的 `alwaysSolid` opt-out。
 *
 * 與 `TripPage` 內的同名 helper 的差別：這支是**結構性**的 —— 只看 computed
 * overflow，不看當下的 `scrollHeight > clientHeight`。因為 chrome 在資料載入前
 * 就要決定綁誰，此時容器往往還沒有可捲內容；用高度判斷會 fallback 到 window
 * 而永久綁錯。
 */
export function findScrollAncestor(el: HTMLElement): HTMLElement | Window {
  let parent: HTMLElement | null = el.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === 'auto' || overflowY === 'scroll') return parent;
    parent = parent.parentElement;
  }
  return window;
}

/** 取得捲動容器目前的捲動位移（統一 element / window 兩種來源）。 */
export function scrollTopOf(target: HTMLElement | Window): number {
  return target === window
    ? (window.scrollY ?? 0)
    : (target as HTMLElement).scrollTop;
}
