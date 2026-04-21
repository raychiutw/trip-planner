/**
 * dayPalette — 10-colour per-day route palette (Q-B=C decision: Tailwind -500).
 *
 * Used exclusively for map polyline strokeColor.
 * Does NOT apply to UI chrome — see DESIGN.md DV exception rules.
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
