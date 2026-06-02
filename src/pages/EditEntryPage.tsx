/**
 * EditEntryPage — v2.26.0 全頁編輯 entry（時間 + 從上一站移動方式 + 備註）。
 *
 * Route: `/trip/:tripId/stop/:entryId/edit`
 * 對應 mockup: `docs/design-sessions/2026-05-11-entry-time-segment-mode-edit.html`
 *
 * Layout（沿用 EditTripPage / ChangePoiPage pattern）:
 *   AppShell
 *     sidebar: DesktopSidebarConnected
 *     main:
 *       TitleBar(編輯景點)  ← 左 ← back / 右「儲存」TitleBarPrimaryAction
 *       content: 三 sections
 *         1. 時間 — startTime / endTime "HH:MM" inputs + 停留分鐘 chip
 *         2. 從上一站移動 — segmented control (driving/walking/transit) + lock + transit min
 *         3. 備註 — textarea (Markdown supported)
 *     bottomNav: GlobalBottomNav
 *
 * 進入路徑：TimelineRail expanded toolbar pencil icon → navigate.
 *
 * 儲存策略（並行 PATCH）：
 *   - dirty.entry → PATCH /trips/:id/entries/:eid { start_time, end_time, note }
 *   - dirty.segment → PATCH /trips/:id/segments/:sid { mode, min }
 *   - 兩者皆失敗 → 整體 error；單邊失敗 → 顯示警示但保留 dirty 值。
 *
 * 取消（左 ←）：dirty 跳 ConfirmModal「丟棄變更」 → confirm 才 navigate。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import ConfirmModal from '../components/shared/ConfirmModal';
import Icon from '../components/shared/Icon';
import InlineError from '../components/shared/InlineError';
import ToastContainer, { showToast } from '../components/shared/Toast';
import { TripTimePicker } from '../components/TripTimePicker';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useAutosave } from '../hooks/useAutosave';
import { useTripSegments, type TripSegment } from '../hooks/useTripSegments';
import { POI_TYPE_LABELS, type PoiType } from '../lib/poiCategory';
import { TRAVEL_MODE_LABEL, TRAVEL_MODE_ICON } from '../lib/travelMode';
import { apiFetch, apiFetchRaw } from '../lib/apiClient';
import { ApiError } from '../lib/errors';
import { escUrl } from '../lib/sanitize';
import { EVENT } from '../lib/events';
import { haversineMeters, avgLatLng, CROSS_REGION_THRESHOLD_M, type LatLng } from '../lib/geo';
import { getStopDisplayTitle } from '../lib/stopDisplay';

const SCOPED_STYLES = `
.tp-edit-entry {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 96px;
  display: flex; flex-direction: column;
}
@media (min-width: 768px) {
  .tp-edit-entry { padding: 32px 24px 96px; }
}

.tp-edit-entry-poi {
  /* v2.34.0: align-items flex-start — meta 內含 per-POI 備註行（一行 read /
     展開 textarea），對齊 mockup .ee-poi align-items flex-start。 */
  display: flex; align-items: flex-start; gap: 12px;
  padding: 14px 16px;
  background: var(--color-secondary);
  border-radius: var(--radius-lg);
  margin-bottom: 28px;
}
.tp-edit-entry-poi-icon {
  width: 44px; height: 44px;
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  border-radius: var(--radius-md);
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.tp-edit-entry-poi-icon .svg-icon { width: 20px; height: 20px; }
.tp-edit-entry-poi-meta { flex: 1; min-width: 0; }
.tp-edit-entry-poi-name {
  font-weight: 700; font-size: var(--font-size-headline);
  color: var(--color-foreground);
}
.tp-edit-entry-poi-sub {
  color: var(--color-muted); font-size: var(--font-size-footnote);
  margin-top: 2px;
}
.tp-edit-entry-poi-action {
  width: 44px; height: 44px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  background: var(--color-background);
  border: 1.5px solid var(--color-border);
  color: var(--color-foreground);
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer;
  font: inherit;
  transition: all 120ms;
}
.tp-edit-entry-poi-action:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-subtle);
}
.tp-edit-entry-poi-action:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.tp-edit-entry-poi-action .svg-icon { width: 20px; height: 20px; }

.tp-edit-entry-section { margin-bottom: 28px; }
.tp-edit-entry-section-h {
  display: flex; align-items: center; gap: 8px;
  margin: 0 0 12px;
  font-size: var(--font-size-eyebrow, 0.75rem);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-muted);
}
.tp-edit-entry-section-h .svg-icon { width: 12px; height: 12px; }
.tp-edit-entry-section-aux {
  margin-left: auto;
  font-size: var(--font-size-caption);
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  color: var(--color-muted);
}

/* Time row */
.tp-edit-entry-time-row {
  display: grid;
  /* v2.32.3 fix: minmax(0, 1fr) 允許 grid column 縮短到 input intrinsic
     width 以下，避免 mobile (≤390px viewport) 兩個 time card horizontal
     overflow 22-27px。Input min-width:0 一起放寬 flexbox 預設 min-width
     auto 限制。 */
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}
/* v2.33.22: 抵達/離開卡片 — TripTimePicker 自帶 trigger border + bg，
   wrapper 只負責 label + flex；移除外層 border/padding 避免 double frame。 */
.tp-edit-entry-time-card {
  display: flex; flex-direction: column; gap: 6px;
  min-width: 0;
}
.tp-edit-entry-time-card > span {
  font-size: var(--font-size-caption);
  color: var(--color-muted);
  font-weight: 600;
}
.tp-edit-entry-time-arrow {
  display: flex; align-items: center; justify-content: center;
  color: var(--color-muted);
}
.tp-edit-entry-time-arrow .svg-icon { width: 18px; height: 18px; }
.tp-edit-entry-duration {
  display: inline-flex; align-items: center; gap: 4px;
  margin: 10px 0 0;
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
  background: var(--color-secondary);
  padding: 4px 12px;
  border-radius: var(--radius-full);
}
.tp-edit-entry-duration .svg-icon { width: 12px; height: 12px; }

/* Mode segmented */
.tp-edit-entry-mode-segmented {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  background: var(--color-secondary);
  border-radius: var(--radius-md);
  padding: 4px;
}
.tp-edit-entry-mode-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  padding: 12px 6px;
  border: 0;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font: inherit;
  color: var(--color-muted);
  transition: all 120ms;
  min-height: 64px;
}
.tp-edit-entry-mode-btn:hover {
  background: var(--color-background);
  color: var(--color-foreground);
}
.tp-edit-entry-mode-btn.is-selected {
  background: var(--color-background);
  box-shadow: var(--shadow-md);
  color: var(--color-foreground);
}
.tp-edit-entry-mode-btn .svg-icon { width: 22px; height: 22px; color: var(--color-muted); }
.tp-edit-entry-mode-btn.is-selected .svg-icon { color: var(--color-accent); }
.tp-edit-entry-mode-lab { font-size: var(--font-size-footnote); font-weight: 600; }
.tp-edit-entry-mode-btn.is-selected .tp-edit-entry-mode-lab { font-weight: 700; }

