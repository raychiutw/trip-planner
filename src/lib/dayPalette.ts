/**
 * dayPalette — 10-colour per-day route palette (Q-B=C decision: Tailwind -500).
 *
 * 用途（權威是 `DESIGN.md`「Day palette exception」）：**地圖 polyline** 與
 * **Map page 底部 entry card 的 num 圓框／day eyebrow**。Day 指示 tab（day strip /
 * MapDayTab）**不套** dayColor，嚴守柔褐 accent 統一色系（owner 2026-07-24）。
 *
 * ⚠ 本檔原註解寫「Used exclusively for map polyline strokeColor. Does NOT apply to
 *   UI chrome」—— 那與 `DESIGN.md` 矛盾（後者明文授權 entry card 用），已於 #1168 更正。
 *
 * **當文字色一律走 `dayTextColor()`，不要用 `dayColor()`。** 這組 -500 是給填色／描邊的
 * 飽和色，當淺底上的文字 10 色全部不達 WCAG AA（1.92–4.11:1）。見下方說明。
 */

export const DAY_PALETTE = [
  '#0EA5E9', // sky-500    day 1
  '#14B8A6', // teal-500   day 2
  '#F59E0B', // amber-500  day 3
  '#F43F5E', // rose-500   day 4
  '#8B5CF6', // violet-500 day 5
  '#84CC16', // lime-500   day 6
  '#F97316', // orange-500 day 7
  '#06B6D4', // cyan-500   day 8
  '#D946EF', // fuchsia-500 day 9
  '#10B981', // emerald-500 day 10
] as const;

/**
 * 取第 N 天（1-indexed）的路線色。
 * 超過 10 天輪回到 day 1（modulo loop）。
 * 無效輸入（dayNum < 1、NaN、Infinity）回傳 DAY_PALETTE[0]。
 */
export function dayColor(dayNum: number): string {
  if (!Number.isFinite(dayNum) || dayNum < 1) return DAY_PALETTE[0]!;
  return DAY_PALETTE[(dayNum - 1) % DAY_PALETTE.length]!;
}

/**
 * 取第 N 天的**文字用**色（#1168）。輪替與 fallback 規則與 `dayColor` 完全一致。
 *
 * 回傳的是 CSS 變數引用（`var(--day-text-N)`）而**不是 hex** —— 這是刻意的：
 * `--day-text-*` 在 `css/tokens.css` 的淺色／深色兩套各有一組值（淺底要更深、深底要更淺），
 * 交給 CSS 按當前主題解析，元件不必知道主題是什麼。回傳 hex 就會鎖死其中一套。
 * 先例：`MapPage` 早就在把 `'var(--color-muted)'` 當這個 prop 的 fallback 傳進 MapEntryCard。
 *
 * 為什麼需要它：`DAY_PALETTE` 是 Tailwind -500，當淺底上的文字 10 色**全部**不達 AA
 * （實測疊 `--color-background`：lime 1.92 ／ amber 2.08 ／ … ／ violet 4.11，門檻 4.5）。
 * 關係同 `--color-accent-text` 之於 `--color-accent`。實際色值與各底色的對比數字寫在
 * `tokens.css` 的 `--day-text-*` 區塊。
 */
export function dayTextColor(dayNum: number): string {
  const idx = !Number.isFinite(dayNum) || dayNum < 1 ? 0 : (dayNum - 1) % DAY_PALETTE.length;
  return `var(--day-text-${idx + 1})`;
}

/**
 * F008: color-blind aid — 回傳 polyline 完整樣式。
 * 奇數天：solid（dashArray: undefined）
 * 偶數天：dashed（dashArray: '6,4'）
 * 確保色盲使用者可透過線型區分不同天的路線。
 */
export interface PolylineStyle {
  color: string;
  weight: number;
  dashArray: string | undefined;
}

export function dayPolylineStyle(dayNum: number): PolylineStyle {
  const color = dayColor(dayNum);
  const isEven = Number.isFinite(dayNum) && dayNum >= 1 && dayNum % 2 === 0;
  return {
    color,
    weight: 3,
    dashArray: isEven ? '6,4' : undefined,
  };
}
