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
 * 後者透過 PATCH /api/trips/:id/segments/:sid 寫入 + 設 mode_source='user'。
 *
 * Backwards compat：未提供 segment props → 沿用 v2.23 唯讀渲染（TimelineRail
 * 接線在 γ.1 PR）。
 */
import { useState } from 'react';
import Icon from '../shared/Icon';
import TravelPillDialog, { type TravelMode } from './TravelPillDialog';

const SCOPED_STYLES = `
.tp-travel-pill-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0 6px 110px;
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
  color: var(--color-accent);
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
.tp-travel-pill-lock {
  color: var(--color-accent-deep);
  display: inline-flex; align-items: center;
  margin-left: 2px;
}
.tp-travel-pill-lock svg { width: 11px; height: 11px; }
/* Stale-travel ⚠ indicator + recompute button — sibling of pill (not nested, avoid button-in-button) */
.tp-travel-pill-stale {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-priority-high-bg, rgba(192, 57, 43, 0.10));
  color: var(--color-priority-high-dot, #c0392b);
  font-size: var(--font-size-caption);
  font-weight: 600;
}
.tp-travel-pill-recompute {
  appearance: none; background: none; border: 0; padding: 2px 6px;
  margin-left: 2px;
  color: var(--color-priority-high-dot, #c0392b);
  font: inherit; font-size: var(--font-size-caption);
  font-weight: 700;
  cursor: pointer;
  border-radius: var(--radius-full);
  text-decoration: underline;
  min-height: var(--spacing-tap-min);
  display: inline-flex; align-items: center;
}
.tp-travel-pill-recompute:hover { background: var(--color-priority-high-bg, rgba(192, 57, 43, 0.16)); filter: brightness(0.95); }
.tp-travel-pill-recompute:focus-visible { outline: 2px solid var(--color-priority-high-dot, #c0392b); outline-offset: 2px; }
@media (max-width: 760px) {
  .tp-travel-pill-wrap { margin-left: 92px; }
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

export interface TravelPillSegment {
  id: number;
  mode: TravelMode;
  modeSource: 'auto' | 'user';
  /** segment.min（auto 是 Google Routes 算的；user 是手動覆寫值）*/
  min: number | null;
  /** segment.distance_m（Google Routes 回傳；transit 因不打 API 為 0 / null）*/
  distanceM: number | null;
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
  /**
   * 預期大圓距離（公尺，由 caller 從 current masters lat/lng 算）。
   * 顯示中的 distanceM 與此值 divergence > STALE_TRAVEL_THRESHOLD_RATIO 時，
   * pill 旁渲染 ⚠ + 重新計算 button。
   * 0/null/undefined → 不警告（caller 表示無法比較，例如 master 缺座標）。
   */
  staleHaversineM?: number | null;
  /** ⚠ button 點擊 callback（caller 呼叫 recompute-travel endpoint） */
  onRecompute?: () => void;
}

/** 公開 export 給 test 與 caller 同步閾值定義。 */
export const STALE_TRAVEL_THRESHOLD_RATIO = 0.2;

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
  staleHaversineM,
  onRecompute,
}: TravelPillProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  // 若 segment 提供，優先用 segment.mode/min/distanceM 顯示（v2.24.0 SoT）
  const effectiveType = segment?.mode ?? type ?? null;
  const effectiveMin = segment?.min ?? min ?? null;
  const effectiveDist = segment?.distanceM ?? distanceM ?? null;
  const isLocked = segment?.modeSource === 'user';

  const hasMin = typeof effectiveMin === 'number' && effectiveMin > 0;
  const hasDist = typeof effectiveDist === 'number' && effectiveDist > 0;
  const hasDesc = typeof desc === 'string' && desc.trim().length > 0;
  if (!hasMin && !hasDist && !hasDesc) return null;

  // Stale-travel detection. 只在 distanceM 有值且 staleHaversineM 有值才比較；
  // divergence = |haversine - displayed| / displayed > THRESHOLD → 渲染 ⚠。
  // transit/walk 沒 distanceM 時 caller 不該傳 staleHaversineM（也比不出），跳過。
  const isStale = (() => {
    if (!hasDist) return false;
    if (typeof staleHaversineM !== 'number' || staleHaversineM <= 0) return false;
    const displayed = effectiveDist!;
    const divergence = Math.abs(staleHaversineM - displayed) / displayed;
    return divergence > STALE_TRAVEL_THRESHOLD_RATIO;
  })();

  const iconName = TYPE_ICON_MAP[(effectiveType ?? '').toLowerCase()] ?? 'car';
  const isInteractive = !!segment && !!tripId;
  const showAffordance = isInteractive && !isLocked;

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
      {showAffordance && (
        <span className="tp-travel-pill-affordance" aria-hidden="true">▾</span>
      )}
      {isLocked && (
        <span
          className="tp-travel-pill-lock"
          aria-label="已手動覆寫"
          data-testid="travel-pill-lock"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a4 4 0 014 4v3h1a1 1 0 011 1v9a1 1 0 01-1 1H7a1 1 0 01-1-1v-9a1 1 0 011-1h1V6a4 4 0 014-4m0 2a2 2 0 00-2 2v3h4V6a2 2 0 00-2-2z"/>
          </svg>
        </span>
      )}
    </>
  );

  const staleChip = isStale ? (
    <span
      className="tp-travel-pill-stale"
      aria-label="車程未更新 — 新首選與舊資料 distance 差距 > 20%"
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
            aria-label={`交通方式 ${effectiveType ?? ''}${hasMin ? ` ${effectiveMin} 分鐘` : ''}${isLocked ? '（已手動覆寫）' : ''}（點擊變更）`}
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
          modeSource={segment.modeSource}
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