.tp-edit-entry-mode-detail {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; flex-wrap: wrap;
  padding: 12px 16px;
  margin-top: 12px;
  background: var(--color-secondary);
  border-radius: var(--radius-md);
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
}
.tp-edit-entry-mode-detail strong {
  color: var(--color-foreground); font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.tp-edit-entry-transit {
  margin-top: 12px;
  display: flex; align-items: center; gap: 8px;
  flex-wrap: wrap;
  background: var(--color-secondary);
  border-radius: var(--radius-md);
  padding: 12px 16px;
}
.tp-edit-entry-transit label {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  font-weight: 600;
}
.tp-edit-entry-transit input {
  font: inherit;
  font-variant-numeric: tabular-nums;
  font-size: var(--font-size-headline);
  font-weight: 700;
  color: var(--color-foreground);
  border: 1.5px solid var(--color-accent);
  background: var(--color-background);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  width: 90px;
  outline: none;
  text-align: center;
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}
.tp-edit-entry-transit-unit {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
}

/* v2.34.0 per-POI 備註（Variant B「點擊編輯備註行」）— 對齊 mockup
   docs/design-sessions/2026-06-02-entry-poi-note.html + TimelineRail note 視覺語彙。
   read row：有 note 顯文字 / 空 → 「+ 加備註」affordance；點擊就地展開 textarea。 */
.tp-poi-note-read {
  margin-top: 8px;
  font-size: var(--font-size-footnote);
  color: var(--color-foreground);
  background: var(--color-background);
  border: 1.5px solid transparent;
  border-radius: var(--radius-sm);
  /* 44px tap target：padding 撐到 ≥44px 高（硬規則）。 */
  min-height: 44px;
  padding: 10px 10px;
  /* role="button" 互動元素 → pointer（非 text I-beam），與語意一致（adversarial H2）。 */
  cursor: pointer;
  display: flex; gap: 6px; align-items: flex-start;
  text-align: left;
  font-family: inherit;
}
.tp-poi-note-read:hover { border-color: var(--color-border); }
.tp-poi-note-read:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.tp-poi-note-read.is-empty {
  color: var(--color-muted);
  font-style: italic;
  cursor: pointer;
}
/* master 卡在 --color-secondary 底上 → 透明底 variant。 */
.tp-poi-note-read.on-secondary { background: transparent; }
.tp-poi-note-read.on-secondary:hover { border-color: var(--color-line-strong); }
.tp-poi-note-icon {
  color: var(--color-muted);
  flex-shrink: 0;
  margin-top: 1px;
  display: inline-flex;
}
.tp-poi-note-icon .svg-icon { width: 13px; height: 13px; }
.tp-poi-note-text {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.tp-poi-note-edit { margin-top: 8px; }
.tp-poi-note-input {
  width: 100%;
  font: inherit;
  font-size: var(--font-size-footnote);
  line-height: 1.5;
  background: var(--color-background);
  border: 1.5px solid var(--color-accent);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  resize: vertical;
  min-height: 62px;
  color: var(--color-foreground);
  outline: none;
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}
.tp-poi-note-bar {
  display: flex; align-items: center; gap: 8px;
  /* ≤640px alternate 窄欄下「完成」+ kbd 提示需可換行，避免 horizontal overflow
     （硬規則 ≤640px 不 overflow；對齊 TimelineRail .tp-rail-note-actions）（adversarial M3）。 */
  flex-wrap: wrap;
  margin-top: 6px;
}
.tp-poi-note-done {
  font: inherit;
  font-size: var(--font-size-caption);
  font-weight: 700;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-muted);
  padding: 0 16px;
  cursor: pointer;
  /* 44px tap target（硬規則）— mockup 34px bump 到 44px。 */
  min-height: 44px;
}
.tp-poi-note-done:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.tp-poi-note-done:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.tp-poi-note-kbd {
  font-size: var(--font-size-caption);
  color: var(--color-muted);
  margin-left: auto;
}
.tp-poi-note-kbd kbd {
  background: var(--color-background);
  padding: 1px 6px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--color-border);
  font-family: ui-monospace, monospace;
  font-size: var(--font-size-caption);
}

.tp-edit-entry-error {
  margin-top: 12px;
}

/* v2.27.0 multi-POI alternates section */
.tp-edit-entry-alternates { margin-bottom: 28px; }
.tp-edit-entry-alternates-h {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.tp-edit-entry-alternates-h .h-left { display: flex; align-items: center; gap: 8px; }
.tp-edit-entry-alternates-h .label {
  font-size: var(--font-size-eyebrow);
  font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--color-muted);
}
.tp-edit-entry-alt-chip {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-footnote);
  font-weight: 600;
}
.tp-edit-entry-alt-chip-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--color-accent);
}

/* v2.28.0 — restaurant inline info (price/hours/reservation) under type label */
.tp-edit-entry-alt-extra {
  display: flex; flex-wrap: wrap; gap: 4px 8px;
  margin-top: 4px;
}
.tp-edit-entry-alt-extra .alt-extra-chip {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  line-height: 1.4;
}
.tp-edit-entry-alt-extra .alt-extra-chip.is-link {
  color: var(--color-accent);
  text-decoration: none;
}
.tp-edit-entry-alt-extra .alt-extra-chip.is-link:hover {
  text-decoration: underline;
}
.tp-edit-entry-alt-rating {
  display: inline-flex; align-items: center; gap: 2px;
  margin-left: 6px; font-size: var(--font-size-footnote);
  color: var(--color-muted);
}
.tp-edit-entry-alt-rating svg {
  width: 12px; height: 12px;
}
.tp-edit-entry-alt-row {
  /* v2.34.0: align-items flex-start — meta 內含 per-POI 備註行；actions 對齊頂端
     （對齊 mockup .ee-alt align-items flex-start）。mobile 已 flex-wrap。 */
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: 8px;
  min-height: 44px;
}
.tp-edit-entry-alt-row.is-pending {
  opacity: 0.65;
  pointer-events: none;
  cursor: wait;
}
.tp-edit-entry-alt-order {
  font-size: var(--font-size-caption);
  color: var(--color-muted);
  font-weight: 600;
  min-width: 18px;
  font-variant-numeric: tabular-nums;
}
.tp-edit-entry-alt-meta { flex: 1; min-width: 0; }

/* v2.33.138 mobile fix: 4 button actions (44px each) 在 ≤640px 把 meta 擠到 ~120px，
   alt-extra-chip.hours 含整週營業時段被迫 wrap 成多行看似多行 textarea。
   Mobile 改 flex-wrap, meta 取全寬, actions 換到下一行 align right。 */
@media (max-width: 640px) {
  .tp-edit-entry-alt-row {
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .tp-edit-entry-alt-meta {
    flex-basis: calc(100% - 28px);
  }
  .tp-edit-entry-alt-actions {
    flex-basis: 100%;
    justify-content: flex-end;
    margin-top: 4px;
  }
}
.tp-edit-entry-alt-name {
  font-weight: 600;
  font-size: var(--font-size-subheadline);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tp-edit-entry-alt-category {
  font-size: var(--font-size-caption);
  color: var(--color-muted);
}
.tp-edit-entry-alt-actions { display: flex; gap: 4px; flex-shrink: 0; }
.tp-edit-entry-alt-actions button {
  width: 44px; height: 44px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-muted);
  font-size: var(--font-size-support);
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.tp-edit-entry-alt-actions button .svg-icon { width: 18px; height: 18px; }
.tp-edit-entry-alt-actions button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.tp-edit-entry-alt-actions button[disabled] { opacity: 0.4; cursor: not-allowed; }
.tp-edit-entry-alt-actions button.set-master {
  width: auto; min-width: 76px;
  padding: 0 12px;
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  border-color: transparent;
  font-weight: 600;
  font-size: var(--font-size-caption);
}
.tp-edit-entry-alt-actions button.set-master:hover { background: var(--color-accent-bg); }
.tp-edit-entry-alt-actions button.alt-delete:hover {
  color: var(--color-destructive);
  border-color: var(--color-destructive);
}
.tp-edit-entry-alt-empty {
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
  line-height: 1.5;
  padding: 10px 12px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-secondary);
}

.tp-edit-entry-alt-add-row {
  display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;
}
.tp-edit-entry-alt-add-btn {
  flex: 1;
  min-width: 180px;
  min-height: 44px;
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  border: 1px dashed var(--color-accent);
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: var(--font-size-footnote);
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  cursor: pointer;
}
.tp-edit-entry-alt-add-btn:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.tp-edit-entry-alt-error {
  background: var(--color-destructive-bg);
  color: var(--color-destructive);
  padding: 8px 12px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-footnote);
  margin: 8px 0;
}

/* Danger zone */
.tp-edit-entry-danger {
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}
.tp-edit-entry-danger-btn {
  width: 100%;
  min-height: 44px;
  background: transparent;
  color: var(--color-destructive);
  border: 1px solid var(--color-destructive-bg);
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: var(--font-size-footnote);
  cursor: pointer;
}
.tp-edit-entry-danger-btn:hover { background: var(--color-destructive-bg); }
.tp-edit-entry-danger-btn:focus-visible {
  outline: 2px solid var(--color-destructive);
  outline-offset: 2px;
}

