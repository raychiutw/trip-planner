/**
 * TravelPill — Section 4.6 (terracotta-ui-parity-polish) + v2.24.0 tap-switch.
 *
 * 顯示兩 entry 之間的移動方式 + 時間 + 描述。對應 mockup section 13。
 * Layout: 圓形 icon (依 type) · N min · 描述 (optional)
 *
 * Travel data 來自 entry.travel = { type, desc, min }，semantic 上是「從上一個
 * entry 到本 entry」的 leg。所以本 component 渲染在 RailRow N 與 N+1 中間，
 * 但取的是 entry N+1 的 travel data。
 *
 * v2.24.0 tap-switch（Phase γ.0）：當 caller 提供 `segment + tripId` props 時，
 * pill 變 button、tap 開 TravelPillDialog 切換 mode（driving/walking/transit）。
 * 後者透過 PATCH /api/trips/:id/segments/:sid 寫入。
 *
 * v2.30.0：mode_source DROPPED — 不再有「上鎖」概念。
 *   - 切 transit → 用 user 手填 min（source='manual'）
 *   - 切回 driving / walking → backend 一律打 Google Routes 重算
 *
 * Backwards compat：未提供 segment props → 沿用 v2.23 唯讀渲染。
 */
import { useState } from 'react';
import Icon from '../shared/Icon';
import TravelPillDialog, { type TravelMode } from './TravelPillDialog';
import { TRAVEL_MODE_LABEL } from '../../lib/travelMode';

const SCOPED_STYLES = `
.tp-travel-pill-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  /* v2.30.12: time col 移除後 dot 中心 110→56px desktop / mobile 媒體查詢 → 44px */
  margin: 6px 0 6px 56px;
  flex-wrap: wrap;
}
.tp-travel-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 5px 14px;
  border-radius: var(--radius-full);
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
  width: fit-content;
  font-variant-numeric: tabular-nums;
}
.tp-travel-pill.is-interactive {
  cursor: pointer;
  border: 0; /* 沿用 secondary 底色，hover 用 background 區分 */
  font: inherit; font-size: var(--font-size-footnote);
  transition: background 120ms;
}
.tp-travel-pill.is-interactive:hover { background: var(--color-hover); }
.tp-travel-pill.is-interactive:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.tp-travel-pill-icon {
  /* 三色：交通資訊用第二色 sage 綠（v2.51 三色系統試點）*/
  color: var(--color-accent-2);
  display: inline-flex; align-items: center;
  flex-shrink: 0;
}
.tp-travel-pill-icon .svg-icon { width: 14px; height: 14px; }
.tp-travel-pill-meta {
  display: inline-flex; align-items: baseline; gap: 6px;
  white-space: nowrap;
}
.tp-travel-pill-min { font-weight: 700; color: var(--color-foreground); }
.tp-travel-pill-sep { color: var(--color-muted); opacity: 0.5; }
.tp-travel-pill-desc {
  color: var(--color-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 240px;
}
.tp-travel-pill-affordance {
  color: var(--color-muted); opacity: 0.6;
  font-size: var(--font-size-eyebrow); line-height: 1;
  margin-left: 2px;
}
/* Stale-travel ⚠ indicator + recompute button — sibling of pill (not nested, avoid button-in-button) */
.tp-travel-pill-stale {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-priority-high-bg);
  color: var(--color-priority-high-dot);
  font-size: var(--font-size-caption);
  font-weight: 600;
}
.tp-travel-pill-recompute {
  appearance: none; background: none; border: 0; padding: 2px 6px;
  margin-left: 2px;
  color: var(--color-priority-high-dot);
  font: inherit; font-size: var(--font-size-caption);
  font-weight: 700;
  cursor: pointer;
  border-radius: var(--radius-full);
  text-decoration: underline;
  min-height: var(--spacing-tap-min);
  display: inline-flex; align-items: center;
}
.tp-travel-pill-recompute:hover { background: var(--color-priority-high-bg); filter: brightness(0.95); }
.tp-travel-pill-recompute:focus-visible { outline: 2px solid var(--color-priority-high-dot); outline-offset: 2px; }
@media (max-width: 760px) {
  /* v2.30.12: mobile dot 中心 56→44px (page padding 16 + grip 20 + gap 8 + dot/2 12 — 對齊 .tp-rail-detail mobile margin-left). */
  .tp-travel-pill-wrap { margin: 6px 0 6px 44px; }
  .tp-travel-pill {
    padding: 4px 12px;
    gap: 8px;
    font-size: var(--font-size-caption);
  }
  .tp-travel-pill-desc { max-width: 150px; }
}
`;

