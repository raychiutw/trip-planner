/**
 * MapDayTab — Map page day-tab primitive (also used by TripPage DayNav).
 *
 * 單行「DAY N」膠囊 — 去日期副標（當日日期靠中欄 day-header 顯示）。
 * active = 實心 accent-fill 膠囊，比照 root tab（`.tp-global-bottom-nav-btn.is-active`）
 *   —— owner 2026-07-24「Day tab 比照 root tab」，overturns 2026-07-17「淡 tonal pill」sign-off。
 * Idle: 透明底 + dayColor eyebrow（地圖 per-day polyline 對應）/ muted（行程單色）
 * Active: 實心 accent-fill 底 + accent-foreground eyebrow（per-day 色只留 idle，避免淺色天白字對比不足）
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
  // #1140 item 3（owner 2026-07-24「Day tab 比照 root tab」，overturns 2026-07-17 淡 tonal
  // sign-off）：active 改實心 accent-fill 膠囊（比照 root tab，CSS 給 accent-foreground 前景），
  // 不再用 per-day --day-color tint。per-day polyline 對應改只由 **idle** eyebrow 顏色承載 ——
  // active 時 eyebrow 用 accent-foreground（實心底上可讀），故 inline day-color 只在非 active 時套。
  const safeDayColor = safeColor(dayColor);
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-current={isActive ? 'true' : undefined}
      className={`tp-map-day-tab${isActive ? ' is-active' : ''}`}
      onClick={onClick}
      data-testid={testId}
    >
      <span
        className="tp-map-day-tab-eyebrow"
        style={!isActive && safeDayColor ? { color: safeDayColor } : undefined}
      >
        {dayLabel}
      </span>
    </button>
  );
}