/* discard-changes 用 shared <ConfirmModal>（沒額外樣式） */
`;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const POI_TYPE_ICON: Record<string, string> = {
  hotel: 'hotel',
  restaurant: 'utensils',
  shopping: 'shopping',
  attraction: 'location-pin',
  transport: 'car',
  parking: 'parking',
  activity: 'sparkle',
};
// v2.33.28: dedupe — POI_TYPE_LABEL 用 canonical POI_TYPE_LABELS（poiCategory.ts），
// MODE_LABEL/ICON 用 canonical TRAVEL_MODE_LABEL/ICON（travelMode.ts）。
// 移除本地 const 解 v2.31.23 一系列 drift bug 家族 root cause。
// (hotel canonical = '飯店'，TimelineRail/EditEntry 之前 local 用 '住宿' 屬 drift。)

// v2.29.0: POI card display uses the canonical entry master.
type TimelineEntryLike = {
  master?: { name?: string | null; type?: string | null } | null;
  title?: string | null;
};
function poiNameFrom(me: TimelineEntryLike | null | undefined, placeholderTitle?: string | null): string {
  return me?.master?.name ?? me?.title ?? placeholderTitle ?? '景點';
}
function poiTypeFrom(me: TimelineEntryLike | null | undefined): string | null {
  return me?.master?.type ?? null;
}

interface AlternatePoi {
  poiId: number;
  name: string;
  sortOrder: number;
  type?: string | null;
  category?: string | null;
  // v2.29.0 — restaurant-shared attributes surface from canonical trip_entry_pois.
  hours?: string | null;
  rating?: number | null;
  price?: string | null;
  reservation?: string | null;
  reservationUrl?: string | null;
  /** v2.34.0 — per-POI 備註（trip_entry_pois.note）。 */
  note?: string | null;
  /** POI coords — feed cross-region warning when this row is set as master. */
  lat?: number | null;
  lng?: number | null;
}

type EntryPoiPayload = Omit<AlternatePoi, 'sortOrder'> & { sortOrder?: number | null };

interface MasterPoiSummary {
  poiId: number;
  name: string;
  type?: string | null;
  /** v2.34.0 — per-POI 備註（trip_entry_pois.note）。 */
  note?: string | null;
  /** Master coords — baseline for sibling-distance comparison（cross-region warning）。 */
  lat?: number | null;
  lng?: number | null;
}

// API 走 json() 自動 deepCamel — 必須用 camelCase 讀，不是 DB snake_case。
interface EntryApi {
  id: number;
  dayId: number;
  title?: string | null;
  time?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  note?: string | null;
  master?: {
    poiId?: number;
    name?: string | null;
    type?: string | null;
    note?: string | null;
    lat?: number | null;
    lng?: number | null;
  } | null;
  alternates?: EntryPoiPayload[];
  entryPoisVersion?: string | number | null;
}

interface TripMeta {
  title?: string | null;
  name?: string | null;
}

interface DayApi {
  id?: number;
  dayNum?: number;
  timeline?: Array<{
    id?: number | null;
    title?: string | null;
    displayTitle?: string | null;
    master?: { poiId?: number; name?: string | null; type?: string | null; note?: string | null; lat?: number | null; lng?: number | null } | null;
    alternates?: EntryPoiPayload[];
    entryPoisVersion?: string | number | null;
  }>;
}

function durationMinutes(start: string, end: string): number | null {
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) return null;
  const sParts = start.split(':');
  const eParts = end.split(':');
  if (sParts.length < 2 || eParts.length < 2) return null;
  const sh = Number(sParts[0]); const sm = Number(sParts[1]);
  const eh = Number(eParts[0]); const em = Number(eParts[1]);
  if (!Number.isFinite(sh) || !Number.isFinite(sm) || !Number.isFinite(eh) || !Number.isFinite(em)) return null;
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? diff : null;
}

function formatKm(m: number | null): string | null {
  if (typeof m !== 'number' || m <= 0) return null;
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 50) * 50} m`;
}

// Restaurant / coord fields shared between init useEffect and refreshEntryPois —
// 抽 helper 避免 drift（v2.28.0 ship 時 refresh path 漏抄 restaurant fields → swap 後 chips 消失）。
function mapAlternate(a: EntryPoiPayload): AlternatePoi {
  return {
    poiId: a.poiId,
    name: a.name ?? '景點',
    sortOrder: a.sortOrder ?? 0,
    type: a.type ?? null,
    category: a.category ?? null,
    hours: a.hours ?? null,
    rating: a.rating ?? null,
    price: a.price ?? null,
    reservation: a.reservation ?? null,
    reservationUrl: a.reservationUrl ?? null,
    note: a.note ?? null,
    lat: a.lat ?? null,
    lng: a.lng ?? null,
  };
}

/** Pluck master coords from timeline siblings (exclude self). 用於 cross-region warning。 */
function extractSiblingCoords(
  timeline: NonNullable<DayApi['timeline']>,
  excludeEntryId: number,
): LatLng[] {
  const out: LatLng[] = [];
  for (const t of timeline) {
    if (t.id === excludeEntryId) continue;
    const lat = t.master?.lat;
    const lng = t.master?.lng;
    if (typeof lat === 'number' && typeof lng === 'number') {
      out.push({ lat, lng });
    }
  }
  return out;
}

interface PerPoiNoteRowProps {
  tripId: string;
  entryId: number;
  poiId: number;
  /** 既有 per-POI 備註值（read state 顯示 / edit state 初始 textarea 值）。 */
  initialNote?: string | null;
  /**
   * read row 是否在 master 卡（`--color-secondary` 底）上 → 透明底 variant。
   * 對齊 mockup `.note-read.on-secondary`。
   */
  onSecondary?: boolean;
}

/**
 * PerPoiNoteRow — v2.34.0 Variant B「點擊編輯備註行」。
 *
 * 每個 master / alternate POI 各掛一個獨立 instance（各自一個 useAutosave hook，
 * 符合 Rules of Hooks — alternates 是動態陣列，hook 不能在 .map() 內呼叫）。
 *
 * read state（未編輯）：有 note → 顯示文字 + ✎ icon；空 → 「+ 加備註」affordance。
 * edit state（點擊後）：textarea autosave + 「完成」button + ⌘↩ 完成 / esc 關閉，
 *   沿用 TimelineRail 既有 inline note edit 視覺語彙。
 *
 * autosave：debounce 800ms / onBlur flush → PATCH /trips/:id/entries/:eid/pois/:poiId
 *   body { note }。LWW（D4）— 刻意不帶 entryPoisVersion OCC token。清空 → note: ''
 *   （端點 trim 成空字串 → 寫 null 清除）。失敗 → showToast。
 */
function PerPoiNoteRow({ tripId, entryId, poiId, initialNote, onSecondary }: PerPoiNoteRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialNote ?? '');

  // initialNote 變更（如 master swap / refresh 帶新值）→ 非編輯中時 re-init draft，
  // 讓 read row 顯示最新值。編輯中不覆寫避免吃掉 user 正在打的字。
  useEffect(() => {
    if (!editing) setDraft(initialNote ?? '');
  }, [initialNote, editing]);

  const noteAutosave = useAutosave<{ note: string }>({
    debounceMs: 800,
    save: async (body) => {
      const res = await apiFetchRaw(
        `/trips/${encodeURIComponent(tripId)}/entries/${entryId}/pois/${poiId}`,
        {
          method: 'PATCH',
          // LWW — 不帶 entryPoisVersion；端點刻意不收/不 bump OCC token。
          body: JSON.stringify({ note: body.note ?? '' }),
        },
      );
      if (!res.ok) throw await ApiError.fromResponse(res);
      return await res.json() as Record<string, unknown>;
    },
  });

  // autosave error → toast（對齊 TimelineRail；監聽 error state transition，
  // 避免每 re-render 重複 toast）。
  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (noteAutosave.state === 'error' && noteAutosave.error && noteAutosave.error !== lastErrorRef.current) {
      lastErrorRef.current = noteAutosave.error;
      showToast(`備註儲存失敗：${noteAutosave.error}`, 'error', 6000);
    } else if (noteAutosave.state !== 'error') {
      lastErrorRef.current = null;
    }
  }, [noteAutosave.state, noteAutosave.error]);

  const beginEdit = useCallback(() => {
    setDraft(initialNote ?? '');
    setEditing(true);
  }, [initialNote]);

  const closeEdit = useCallback(async () => {
    await noteAutosave.flush();
    setEditing(false);
  }, [noteAutosave]);

  const handleChange = (value: string) => {
    setDraft(value);
    noteAutosave.patch({ note: value });
  };

  const handleBlur = () => {
    void noteAutosave.flush();
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      void closeEdit();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void closeEdit();
    }
  };

  const hasNote = !!draft.trim();

  if (editing) {
    return (
      <div className="tp-poi-note-edit">
        <textarea
          className="tp-poi-note-input"
          value={draft}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKey}
          autoFocus
          maxLength={1000}
          data-testid={`edit-entry-poi-note-input-${poiId}`}
        />
        <div className="tp-poi-note-bar">
          <button
            type="button"
            className="tp-poi-note-done"
            onClick={() => void closeEdit()}
            data-testid={`edit-entry-poi-note-done-${poiId}`}
          >
            完成
          </button>
          <span className="tp-poi-note-kbd">
            <kbd>⌘</kbd> + <kbd>↩</kbd> 完成 · <kbd>esc</kbd> 關閉
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`tp-poi-note-read${hasNote ? '' : ' is-empty'}${onSecondary ? ' on-secondary' : ''}`}
      role="button"
      tabIndex={0}
      onClick={beginEdit}
      onKeyDown={(e) => {
        // role="button" 必須同時支援 Enter 與 Space（WAI-ARIA），Space 需 preventDefault
        // 防頁面捲動（adversarial H1）。
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          beginEdit();
        }
      }}
      data-testid={`edit-entry-poi-note-read-${poiId}`}
    >
      <span className="tp-poi-note-icon" aria-hidden="true"><Icon name="pencil" /></span>
      <span className="tp-poi-note-text">{hasNote ? draft : '+ 加備註'}</span>
    </div>
  );
}

