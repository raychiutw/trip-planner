/**
 * MapDayTab — Map page day-tab primitive (also used by TripPage DayNav).
 *
 * 單行「DAY N」膠囊 — owner 2026-07-17 sign-off：去日期副標（當日日期靠中欄
 * day-header 顯示），active = 淡 tonal pill（非實心 accent thumb）。
 * Idle: 透明底 + dayColor eyebrow（地圖 per-day）/ muted（行程單色）
 * Active: 淡 tonal pill 底 + full-opacity eyebrow
 * 視覺對應：docs/design-sessions/2026-07-17-v3-day-map-glass-capsule.html
 *
 * a11y：用 plain `<button>` 不掛 role=tab — 上層 wrapper (DayNav / MapPage)
 * 用 `<nav>` 包，符合 scroll-to-anchor pattern（panels 一直可見），不適用
 * tablist 「panels 互斥顯示」 語意。`aria-current="true"` 表示目前 active。
 */

/** Restrictive color regex — 只接受 hex (#fff #ffffff) 或 rgb()/hsl()。
 * 防 dayColor 來自不可信來源時 (未來如果接 user-defined custom colors)
 * 變 CSS injection 入口 (e.g. `red; background: url(evil)`)。 */
const SAFE_COLOR_RE = /^(?:#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$/;
function safeColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return SAFE_COLOR_RE.test(value.trim()) ? value : undefined;
}

export interface MapDayTabProps {
  /** 膠囊文字（"DAY 1" / "總覽"） */
  dayLabel: string;
  /** dayColor 套 eyebrow inline style + active pill tint；overview / 行程頁留空 */
  dayColor?: string;
  /** 是否為 selected tab */
  isActive: boolean;
  /** 點擊 callback */
  onClick: () => void;
  /** Optional aria-label override（trip detail 帶日期 + day.label 的完整描述） */
  ariaLabel?: string;
  /** Optional data-testid for test selectors */
  testId?: string;
}

export default function MapDayTab({ dayLabel, dayColor, isActive, onClick, ariaLabel, testId }: MapDayTabProps) {
  // Active pill 用 per-day color tint（地圖 polyline 對應）；有設值才覆蓋 default
  // accent。CSS rule 讀 --day-color (有設值才覆蓋)。
  const safeDayColor = safeColor(dayColor);
  const style = isActive && safeDayColor
    ? ({ '--day-color': safeDayColor } as React.CSSProperties)
    : undefined;
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-current={isActive ? 'true' : undefined}
      className={`tp-map-day-tab${isActive ? ' is-active' : ''}`}
      onClick={onClick}
      style={style}
      data-testid={testId}
    >
      <span
        className="tp-map-day-tab-eyebrow"
        style={safeDayColor ? { color: safeDayColor } : undefined}
      >
        {dayLabel}
      </span>
    </button>
  );
}
