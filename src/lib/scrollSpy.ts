/**
 * 計算捲動時的 active day index。
 *
 * 規則：回傳最後一個 `top` 已進入「可視區上 1/3」的 header index（0-based），
 * 沒有任何 header 進入時回 -1。`null` top 代表 DOM 尚未渲染，會被跳過。
 *
 * 假設 `headerTops` 依 DOM 順序排列（top 單調遞增）。一旦遇到 `top > threshold`
 * 就 early break；這是 scroll hot path，減少 getBoundingClientRect 呼叫。
 *
 * @param headerTops 各 day header 的 viewport-relative top（可為 null）
 * @param navH sticky nav 的有效高度（offsetHeight + CSS top）
 * @param viewportH 可視區總高（通常為 window.innerHeight）
 */
export function computeActiveDayIndex(
  headerTops: ReadonlyArray<number | null>,
  navH: number,
  viewportH: number,
): number {
  const threshold = navH + (viewportH - navH) / 3;
  let current = -1;
  for (let i = 0; i < headerTops.length; i++) {
    const top = headerTops[i];
    if (top == null) continue;
    if (top > threshold) break;
    current = i;
  }
  return current;
}

/**
 * 回傳 scroll-spy 用的穩定可視區高度。
 *
 * mobile Chrome / Safari 捲動時 URL bar 會收縮，`window.innerHeight` 可能從 ~600
 * 跳到 ~660。`document.documentElement.clientHeight` 是 layout viewport，在
 * 現代瀏覽器更穩定。兩者都取用並以 clientHeight 優先，退而求其次 innerHeight。
 */
export function getStableViewportH(): number {
  const clientH = document.documentElement.clientHeight;
  return clientH > 0 ? clientH : window.innerHeight;
}

/**
 * 計算行程載入後應使用的初始 URL hash。
 *
 * 優先序：現有合法 hash → 今日在行程中 → 第一天 fallback。
 * 若 dayNums 為空（尚未載入）回傳 null，呼叫端應略過 push。
 *
 * 解決：單天行程頁面短於 viewport 時，onScroll 從不觸發，hash 永遠不更新。
 *
 * @param dayNums 行程的 day_num 陣列（已排序）
 * @param currentHash `window.location.hash`
 * @param localToday 今日日期字串 `YYYY-MM-DD` 或 null
 * @param autoScrollDates 行程各天的日期字串陣列（index 對應 dayNums）
 */
export function computeInitialHash(
  dayNums: ReadonlyArray<number>,
  currentHash: string,
  localToday: string | null,
  autoScrollDates: ReadonlyArray<string>,
): string | null {
  if (dayNums.length === 0) return null;

  const match = currentHash.match(/^#day(\d+)$/);
  if (match) {
    const hashDay = parseInt(match[1] ?? '0', 10);
    if (dayNums.includes(hashDay)) return null;
  }

  if (localToday) {
    const idx = autoScrollDates.indexOf(localToday);
    const todayDayNum = idx >= 0 ? dayNums[idx] : undefined;
    if (todayDayNum !== undefined) return `#day${todayDayNum}`;
  }

  return `#day${dayNums[0]}`;
}