const TYPE_ICON_MAP: Record<string, string> = {
  car: 'car',
  drive: 'car',
  driving: 'car',
  walk: 'walking',
  walking: 'walking',
  train: 'train',
  metro: 'train',
  subway: 'train',
  bus: 'bus',
  transit: 'bus',
  ferry: 'plane',
  flight: 'plane',
  plane: 'plane',
};

// v2.31.64 a11y zh-TW：aria-label 給 screen reader 念中文，不要 raw enum
// v2.33.28: 3 個 canonical (driving/walking/transit) 從 lib/travelMode 引入，避免本地重複定義；
// 額外 alias (car/drive/walk/train/bus/...) 是 backend raw entry.travel.type 的 legacy 值。
const MODE_LABEL: Record<string, string> = {
  ...TRAVEL_MODE_LABEL,
  car: '開車', drive: '開車',
  walk: '步行',
  train: '火車', metro: '捷運', subway: '捷運',
  bus: '公車',
  ferry: '渡輪',
  flight: '飛機', plane: '飛機',
};

export interface TravelPillSegment {
  id: number;
  mode: TravelMode;
  /** segment.min（driving/walking 是 Google Routes 算的；transit 是 user 手填值）*/
  min: number | null;
  /** segment.distance_m（Google Routes 回傳；transit 因不打 API 為 null）*/
  distanceM: number | null;
  /**
   * v2.29.1 stale 偵測：null = 還沒被 Google Routes 算過（master swap 後 backend
   * 會 `UPDATE trip_segments SET computed_at = NULL`，等用戶觸發 recompute）。
   * 數字 = 算過的 epoch ms。
   */
  computedAt: number | null;
}

export interface TravelPillProps {
  /** v2.23 legacy fields — 從 trip_entries.travel_* dual-write 來 */
  type?: string | null;
  desc?: string | null;
  min?: number | null;
  distanceM?: number | null;
  /**
   * v2.24.0：當提供 segment + tripId 時，pill 變 interactive button，tap 開
   * TravelPillDialog 切換 mode。Phase γ.0 預設 undefined（TimelineRail 接線
   * 在 γ.1 PR）。
   */
  segment?: TravelPillSegment;
  tripId?: string;
  /** 顯示在 dialog title 旁的 from→to entry 名稱（optional） */
  fromName?: string | null;
  toName?: string | null;
  /** ⚠ button 點擊 callback（caller 呼叫 recompute-travel endpoint） */
  onRecompute?: () => void;
}

/**
 * Format distance in meters → human label.
 *  ≥10 km → "X km"（整數，整 km 不帶小數）
 *  ≥1 km → "X.X km"（短距離保留 1 位小數區分 1.5 vs 2.0）
 *  <1 km → "Y00 m"（rounded to 50m）
 * 對應 mockup .tp-detail-travel:6258 顯示風格："4.2 km" / "30 km" / "5.4 km"。
 */
function formatDistance(m: number): string {
  if (m >= 10000) return `${Math.round(m / 1000)} km`;
  if (m >= 1000) {
    const km = m / 1000;
    const display = Number.isInteger(km) ? String(km) : km.toFixed(1).replace(/\.0$/, '');
    return `${display} km`;
  }
  const rounded = Math.round(m / 50) * 50;
  return `${rounded} m`;
}

