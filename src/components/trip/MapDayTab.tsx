/**
 * MapDayTab — Map page bottom underline tab primitive (also used by TripPage DayNav).
 *
 * Idle: 透明底 + dayColor eyebrow + muted text + transparent border-bottom
 * Active: accent text + accent border-bottom 2px + 保留 dayColor eyebrow
 *
 * 視覺對應：docs/design-sessions/terracotta-preview-v2.html Section 20 day tabs
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
  /** 上排 eyebrow 文字（"DAY 01" / "總覽"） */
  dayLabel: string;
  /** 下排 date 文字（"7/29" / "7天"），可選 */
  dateLabel?: string;
  /** dayColor 套 eyebrow inline style；overview tab 留空 */
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

export default function MapDayTab({ dayLabel, dateLabel, dayColor, isActive, onClick, ariaLabel, testId }: MapDayTabProps) {
  // Active state border-bottom 用 per-day color (mockup S20 underline 用 day color
  // 強化 day↔map polyline 視覺對應)。CSS rule 讀 --day-color (有設值才覆蓋)。
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
      {dateLabel && <span className="tp-map-day-tab-date">{dateLabel}</span>}
    </button>
  );
}
