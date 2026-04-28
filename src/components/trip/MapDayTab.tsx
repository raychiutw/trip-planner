/**
 * MapDayTab — Map page bottom underline tab primitive.
 *
 * Idle: 透明底 + dayColor eyebrow + muted text + transparent border-bottom
 * Active: accent text + accent border-bottom 2px + 保留 dayColor eyebrow
 *
 * 視覺對應：docs/design-sessions/terracotta-preview-v2.html Section 20 day tabs
 * Spec: openspec/changes/terracotta-pages-refactor/specs/terracotta-page-layout/spec.md
 */

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
}

export default function MapDayTab({ dayLabel, dateLabel, dayColor, isActive, onClick }: MapDayTabProps) {
  // Section 4.10 (terracotta-mockup-parity-v2)：active state border-bottom 用
  // per-day color 取代固定 accent，呼應 mockup section 20 underline 用 day color
  // 強化 day↔map polyline 視覺對應。CSS rule 讀 --day-color (有設值才覆蓋)。
  const style = isActive && dayColor
    ? ({ '--day-color': dayColor } as React.CSSProperties)
    : undefined;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={`tp-map-day-tab${isActive ? ' is-active' : ''}`}
      onClick={onClick}
      style={style}
    >
      <span
        className="tp-map-day-tab-eyebrow"
        style={dayColor ? { color: dayColor } : undefined}
      >
        {dayLabel}
      </span>
      {dateLabel && <span className="tp-map-day-tab-date">{dateLabel}</span>}
    </button>
  );
}
