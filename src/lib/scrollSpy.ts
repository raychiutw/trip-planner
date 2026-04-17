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
