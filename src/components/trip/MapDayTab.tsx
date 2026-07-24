/**
 * MapDayTab — Map page day-tab primitive (also used by TripPage DayNav).
 *
 * 單行「DAY N」膠囊 — 去日期副標（當日日期靠中欄 day-header 顯示）。
 * active = 實心 accent-fill 膠囊，比照 root tab（`.tp-global-bottom-nav-btn.is-active`）
 *   —— owner 2026-07-24「Day tab 比照 root tab」，overturns 2026-07-17「淡 tonal pill」sign-off。
 * 色系統一（owner 2026-07-24「地圖模式 day tab 移除依日期不同顏色，回到統一色系」）：
 *   idle = muted、active = 實心 accent-fill + accent-foreground —— 地圖與行程明細一致，
 *   **不再依 dayColor 上色**。per-day 顏色只留在地圖 polyline / entry card（見 DESIGN.md Day palette exception）。
 *
 * a11y：用 plain `<button>` 不掛 role=tab — 上層 wrapper (DayNav / MapPage)
 * 用 `<nav>` 包，符合 scroll-to-anchor pattern（panels 一直可見），不適用
 * tablist 「panels 互斥顯示」 語意。`aria-current="true"` 表示目前 active。
 */

export interface MapDayTabProps {
  /** 膠囊文字（"DAY 1" / "總覽"） */
  dayLabel: string;
  /** 是否為 selected tab */
  isActive: boolean;
  /** 點擊 callback */
  onClick: () => void;
  /** Optional aria-label override（trip detail 帶日期 + day.label 的完整描述） */
  ariaLabel?: string;
  /** Optional data-testid for test selectors */
  testId?: string;
}

export default function MapDayTab({ dayLabel, isActive, onClick, ariaLabel, testId }: MapDayTabProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-current={isActive ? 'true' : undefined}
      className={`tp-map-day-tab${isActive ? ' is-active' : ''}`}
      onClick={onClick}
      data-testid={testId}
    >
      <span className="tp-map-day-tab-eyebrow">{dayLabel}</span>
    </button>
  );
}