export default function TravelPill({
  type,
  desc,
  min,
  distanceM,
  segment,
  tripId,
  fromName,
  toName,
  onRecompute,
}: TravelPillProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  // v2.29.1 stale 偵測：純看 segment.computedAt — backend mark stale 時設 NULL，
  // user 觸發 recompute 後寫回 epoch ms。stale 時不顯示舊 min/distance，只渲染
  // 「車程未更新 重新計算」chip。
  const isStale = segment != null && segment.computedAt == null;

  // 若 segment 提供，優先用 segment.mode/min/distanceM 顯示（v2.24.0 SoT）
  const effectiveType = segment?.mode ?? type ?? null;
  const effectiveMin = isStale ? null : (segment?.min ?? min ?? null);
  const effectiveDist = isStale ? null : (segment?.distanceM ?? distanceM ?? null);

  const hasMin = typeof effectiveMin === 'number' && effectiveMin > 0;
  const hasDist = typeof effectiveDist === 'number' && effectiveDist > 0;
  const hasDesc = typeof desc === 'string' && desc.trim().length > 0;
  // Stale render path：即使沒有 min/dist 也要露出 ⚠ chip 讓 user 觸發 recompute。
  if (!hasMin && !hasDist && !hasDesc && !isStale) return null;

  const iconName = TYPE_ICON_MAP[(effectiveType ?? '').toLowerCase()] ?? 'car';
  const isInteractive = !!segment && !!tripId;

  // Pill 內部內容 — 必須只含 non-interactive elements（pill 本身可能 wrap 成 <button>，
  // 內部不可再有 <button>/<a>，否則 HTML5 違規 + a11y 破）。Stale ⚠ chip 含 recompute
  // button，因此渲染成 pill 旁的 sibling，不放進 inner。
  const inner = (
    <>
      <span className="tp-travel-pill-icon" aria-hidden="true">
        <Icon name={iconName} />
      </span>
      <span className="tp-travel-pill-meta">
        {/* mockup .tp-detail-travel:6254-6258 順序：min → sep → distance（與 v2.23.0 之前的 dist 先 → min 後相反）。 */}
        {hasMin && <span className="tp-travel-pill-min">{effectiveMin} min</span>}
        {hasDist && hasMin && <span className="tp-travel-pill-sep">·</span>}
        {hasDist && <span className="tp-travel-pill-min">{formatDistance(effectiveDist!)}</span>}
        {(hasDist || hasMin) && hasDesc && <span className="tp-travel-pill-sep">·</span>}
        {hasDesc && <span className="tp-travel-pill-desc">{desc}</span>}
      </span>
      {isInteractive && (
        <span className="tp-travel-pill-affordance" aria-hidden="true">▾</span>
      )}
    </>
  );

  const staleChip = isStale ? (
    <span
      className="tp-travel-pill-stale"
      aria-label="車程未更新 — Google Routes 尚未重新計算"
      data-testid="travel-pill-stale"
    >
      <span aria-hidden="true">⚠</span>
      <span>車程未更新</span>
      {onRecompute && (
        <button
          type="button"
          className="tp-travel-pill-recompute"
          onClick={onRecompute}
          data-testid="travel-pill-recompute"
          aria-label="重新計算車程"
        >
          重新計算
        </button>
      )}
    </span>
  ) : null;

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <span className="tp-travel-pill-wrap">
        {isInteractive ? (
          <button
            type="button"
            className="tp-travel-pill is-interactive"
            onClick={() => setDialogOpen(true)}
            aria-label={`交通方式 ${MODE_LABEL[(effectiveType ?? '').toLowerCase()] ?? effectiveType ?? ''}${hasMin ? ` ${effectiveMin} 分鐘` : ''}（點擊變更）`}
            data-testid="travel-pill"
          >
            {inner}
          </button>
        ) : (
          <div className="tp-travel-pill" role="presentation" data-testid="travel-pill">
            {inner}
          </div>
        )}
        {staleChip}
      </span>
      {dialogOpen && segment && tripId && (
        <TravelPillDialog
          tripId={tripId}
          segmentId={segment.id}
          currentMode={segment.mode}
          currentMin={segment.min}
          distanceM={segment.distanceM}
          fromName={fromName}
          toName={toName}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  );
}