export default function EditEntryPage() {
  const { tripId, entryId: entryIdParam } = useParams<{ tripId: string; entryId: string }>();
  const entryId = Number(entryIdParam);
  const navigate = useNavigate();
  const goBackHref = tripId ? `/trips?selected=${encodeURIComponent(tripId)}` : '/trips';
  const goBack = useNavigateBack(goBackHref);
  const { user } = useCurrentUser();

  const [entry, setEntry] = useState<EntryApi | null>(null);
  const [poiInfo, setPoiInfo] = useState<{ name: string; poiType: string | null } | null>(null);
  const [prevEntry, setPrevEntry] = useState<{ id: number; title: string } | null>(null);
  const [tripName, setTripName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // v2.27.0 multi-POI per entry
  const [alternates, setAlternates] = useState<AlternatePoi[]>([]);
  const [masterSummary, setMasterSummary] = useState<MasterPoiSummary | null>(null);
  const [entryPoisVersion, setEntryPoisVersion] = useState<string | null>(null);
  /** 當日其他 entries 的 master 座標（cross-region warning 基準）。 */
  const [siblingMasterCoords, setSiblingMasterCoords] = useState<LatLng[]>([]);
  const [altSwapConfirm, setAltSwapConfirm] = useState<AlternatePoi | null>(null);
  const [altRemoveConfirm, setAltRemoveConfirm] = useState<AlternatePoi | null>(null);
  const [showDeleteStopConfirm, setShowDeleteStopConfirm] = useState(false);
  const [altPending, setAltPending] = useState<number | null>(null);
  const [altError, setAltError] = useState<string | null>(null);

  // Form state
  // v2.34.0: entry-level note 已移除（migration 0078 DROP）；改 per-POI 備註，
  // 每個 master / alternate 各自編輯，autosave 打 PATCH /entries/:eid/pois/:poiId。
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [mode, setMode] = useState<TripSegment['mode'] | null>(null);
  const [transitMin, setTransitMin] = useState<string>('');

  // Original values for dirty-check + discard-modal
  const originalRef = useRef<{
    startTime: string; endTime: string;
    mode: TripSegment['mode'] | null; transitMin: string;
  }>({ startTime: '', endTime: '', mode: null, transitMin: '' });

  const [submitting, setSubmitting] = useState(false);
  // v2.33.139: 移除 `error` state — titleBar SaveStatus 已拔 (user feedback
  // 「右上角不用顯示狀態」)，error 細節走 showToast 即時呈現，不需 useState 持有。
  // 保留以前的 setError(...) call sites 改 showToast(...)。
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  const { segmentMap } = useTripSegments(tripId);

  // Load entry
  useEffect(() => {
    if (!tripId || !Number.isInteger(entryId) || entryId <= 0) {
      setLoadError('無效的 entry ID');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<EntryApi>(`/trips/${encodeURIComponent(tripId)}/entries/${entryId}`);
        if (cancelled) return;
        setEntry(data);
        if (data.master?.poiId != null) {
          setPoiInfo({
            name: data.master.name ?? data.title ?? '景點',
            poiType: data.master.type ?? null,
          });
          setMasterSummary({
            poiId: data.master.poiId,
            name: data.master.name ?? data.title ?? '景點',
            type: data.master.type ?? null,
            note: data.master.note ?? null,
            lat: data.master.lat ?? null,
            lng: data.master.lng ?? null,
          });
        }
        setAlternates((data.alternates ?? []).map(mapAlternate));
        if (data.entryPoisVersion != null) setEntryPoisVersion(String(data.entryPoisVersion));
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : '載入失敗');
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tripId, entryId]);

  // Load trip meta — 給 TitleBar 顯示 「編輯景點 · {tripName}」（v2.26.4 mockup V1）
  // 失敗時只省略 tripName，不擋 entry load。
  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    apiFetch<TripMeta>(`/trips/${encodeURIComponent(tripId)}`)
      .then((data) => {
        if (cancelled) return;
        const name = data?.title || data?.name;
        if (name) setTripName(name);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tripId]);

  // Once entry is loaded, fetch the day for prev-entry context + POI meta
  useEffect(() => {
    if (!entry || !tripId) return;
    let cancelled = false;
    (async () => {
      try {
        // entry.dayId → dayNum — fetch via days endpoint pattern: GET /trips/:id/days
        const days = await apiFetch<Array<{ id: number; dayNum: number }>>(`/trips/${encodeURIComponent(tripId)}/days`);
        if (cancelled) return;
        const day = days.find((d) => d.id === entry.dayId);
        if (!day) return;
        const dayData = await apiFetch<DayApi>(
          `/trips/${encodeURIComponent(tripId)}/days/${day.dayNum}`,
        );
        if (cancelled) return;
        const timeline = Array.isArray(dayData.timeline) ? dayData.timeline : [];
        const idx = timeline.findIndex((e) => e.id === entryId);
        const me = idx >= 0 ? timeline[idx] : null;
        if (me) {
          // v2.29.0: canonical master comes from trip_entry_pois.
          setPoiInfo({
            name: poiNameFrom(me, entry.title),
            poiType: poiTypeFrom(me),
          });
          // v2.27.0 multi-POI: master + alternates 從 day fetch 帶出
          if (me.master?.poiId != null) {
            setMasterSummary({
              poiId: me.master.poiId,
              name: me.master.name ?? me.title ?? '景點',
              type: me.master.type ?? null,
              note: me.master.note ?? null,
              lat: me.master.lat ?? null,
              lng: me.master.lng ?? null,
            });
          }
          if (Array.isArray(me.alternates)) {
            setAlternates(me.alternates.map(mapAlternate));
          }
          if (me.entryPoisVersion != null) {
            setEntryPoisVersion(String(me.entryPoisVersion));
          }
        }
        setSiblingMasterCoords(extractSiblingCoords(timeline, entryId));
        const prev = idx > 0 ? timeline[idx - 1] : null;
        if (prev?.id != null) {
          // v2.31.29: 與 TimelineRail 對齊 — mapDay.ts 計算 displayTitle = poiName ?? title，
          // 但 backend GET /days/:dayNum 不回此欄位（mapDay 是 frontend-only DaySection.tsx
          // 內呼叫）。直接從 master.name 重算。例如 entry.title="抵達那霸機場" 但 POI
          // name="那霸機場" 時，TimelineRail 顯「那霸機場」，header 也應顯「那霸機場」。
          const derivedTitle = getStopDisplayTitle({
            title: prev.title ?? null,
            poiName: prev.master?.name ?? null,
          }) ?? prev.title ?? '';
          setPrevEntry({ id: prev.id, title: derivedTitle });
        }
      } catch {
        // graceful — don't block edit
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [entry, tripId, entryId]);

  // Init form once entry + segmentMap available
  useEffect(() => {
    if (!entry) return;
    const initialStart = entry.startTime ?? '';
    const initialEnd = entry.endTime ?? '';
    setStartTime(initialStart);
    setEndTime(initialEnd);
    originalRef.current = {
      ...originalRef.current,
      startTime: initialStart,
      endTime: initialEnd,
    };
  }, [entry]);

  const segment = useMemo(() => {
    if (!prevEntry || !Number.isInteger(entryId)) return undefined;
    return segmentMap.get(`${prevEntry.id}-${entryId}`);
  }, [prevEntry, entryId, segmentMap]);

  useEffect(() => {
    if (!segment) return;
    setMode(segment.mode);
    setTransitMin(segment.mode === 'transit' && typeof segment.min === 'number' ? String(segment.min) : '');
    originalRef.current = {
      ...originalRef.current,
      mode: segment.mode,
      transitMin: segment.mode === 'transit' && typeof segment.min === 'number' ? String(segment.min) : '',
    };
  }, [segment]);

  const validation = useMemo(() => {
    if (startTime && !TIME_RE.test(startTime)) return '抵達時間格式錯誤（HH:MM）';
    if (endTime && !TIME_RE.test(endTime)) return '離開時間格式錯誤（HH:MM）';
    if (startTime && endTime && startTime >= endTime) return '抵達時間需早於離開時間';
    if (mode === 'transit') {
      const n = parseInt(transitMin, 10);
      if (!Number.isFinite(n) || n < 1 || n > 1440) return '大眾運輸需填 1–1440 分鐘';
    }
    return null;
  }, [startTime, endTime, mode, transitMin]);

  const dirty = useMemo(() => {
    const o = originalRef.current;
    const entryDirty = startTime !== o.startTime || endTime !== o.endTime;
    const segmentDirty = mode !== o.mode || (mode === 'transit' && transitMin !== o.transitMin);
    return { entryDirty, segmentDirty, any: entryDirty || segmentDirty };
  }, [startTime, endTime, mode, transitMin]);

  const stayMinutes = useMemo(() => {
    if (!startTime || !endTime) return null;
    return durationMinutes(startTime, endTime);
  }, [startTime, endTime]);

  // Cross-region warning for master swap confirm modal.
  // 新 master vs 當日其他 entries 平均座標 > CROSS_REGION_THRESHOLD_M → 紅字提示。
  // 任一座標缺漏 → 不警告（無法判斷）。
  const crossRegionWarning = useMemo<string | null>(() => {
    if (!altSwapConfirm) return null;
    const { lat, lng } = altSwapConfirm;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    const center = avgLatLng(siblingMasterCoords);
    if (!center) return null;
    const d = haversineMeters({ lat, lng }, center);
    if (d <= CROSS_REGION_THRESHOLD_M) return null;
    const km = d >= 100_000 ? Math.round(d / 1000) : Number((d / 1000).toFixed(1));
    return `新正選距離本日其他點約 ${km} km，可能跨區，前後車程會誤算。確定要設為正選？`;
  }, [altSwapConfirm, siblingMasterCoords]);

  const handleSave = useCallback(async () => {
    if (!tripId || !entry || submitting) return;
    if (validation || !dirty.any) return;
    setSubmitting(true);

    const requests: Promise<{ scope: 'entry' | 'segment'; ok: boolean; status: number; text?: string }>[] = [];

    if (dirty.entryDirty) {
      const body: Record<string, unknown> = {};
      if (startTime !== originalRef.current.startTime) body.start_time = startTime || null;
      if (endTime !== originalRef.current.endTime) body.end_time = endTime || null;
      // v2.34.0: note 移除 — entry-level note 已 DROP，PATCH /entries 不再帶 note。
      // v2.33.136 fix: race guard — dirty.entryDirty memo 跟 body 各自比 originalRef，
      // 但 originalRef 是 ref 不在 memo deps。若 dirty 計算後、handleSave 跑前外部
      // 路徑（entry refetch useEffect、prior save 成功 hook）把 originalRef 寫到
      // 跟 current state 一致，dirty 仍 stale=true 但 body={} → backend 400
      // "DATA_VALIDATION: 無有效欄位可更新"（api_logs 過去多次此 error）。
      // Empty body 表示資料其實沒變，跳過 request。
      if (Object.keys(body).length > 0) {
        requests.push(
          apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/entries/${entryId}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          }).then(async (res) => ({ scope: 'entry', ok: res.ok, status: res.status, text: res.ok ? undefined : await res.text() })),
        );
      }
    }

    if (dirty.segmentDirty && segment && mode) {
      const body: Record<string, unknown> = { mode };
      if (mode === 'transit') {
        body.min = parseInt(transitMin, 10);
      }
      requests.push(
        apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/segments/${segment.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        }).then(async (res) => ({ scope: 'segment', ok: res.ok, status: res.status, text: res.ok ? undefined : await res.text() })),
      );
    }

    // v2.33.136 race guard：若 entry race-empty + segmentDirty false → 整 requests
    // 為空，避免空 Promise.all 走進 success path 寫 originalRef 把 stale dirty
    // 鎖死的怪行為，直接 setSubmitting(false) early return。
    if (requests.length === 0) {
      setSubmitting(false);
      return;
    }

    try {
      const results = await Promise.all(requests);
      const failures = results.filter((r) => !r.ok);
      if (failures.length === 0) {
        // 通知 timeline + segments 重新 fetch
        window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, { detail: { tripId, entryId } }));
        if (dirty.segmentDirty) {
          window.dispatchEvent(new CustomEvent(EVENT.segmentUpdated, { detail: { tripId, segmentId: segment?.id } }));
        }
        // v2.33.108: auto-save 後不再 navigate（user 仍在 edit page），update
        // originalRef 讓 dirty 重置避免重複 save，setSubmitting(false) 讓 SaveStatus
        // 從 saving → saved transit。
        originalRef.current = {
          ...originalRef.current,
          startTime, endTime, mode, transitMin,
        };
        setSubmitting(false);
        return;
      }
      const msg = failures
        .map((f) => `${f.scope === 'entry' ? '景點' : '移動方式'}儲存失敗 (${f.status})`)
        .join('；');
      // v2.33.136-139: 對齊 mockup spec「儲存失敗 → 重試 + toast error」+
      // user feedback「右上角不用顯示狀態」。失敗走 toast，無 inline / titleBar
      // 顯示。
      showToast(msg, 'error', 6000);
      setSubmitting(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '儲存失敗';
      showToast(msg, 'error', 6000);
      setSubmitting(false);
    }
  }, [
    tripId, entry, entryId, submitting, validation, dirty,
    startTime, endTime, mode, transitMin, segment,
  ]);

  // v2.33.108: auto-save 後不再需要 discard confirmation — handleCancel 直接 back，
  // pending patch 由 handleSave debounce 內 flush（user 等 800ms 後 navigate）。
  const handleCancel = useCallback(() => {
    goBack();
  }, [goBack]);

  // v2.33.108: debounce auto-save effect — dirty+valid+!submitting 800ms 後 fire handleSave。
  // 取代「儲存」button reassurance（user 改完 800ms 自動 PATCH，SaveStatus 顯示進度）。
  useEffect(() => {
    if (!dirty.any || validation || submitting) return;
    const timer = setTimeout(() => {
      void handleSave();
    }, 800);
    return () => clearTimeout(timer);
  }, [dirty.any, validation, submitting, startTime, endTime, mode, transitMin, handleSave]);

  // v2.27.0 multi-POI handlers ----------------------------------------------

  // round 9 fix: refreshEntryPois 回傳新的 master + version 供 caller decision logic
  // 使用（如 cross-tab safety check in handleSetAsMaster）。useState setter 是 async，
  // 同 callback 內讀不到 fresh value，所以需要把 fresh value bubble up。
  //
  // v2.30.x perf: GET /entries/:id 與 GET /days 互不依賴（兩者都不需要對方結果），
  // 改 Promise.all 並行從 3 個 sequential RT 降到 2 個（GET /entries + GET /days 並行，
  // 然後依 entry.dayId 查 dayNum 再 GET /days/:num 拿 day detail）。
  const refreshEntryPois = useCallback(async (): Promise<{
    masterPoiId: number | null;
    masterName: string | null;
    entryPoisVersion: string | null;
  } | null> => {
    if (!tripId || !Number.isInteger(entryId)) return null;
    try {
      const [data, days] = await Promise.all([
        apiFetch<EntryApi>(`/trips/${encodeURIComponent(tripId)}/entries/${entryId}`),
        apiFetch<Array<{ id: number; dayNum: number }>>(`/trips/${encodeURIComponent(tripId)}/days`),
      ]);
      setEntry((prev) => prev ? { ...prev, ...data } : data);
      // 重抓 day 拿 master/alternates（_merge.ts 已 populate）
      const day = days.find((d) => d.id === data.dayId);
      if (!day) return null;
      const dayData = await apiFetch<DayApi>(
        `/trips/${encodeURIComponent(tripId)}/days/${day.dayNum}`,
      );
      const me = (dayData.timeline ?? []).find((e) => e.id === entryId);
      if (!me) return null;
      // POI card reflects the latest canonical master.
      const freshMasterName = poiNameFrom(me);
      setPoiInfo({ name: freshMasterName, poiType: poiTypeFrom(me) });
      const freshMasterPoiId = me.master?.poiId ?? null;
      if (freshMasterPoiId != null) {
        setMasterSummary({
          poiId: freshMasterPoiId,
          name: freshMasterName,
          type: me.master?.type ?? null,
          note: me.master?.note ?? null,
          lat: me.master?.lat ?? null,
          lng: me.master?.lng ?? null,
        });
      }
      setAlternates((me.alternates ?? []).map(mapAlternate));
      if (me.entryPoisVersion != null) setEntryPoisVersion(String(me.entryPoisVersion));
      setSiblingMasterCoords(extractSiblingCoords(dayData.timeline ?? [], entryId));
      return {
        masterPoiId: freshMasterPoiId,
        masterName: freshMasterName,
        entryPoisVersion: me.entryPoisVersion != null ? String(me.entryPoisVersion) : null,
      };
    } catch {
      // refresh 失敗不阻擋，UI 維持上次狀態
      return null;
    }
  }, [tripId, entryId]);

  const handleSetAsMaster = useCallback(async (alt: AlternatePoi) => {
    if (!tripId || altPending) return;
    setAltPending(alt.poiId);
    setAltError(null);

    // round 9 fix: capture user-perceived master at confirm time for cross-tab safety check.
    // 若 retry 前 master 已被其他 tab 換過（B 收到 409 是因為 A 已 swap）→ abort 不 silent
    // 覆寫 A 的 work，改 surface「此 stop 已被改成 X，請重新確認」讓 user 看到事實再決定。
    const userExpectedOldMaster = masterSummary?.poiId ?? null;

    // round 7 fix: 409 STALE_ENTRY auto-retry once with refreshed version.
    // adversarial round 6 #5 — 之前 UX 把 STALE_ENTRY 當 opaque "設為首選失敗"，
    // 使用者要手動 reload。Auto-refresh + retry 一次後仍失敗才 surface error。
    const sendSwap = async (versionOverride?: string) => {
      const useVersion = versionOverride ?? entryPoisVersion ?? undefined;
      await apiFetch(`/trips/${encodeURIComponent(tripId)}/entries/${entryId}/master`, {
        method: 'PATCH',
        body: JSON.stringify({ poiId: alt.poiId, entryPoisVersion: useVersion }),
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      try {
        await sendSwap();
      } catch (err) {
        if (err instanceof ApiError && err.code === 'STALE_ENTRY') {
          // round 9 fix: refresh 然後 cross-tab master-change detection。
          // round 7 的 retry 是 unconditional → 若 master 已被改成 X，retry 會把它再
          // 改成 Y，user 沒看到 X 的存在（adversarial round 8 #4 silent overwrite）。
          // 現在 refresh 後比對 master：
          //   - 相同 → benign race (例如其他 tab 加 alternate 觸發 version bump) → retry OK
          //   - 不同 → 真實 cross-tab master change → abort + 報「已被改成 X」
          const refreshed = await refreshEntryPois();
          if (refreshed && refreshed.masterPoiId !== userExpectedOldMaster) {
            const intoName = refreshed.masterName ?? `POI #${refreshed.masterPoiId}`;
            throw new Error(`這個停留點已被改成「${intoName}」，請重新確認後再操作`);
          }
          // master 仍相同 — retry with refreshed version
          await sendSwap(refreshed?.entryPoisVersion ?? undefined);
        } else {
          throw err;
        }
      }

      setAltSwapConfirm(null);
      // round 5 fix: dispatch tp-segment-updated so useTripSegments refetches the now-stale
      // adjacent segments (backend marked computed_at=NULL in the setMaster batch).
      window.dispatchEvent(new CustomEvent(EVENT.segmentUpdated, { detail: { tripId } }));
      await refreshEntryPois();
      showToast(`已將「${alt.name}」設為正選`, 'success');
    } catch (err) {
      // Close modal first so altError 在 alternates 區塊正常顯示，不會被 modal 蓋住
      // (Codex 2nd-pass review UX finding)。
      setAltSwapConfirm(null);
      setAltError(err instanceof Error ? err.message : '設為正選失敗');
    } finally {
      setAltPending(null);
    }
  }, [tripId, entryId, entryPoisVersion, altPending, refreshEntryPois, masterSummary]);

  // 開 ConfirmModal — 真正執行刪除在 handleConfirmRemoveAlternate。
  // 用 ConfirmModal 取代 window.confirm 對齊全站 modal style + a11y（Codex
  // pre-landing HIGH #6；window.confirm browser-native 沒法樣式化，跟 swap/delete
  // stop 的 ConfirmModal 不一致）。
  const handleRemoveAlternate = useCallback((alt: AlternatePoi) => {
    if (!tripId || altPending) return;
    setAltRemoveConfirm(alt);
  }, [tripId, altPending]);

  const handleConfirmRemoveAlternate = useCallback(async (alt: AlternatePoi) => {
    if (!tripId) return;
    setAltPending(alt.poiId);
    setAltError(null);
    try {
      // apiFetchRaw 不會 throw on 4xx/5xx — 必須自己檢查 res.ok，否則 backend reject 也會
      // 顯示成功 toast（Codex 2nd-pass review CRITICAL）。
      // round 4 fix F3: OCC token travels via query string (DELETE has no body).
      const versionQuery = entryPoisVersion ? `?entryPoisVersion=${encodeURIComponent(entryPoisVersion)}` : '';
      const res = await apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/entries/${entryId}/alternates/${alt.poiId}${versionQuery}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`移除備選失敗 (${res.status})${text ? `: ${text.slice(0, 120)}` : ''}`);
      }
      setAltRemoveConfirm(null);
      await refreshEntryPois();
      showToast(`已移除備選「${alt.name}」`, 'success');
    } catch (err) {
      setAltError(err instanceof Error ? err.message : '移除備選失敗');
      setAltRemoveConfirm(null);
    } finally {
      setAltPending(null);
    }
  }, [tripId, entryId, entryPoisVersion, refreshEntryPois]);

  const handleReorderAlternate = useCallback(async (poiId: number, direction: 'up' | 'down') => {
    if (!tripId || altPending || alternates.length < 2) return;
    const idx = alternates.findIndex((a) => a.poiId === poiId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= alternates.length) return;
    const newOrder = alternates.map((a) => a.poiId);
    const a = newOrder[idx];
    const b = newOrder[swapIdx];
    if (a == null || b == null) return;
    newOrder[idx] = b;
    newOrder[swapIdx] = a;
    setAltPending(poiId);
    setAltError(null);
    try {
      await apiFetch(`/trips/${encodeURIComponent(tripId)}/entries/${entryId}/alternates/reorder`, {
        method: 'PATCH',
        // round 4 fix F3: pass entryPoisVersion for OCC (concurrent reorders previously
        // silently overwrote each other).
        body: JSON.stringify({ order: newOrder, entryPoisVersion: entryPoisVersion ?? undefined }),
        headers: { 'Content-Type': 'application/json' },
      });
      await refreshEntryPois();
    } catch (err) {
      setAltError(err instanceof Error ? err.message : '排序失敗');
    } finally {
      setAltPending(null);
    }
  }, [tripId, entryId, alternates, altPending, entryPoisVersion, refreshEntryPois]);

  const handleDeleteStop = useCallback(async () => {
    if (!tripId) return;
    setSubmitting(true);
    try {
      // apiFetchRaw 不 throw on 4xx/5xx — 必須自己檢查 res.ok 防止 backend reject
      // 仍 navigate-away（Codex 2nd-pass review CRITICAL）。
      const res = await apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/entries/${entryId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`刪除停留點失敗 (${res.status})${text ? `: ${text.slice(0, 120)}` : ''}`);
      }
      setShowDeleteStopConfirm(false);
      navigate(goBackHref);
    } catch (err) {
      // v2.33.139: 走 toast (對齊 save fail path)，不再 setError state。
      showToast(err instanceof Error ? err.message : '刪除停留點失敗', 'error', 6000);
      setShowDeleteStopConfirm(false);
    } finally {
      setSubmitting(false);
    }
  }, [tripId, entryId, navigate, goBackHref]);

  // ⌘+Enter / ⌘+S 儲存
  // v2.33.47 round 7b: 加 modal-aware guard — 若 inner ConfirmModal 開著（discard
  // 確認 / alt swap 確認）不該被 page-level shortcut 偷 Esc。同時跳過 e.repeat
  // 連發 + 跳過 textarea / contentEditable 內的 ⌘+S (browser native save dialog
  // 雖被 preventDefault 但 inner edit shortcut 可能也用到 Cmd+S)。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      // 任一 modal 開著 → 讓 modal 自己的 Escape handler 接 (ConfirmModal 內部
      // 有 onCancel)，page-level shortcut 不介入。
      if (showDiscardModal || altSwapConfirm) return;
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Enter' || e.key === 's')) {
        e.preventDefault();
        void handleSave();
      } else if (e.key === 'Escape') {
        // 不擋輸入中的 textarea / input — 雖然 modal 已擋，但 inner inputs
        // 可能 still want native Escape (e.g. cancel IME composition)。
        const target = e.target as HTMLElement | null;
        if (target?.tagName === 'TEXTAREA' || target?.tagName === 'INPUT') return;
        handleCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave, handleCancel, showDiscardModal, altSwapConfirm]);

  // v2.33.139: titleBar 拔 SaveStatus indicator — user feedback「右上角不用
  // 顯示狀態」。靜默 auto-save，只在失敗時 showToast (v2.33.137 已實作對齊
  // mockup `儲存失敗 → 重試 + toast error`)。idle/pending/saving/saved 狀態
  // 都不再顯示視覺干擾，user 信任 auto-save 默默完成。
  const main = (
    <div className="tp-app">
      <style>{SCOPED_STYLES}</style>
      <TitleBar
        title={tripName ? `編輯景點 · ${tripName}` : '編輯景點'}
        back={handleCancel}
        backLabel="返回行程"
      />
      <main className="tp-page-content">
        <div className="tp-edit-entry">
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-muted)' }}>
              載入中…
            </div>
          ) : loadError ? (
            <InlineError message={loadError} />
          ) : entry ? (
            <>
              {poiInfo && (
                <div className="tp-edit-entry-poi" data-testid="edit-entry-poi-summary">
                  <span className="tp-edit-entry-poi-icon">
                    <Icon name={POI_TYPE_ICON[poiInfo.poiType ?? 'attraction'] ?? 'location-pin'} />
                  </span>
                  <div className="tp-edit-entry-poi-meta">
                    <div className="tp-edit-entry-poi-name">{poiInfo.name}</div>
                    <div className="tp-edit-entry-poi-sub">
                      {POI_TYPE_LABELS[(poiInfo.poiType ?? 'attraction') as PoiType] ?? '景點'}
                    </div>
                    {/* v2.34.0 master per-POI 備註行（Variant B） */}
                    {masterSummary && (
                      <PerPoiNoteRow
                        key={masterSummary.poiId}
                        tripId={tripId!}
                        entryId={entryId}
                        poiId={masterSummary.poiId}
                        initialNote={masterSummary.note}
                        onSecondary
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    className="tp-edit-entry-poi-action"
                    aria-label="置換景點"
                    title="置換景點"
                    onClick={() => navigate(`/trip/${encodeURIComponent(tripId!)}/stop/${entryId}/change-poi`)}
                    data-testid="edit-entry-change-poi"
                  >
                    <Icon name="swap-horizontal" />
                  </button>
                </div>
              )}

              {/* v2.27.0 Alternates section — consistent for 0-N alternates. */}
              {masterSummary && (
                <section className="tp-edit-entry-alternates" data-testid="edit-entry-alternates">
                  <div className="tp-edit-entry-alternates-h">
                    <div className="h-left">
                      <span className="label">備選</span>
                      <span className="tp-edit-entry-alt-chip">
                        <span className="tp-edit-entry-alt-chip-dot" />
                        {alternates.length} 個
                      </span>
                    </div>
                  </div>
                  {altError && (
                    <div className="tp-edit-entry-alt-error" role="alert">{altError}</div>
                  )}
                  {alternates.length === 0 ? (
                    <div className="tp-edit-entry-alt-empty" data-testid="edit-entry-alt-empty">
                      還沒有備選景點。可從搜尋或收藏加入，之後再設為正選。
                    </div>
                  ) : (
                    alternates.map((alt, idx) => (
                      <div
                        key={alt.poiId}
                        className={`tp-edit-entry-alt-row${altPending === alt.poiId ? ' is-pending' : ''}`}
                        data-testid={`edit-entry-alt-row-${alt.poiId}`}
                      >
                        <span className="tp-edit-entry-alt-order">{idx + 2}</span>
                        <div className="tp-edit-entry-alt-meta">
                          <div className="tp-edit-entry-alt-name">{alt.name}</div>
                          {alt.type && (
                            <div className="tp-edit-entry-alt-category">
                              {POI_TYPE_LABELS[alt.type as PoiType] ?? alt.type}
                              {alt.rating != null && (
                                <span className="tp-edit-entry-alt-rating">
                                  <Icon name="star" /> {alt.rating.toFixed(1)}
                                </span>
                              )}
                            </div>
                          )}
                          {/* v2.28.0 — restaurant inline info: price · hours · reservation */}
                          {(alt.price || alt.hours || alt.reservation) && (
                            <div className="tp-edit-entry-alt-extra" data-testid={`edit-entry-alt-extra-${alt.poiId}`}>
                              {alt.price && <span className="alt-extra-chip price">{alt.price}</span>}
                              {alt.hours && <span className="alt-extra-chip hours">{alt.hours}</span>}
                              {alt.reservation && (() => {
                                // v2.33.46 round 7a security audit: 套 escUrl 防 javascript:/data: URI XSS
                                // (co-editor 可寫 trip_pois.reservation_url) + 加 noopener 防 tabnabbing。
                                const safeUrl = alt.reservationUrl ? escUrl(alt.reservationUrl) : '';
                                return safeUrl ? (
                                  <a
                                    href={safeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="alt-extra-chip reservation is-link"
                                  >
                                    {alt.reservation}
                                  </a>
                                ) : (
                                  <span className="alt-extra-chip reservation">{alt.reservation}</span>
                                );
                              })()}
                            </div>
                          )}
                          {/* v2.34.0 alternate per-POI 備註行（Variant B） */}
                          <PerPoiNoteRow
                            key={alt.poiId}
                            tripId={tripId!}
                            entryId={entryId}
                            poiId={alt.poiId}
                            initialNote={alt.note}
                          />
                        </div>
                        <div className="tp-edit-entry-alt-actions">
                          <button
                            type="button"
                            aria-label={`上移 ${alt.name}`}
                            disabled={idx === 0 || altPending != null}
                            onClick={() => void handleReorderAlternate(alt.poiId, 'up')}
                            data-testid={`edit-entry-alt-up-${alt.poiId}`}
                          ><Icon name="chevron-up" /></button>
                          <button
                            type="button"
                            aria-label={`下移 ${alt.name}`}
                            disabled={idx === alternates.length - 1 || altPending != null}
                            onClick={() => void handleReorderAlternate(alt.poiId, 'down')}
                            data-testid={`edit-entry-alt-down-${alt.poiId}`}
                          ><Icon name="chevron-down" /></button>
                          <button
                            type="button"
                            className="set-master"
                            disabled={altPending != null}
                            onClick={() => setAltSwapConfirm(alt)}
                            data-testid={`edit-entry-alt-setmaster-${alt.poiId}`}
                          >
                            設為正選
                          </button>
                          <button
                            type="button"
                            className="alt-delete"
                            aria-label={`刪除 ${alt.name}`}
                            disabled={altPending != null}
                            onClick={() => handleRemoveAlternate(alt)}
                            data-testid={`edit-entry-alt-delete-${alt.poiId}`}
                          ><Icon name="x-mark" /></button>
                        </div>
                      </div>
                    ))
                  )}
                  <div className="tp-edit-entry-alt-add-row">
                    <button
                      type="button"
                      className="tp-edit-entry-alt-add-btn"
                      onClick={() => navigate(`/trip/${encodeURIComponent(tripId!)}/stop/${entryId}/change-poi?mode=alternate&tab=search`)}
                      data-testid="edit-entry-alt-add-search"
                    >
                      <Icon name="search" />
                      搜尋加入備選
                    </button>
                    <button
                      type="button"
                      className="tp-edit-entry-alt-add-btn"
                      onClick={() => navigate(`/trip/${encodeURIComponent(tripId!)}/stop/${entryId}/change-poi?mode=alternate&tab=favorites`)}
                      data-testid="edit-entry-alt-add-favorites"
                    >
                      <Icon name="heart" />
                      收藏加入備選
                    </button>
                  </div>
                </section>
              )}

              {/* Time section */}
              <section className="tp-edit-entry-section" data-testid="edit-entry-time-section">
                <h2 className="tp-edit-entry-section-h">
                  <Icon name="clock" />
                  <span>時間</span>
                </h2>
                <div className="tp-edit-entry-time-row">
                  <div className="tp-edit-entry-time-card">
                    <span>抵達</span>
                    <div data-testid="edit-entry-start-time">
                      <TripTimePicker
                        value={startTime}
                        onChange={setStartTime}
                        ariaLabel="抵達時間"
                      />
                    </div>
                  </div>
                  <span className="tp-edit-entry-time-arrow" aria-hidden="true">
                    <Icon name="arrow-right" />
                  </span>
                  <div className="tp-edit-entry-time-card">
                    <span>離開</span>
                    <div data-testid="edit-entry-end-time">
                      <TripTimePicker
                        value={endTime}
                        onChange={setEndTime}
                        ariaLabel="離開時間"
                      />
                    </div>
                  </div>
                </div>
                {stayMinutes != null && (
                  <div className="tp-edit-entry-duration" data-testid="edit-entry-duration">
                    <Icon name="clock" />
                    停留 {stayMinutes} 分鐘
                  </div>
                )}
              </section>

              {/* Mode section — 只有當有 prev entry + 有 segment 才顯示 */}
              {prevEntry && (
                <section className="tp-edit-entry-section" data-testid="edit-entry-mode-section">
                  <h2 className="tp-edit-entry-section-h">
                    <Icon name="car" />
                    <span>從「{prevEntry.title}」移動</span>
                  </h2>
                  {segment ? (
                    <>
                      <div className="tp-edit-entry-mode-segmented" role="radiogroup" aria-label="移動方式">
                        {(['driving', 'walking', 'transit'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            role="radio"
                            aria-checked={mode === m}
                            className={`tp-edit-entry-mode-btn ${mode === m ? 'is-selected' : ''}`}
                            onClick={() => setMode(m)}
                            data-testid={`edit-entry-mode-${m}`}
                          >
                            <Icon name={TRAVEL_MODE_ICON[m]} />
                            <span className="tp-edit-entry-mode-lab">{TRAVEL_MODE_LABEL[m]}</span>
                          </button>
                        ))}
                      </div>
                      {mode !== 'transit' && (
                        <div className="tp-edit-entry-mode-detail">
                          <span>
                            {typeof segment.min === 'number' && segment.min > 0 ? (
                              <><strong>{segment.min} min</strong>{segment.distanceM ? ` · ${formatKm(segment.distanceM)}` : ''}</>
                            ) : (
                              '系統估算'
                            )}
                          </span>
                          <span style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-caption)' }}>
                            {segment.source === 'google' ? 'Google Routes 自動' : segment.source ?? '系統估算'}
                          </span>
                        </div>
                      )}
                      {mode === 'transit' && (
                        <div className="tp-edit-entry-transit">
                          <label htmlFor="edit-entry-transit-min">分鐘</label>
                          <input
                            id="edit-entry-transit-min"
                            className="tp-input-short"
                            type="number"
                            min="1"
                            max="1440"
                            value={transitMin}
                            onChange={(e) => setTransitMin(e.target.value)}
                            data-testid="edit-entry-transit-min"
                          />
                          <span className="tp-edit-entry-transit-unit">
                            min · Japan Google Routes 沒 transit 資料，請手動填
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-footnote)', margin: 0 }}>
                      尚未有移動段資料（recompute travel 後將出現）
                    </p>
                  )}
                </section>
              )}

              {/* v2.34.0: entry-level「備註」section 移除 — 改 per-POI 備註，
                  每個 master / alternate 各自掛一條 trip_entry_pois.note。
                  master 備註行在 POI 摘要卡內，alternate 備註行在各 alt row 內。 */}

              {/* validation 仍走 inline error（form-level，user 知道哪個欄位錯）。
                  save error v2.33.136 改 toast — 對齊 mockup
                  docs/design-sessions/2026-05-11-entry-time-segment-mode-edit.html */}
              {validation && (
                <div className="tp-edit-entry-error" data-testid="edit-entry-validation">
                  <InlineError message={validation} />
                </div>
              )}

              {/* v2.27.0 Danger zone — Delete entire stop */}
              {masterSummary && (
                <div className="tp-edit-entry-danger" data-testid="edit-entry-danger-zone">
                  <button
                    type="button"
                    className="tp-edit-entry-danger-btn"
                    onClick={() => setShowDeleteStopConfirm(true)}
                    data-testid="edit-entry-delete-stop"
                    disabled={submitting}
                  >
                    <Icon name="trash" /> 刪除整個停留點
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
      </main>

      {/* Discard confirm modal — shared <ConfirmModal> 取代 inline rolled-own */}
      <ConfirmModal
        open={showDiscardModal}
        title="丟棄變更？"
        message="未儲存的變更會遺失。"
        confirmLabel="丟棄變更"
        cancelLabel="繼續編輯"
        onConfirm={() => { setShowDiscardModal(false); goBack(); }}
        onCancel={() => setShowDiscardModal(false)}
      />

      {/* Master swap confirm (v2.27.0) with optional cross-region warning */}
      <ConfirmModal
        open={altSwapConfirm != null}
        title="設為正選"
        message={altSwapConfirm && masterSummary
          ? `將「${altSwapConfirm.name}」設為正選，原正選「${masterSummary.name}」會變備選，前後行程時間會重新計算。`
          : ''}
        warning={crossRegionWarning ?? undefined}
        confirmLabel="設為正選"
        cancelLabel="取消"
        busy={altPending != null}
        onConfirm={() => altSwapConfirm && void handleSetAsMaster(altSwapConfirm)}
        onCancel={() => setAltSwapConfirm(null)}
      />

      {/* v2.27.0 Remove alternate confirm */}
      <ConfirmModal
        open={altRemoveConfirm != null}
        title="移除備選"
        message={altRemoveConfirm ? `將從這個停留點移除備選「${altRemoveConfirm.name}」。景點本身不會被刪除，仍可從搜尋或收藏再次加入。` : ''}
        confirmLabel="移除備選"
        cancelLabel="取消"
        busy={altPending != null}
        onConfirm={() => altRemoveConfirm && void handleConfirmRemoveAlternate(altRemoveConfirm)}
        onCancel={() => setAltRemoveConfirm(null)}
      />

      {/* v2.27.0 Delete stop confirm */}
      <ConfirmModal
        open={showDeleteStopConfirm}
        title="刪除整個停留點？"
        message={masterSummary
          ? `將同時刪除：正選景點「${masterSummary.name}」${alternates.length > 0 ? ` + ${alternates.length} 個備選` : ''}。前後路線時間也會重算。此操作不可復原。`
          : ''}
        confirmLabel="刪除停留點"
        cancelLabel="取消"
        busy={submitting}
        onConfirm={() => void handleDeleteStop()}
        onCancel={() => setShowDeleteStopConfirm(false)}
      />
    </div>
  );

  return (
    <>
      <ToastContainer />
      <AppShell
        sidebar={<DesktopSidebarConnected />}
        main={main}
        bottomNav={<GlobalBottomNav authed={user !== null} />}
      />
    </>
  );
}
