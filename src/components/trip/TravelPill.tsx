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
  /* 柔褐三色：交通 = sage 描邊式（透明底 + sage 邊 + sage 字，2026-06）*/
  background: transparent;
  border: 1.5px solid var(--color-accent-2);
  color: var(--color-accent-2-deep);
  font-size: var(--font-size-footnote);
  width: fit-content;
  font-variant-numeric: tabular-nums;
}
.tp-travel-pill.is-interactive {
  cursor: pointer;
  border: 1.5px solid var(--color-accent-2); /* sage 描邊（取代填滿）*/
  color: var(--color-accent-2-deep);
  font: inherit; font-size: var(--font-size-footnote);
  transition: background 120ms;
}
.tp-travel-pill.is-interactive:hover { background: var(--color-accent-2-subtle); }
.tp-travel-pill.is-interactive:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.tp-travel-pill-icon {
  /* 柔褐三色：交通 sage（描邊式用較深 sage 維持對比，2026-06）*/
  color: var(--color-accent-2-deep);
  display: inline-flex; align-items: center;
  flex-shrink: 0;
}
.tp-travel-pill-icon .svg-icon { width: 14px; height: 14px; }
.tp-travel-pill-meta {
  display: inline-flex; align-items: baseline; gap: 6px;
  white-space: nowrap;
}
.tp-travel-pill-min { font-weight: 700; color: var(--color-accent-2-deep); }
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
/* 車程重算中 status chip — 中性柔 sage 底（移動色系），非警示；self-healing 自動補算，無手動鈕 */
.tp-travel-pill-stale {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-accent-2-subtle);
  color: var(--color-muted);
  font-size: var(--font-size-caption);
  font-weight: 600;
}
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
  /**
   * 2026-07-06 車程重算缺口：pair 完全沒有 segment row（刪除/搬日後的新
   * adjacency、缺座標 pair）。視同 stale — 顯示 status chip，但不 render
   * interactive pill 本體（無 segment.id 可開 TravelPillDialog）。缺座標子集
   * 見 missingCoords。
   */
  missing?: boolean;
  /**
   * missing 的子集：pair 缺 segment row 且至少一端無座標 → self-healing 排除
   * （TimelineRail gaps 條件）、無法自動補算。true 時 chip 顯「缺座標」誠實訊息，
   * 而非假稱「重新計算中」（否則 stuck-on-coords pair 永久誤導；adversarial P1）。
   */
  missingCoords?: boolean;
  /**
   * 重算已終端停滯：唯讀 viewer（403 → auto 全停）或持續 API 失敗（本 scope 不再
   * 重試）。true 時 chip 由樂觀「車程重新計算中」改顯誠實「車程待更新」——不對不會
   * 自己好的 pair 假稱系統正在算（否則 viewer / 持續失敗永久誤導）。TimelineRail
   * 由 getAutoRecomputeStatus 判斷傳入。
   */
  recomputeStalled?: boolean;
  tripId?: string;
  /** 顯示在 dialog title 旁的 from→to entry 名稱（optional） */
  fromName?: string | null;
  toName?: string | null;
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
  missing,
  missingCoords,
  recomputeStalled,
  tripId,
  fromName,
  toName,
}: TravelPillProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  // v2.29.1 stale 偵測：純看 segment.computedAt — backend mark stale 時設 NULL，
  // self-healing recompute 完成後寫回 epoch ms。stale 時不顯示舊 min/distance，只渲染
  // status chip：可自動補算者（computedAt=NULL、或有座標的 missing pair）→「車程重新
  // 計算中」（TimelineRail render 時自動觸發 requestTravelRecompute → helper dispatch
  // segmentUpdated → useTripSegments refetch → pill 自動消失，無需手動鈕）；missingCoords
  // （缺座標、self-healing 排除）→「缺座標」誠實訊息，不假稱計算中。2026-07-06：missing
  // （pair 無 row）視同 stale。
  const isStale = missing === true || (segment != null && segment.computedAt == null);

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

  // stale chip 文案三態（優先序 missingCoords > recomputeStalled > active）：
  //   缺座標   → 無法算，需 user 補座標
  //   停滯     → 唯讀 viewer / 持續失敗，不會自己好 → 誠實「待更新」不假稱計算中
  //   進行中   → 樂觀「重新計算中」（self-healing 自動補算 + refetch 後 chip 自消）
  const staleText = missingCoords ? '缺座標，無法計算車程'
    : recomputeStalled ? '車程待更新'
      : '車程重新計算中';
  const staleAria = missingCoords ? '缺少景點座標，無法計算車程'
    : recomputeStalled ? '車程待更新'
      : '車程重新計算中，系統自動更新';
  const staleChip = isStale ? (
    <span
      className="tp-travel-pill-stale"
      aria-label={staleAria}
      data-testid="travel-pill-stale"
    >
      {staleText}
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
