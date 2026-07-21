/**
 * EditTripPage — 編輯既有 trip 的全頁 form (取代 EditTripModal)。
 *
 * Route: `/trip/:tripId/edit`
 * 對應 DESIGN.md「Trip Form Pages」規範 (2026-05-03)：
 *   AppShell + sticky TitleBar(返回 + 標題 + 儲存 action) + content-max-w 1040 +
 *   form-first single-column + bottom 64px sticky actions
 *
 * Layout:
 *   AppShell
 *     sidebar: DesktopSidebarConnected (行程 active)
 *     main:
 *       TitleBar(編輯行程)  ← back / 「儲存」 action button
 *       content: form (含目的地 sortable / read-only date / title hint /
 *                description / lang / travel mode / publish toggle)
 *     bottomNav: GlobalBottomNav (行程 active)
 *
 * 進入路徑:
 *   - TripsListPage card kebab「編輯行程」 → navigate(`/trip/${tripId}/edit`)
 *
 * 跟舊 EditTripModal 差別:
 *   - 拿掉 portal / backdrop / close X button / ESC handler
 *   - 從 props 收 tripId 改成 useParams
 *   - 從 props 收 onClose/onSaved 改成 useNavigate
 *   - 取消走 useNavigateBack(routes.tripsSelected(id)) explicit URL，儲存後 navigate(`/trips?selected=:id`)
 *   - Form 邏輯 + state machine 完全沿用 EditTripModal v2.19.0
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { useSheetBehavior } from '../hooks/useSheetBehavior';
import { routes } from '../lib/routes';
import { apiFetchRaw } from '../lib/apiClient';
import { EVENT } from '../lib/events';
import OperationShell from '../components/shell/OperationShell';
import InlineError from '../components/shared/InlineError';
import Icon from '../components/shared/Icon';
import ConfirmModal from '../components/shared/ConfirmModal';
import ToastContainer, { showToast } from '../components/shared/Toast';
import { TripDatePicker } from '../components/TripDatePicker';
import { TripSelect } from '../components/TripSelect';
import { TP_DRAG_ACCESSIBILITY } from '../lib/drag-announcements';
import { TRIP_FORM_STYLES } from '../components/trip/_tripFormStyles';
import { usePoiSearch } from '../hooks/usePoiSearch';
import type { PoiSearchResult } from '../types/poi';

interface DestinationRow {
  place_id: string;

  name: string;
  lat?: number | null;
  lng?: number | null;
  day_quota?: number | null;
  isNew?: boolean;
}

/** v2.33.0: GET /api/trips/:id/days?all=1 回傳的 day 含 timeline，用於算 entryCount。 */
interface DaySummaryRow {
  id: number;
  dayNum: number;
  date: string | null;
  dayOfWeek: string | null;
  label?: string | null;
  timeline?: Array<unknown>;
}

interface DaySummary {
  id: number;
  dayNum: number;
  date: string | null;
  dayOfWeek: string | null;
  entryCount: number;
  /** v2.33.3: 對齊 mockup 「N 個景點 · X km」總距離（rounded km），無 segment data 時 null。 */
  totalKm: number | null;
}

interface PendingDelete {
  dayNum: number;
  date: string | null;
  dayOfWeek: string | null;
  entryCount: number;
}

// v2.31.36: TravelMode removed — default_travel_mode column dropped (migration 0068)。
type Lang = 'zh-TW' | 'en' | 'ja';

interface TripDestApi {
  // v2.31.13: backend response 經 deepCamel 是 camelCase（destOrder/dayQuota/subAreas）。
  // trip_destinations 表沒 place_id 欄位 — 早期 snake_case 寫法是錯的，filter 用
  // typeof d.place_id === 'number' 永遠 false → destinations 全 filter 掉 → UI
  // 顯示「尚無目的地」(prod QA found)。改 camelCase + name-based valid check。
  destOrder?: number;
  name?: string;
  lat?: number | null;
  lng?: number | null;
  dayQuota?: number | null;
  subAreas?: unknown;
}

interface TripApi {
  id?: string;
  tripId?: string;
  title?: string | null;
  description?: string | null;
  countries?: string | null;
  published?: number | null;
  // v2.31.15: backend response 經 deepCamel → camelCase。
  // v2.31.36 (migration 0068): DROP defaultTravelMode + selfDrive* — dead columns。
  dataSource?: string | null;
  lang?: Lang | null;
  destinations?: TripDestApi[];
  startDate?: string;
  endDate?: string;
}

/**
 * SCOPED_STYLES 含：
 *   - .tp-edit-page-shell — page-level shell (背景 + scroll 行為)
 *   - .tp-edit-page-form — 1040px max-width form container
 *   - .tp-edit-page-actions — 取代 modal 時代的 sticky bottom bar
 *   - 其餘 form-row / dest-row / dest-dropdown / segment / btn 從
 *     `_tripFormStyles.ts` 共用 (.tp-edit-* prefix 仍 work — comma-selector 含)
 */
const SCOPED_STYLES = `
.tp-edit-page-shell {
  /* grid + minmax(0,1fr) column caps the implicit track at the container width
   * (same root-cause fix as TripNotesPage v2.34.50). Without it a wide child
   * (long destination name, etc.) can size the shell to its content width →
   * mobile horizontal scroll. minmax(0,...) forces children to the column width
   * instead of letting them blow it out — not an overflow:hidden mask. */
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-height: 100%;
  background: var(--color-secondary);
  height: 100%;
  overflow-y: auto;
}
/* owner 2026-07-21（第二輪回報 #5）：桌機第三欄面板要跟新遷入的共編/健檢/筆記
 * 3 頁一樣套 tertiary elevation（見 AppShell.tsx .app-shell-sheet 註解 + CollabPage
 * 同型 override）。手機整頁 drill-down 不受影響，仍是上面的 --color-secondary。 */
.app-shell-sheet .tp-edit-page-shell {
  background: var(--color-tertiary);
}
.tp-edit-page-form {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 120px;
  display: flex; flex-direction: column;
}
@media (min-width: 768px) {
  .tp-edit-page-form { padding: 32px 24px 120px; }
}

.tp-edit-page-sub {
  color: var(--color-muted);
  font-size: var(--font-size-callout);
  margin: 0 0 20px;
  line-height: 1.5;
}

/* Edit-page-specific destination row visuals (overlap with EditTripModal removed) */
.tp-edit-dest-row.is-new {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent);
}
.tp-edit-dest-badge {
  margin-left: 6px;
  color: var(--color-accent-deep);
  font-size: var(--font-size-caption);
  font-weight: 600;
}
.tp-edit-dest-quota {
  font-size: var(--font-size-caption);
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}

/* + 加入目的地 trigger */
.tp-edit-dest-add-wrap { position: relative; }
.tp-edit-dest-add-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px;
  border: 1.5px dashed var(--color-border);
  background: transparent;
  color: var(--color-foreground);
  border-radius: var(--radius-full);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  cursor: pointer;
  min-height: 36px;
}
.tp-edit-dest-add-btn:hover {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent);
  color: var(--color-accent-deep);
}
.tp-edit-dest-search-wrap { position: relative; margin-top: 8px; }
.tp-edit-dest-search-wrap input { width: 100%; }

/* read-only date chip */
.tp-edit-date-readonly {
  display: flex; flex-direction: column; gap: 4px;
  padding: 12px 14px;
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.tp-edit-date-readonly .tp-edit-date-line {
  display: flex; align-items: center; gap: 8px;
  font-size: var(--font-size-callout);
  font-weight: 600; color: var(--color-foreground);
}
.tp-edit-date-readonly .tp-edit-date-helper {
  margin: 0;
  font-size: var(--font-size-caption);
  color: var(--color-muted);
}

/* title-region-change hint alert */
.tp-edit-title-hint {
  margin-top: 6px;
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  background: var(--color-accent-subtle);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-md);
  font-size: var(--font-size-footnote);
}
.tp-edit-title-hint-text { flex: 1; color: var(--color-foreground); }
.tp-edit-title-hint-text strong { color: var(--color-accent-deep); }
.tp-edit-title-hint-btn {
  padding: 6px 12px;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--color-accent-fill);
  color: var(--color-accent-foreground);
  font: inherit; font-weight: 600; font-size: var(--font-size-caption);
  cursor: pointer;
  min-height: var(--spacing-tap-min);
}
.tp-edit-title-hint-dismiss {
  width: 28px; height: 28px;
  border: 0; background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  border-radius: 50%;
  display: grid; place-items: center;
}
.tp-edit-title-hint-dismiss:hover {
  background: var(--color-background);
  color: var(--color-foreground);
}

/* sticky bottom bar 已移到 css/tokens.css .tp-page-bottom-bar 共用 */
/* EditTripPage 額外加 flex-wrap (publish segment + cancel + save 多元素) */
.tp-page-bottom-bar { flex-wrap: wrap; }

.tp-edit-actions-publish {
  display: inline-flex;
  padding: 4px;
  border-radius: var(--radius-full);
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
}
.tp-edit-actions-publish button {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px;
  border: 0; background: transparent;
  border-radius: var(--radius-full);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-muted); cursor: pointer;
  min-height: 36px;
}
.tp-edit-actions-publish button .dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--color-line-strong);
}
.tp-edit-actions-publish button.is-active {
  background: var(--color-background);
  color: var(--color-foreground);
  box-shadow: var(--shadow-sm);
}
.tp-edit-actions-publish button.is-active.is-published .dot { background: var(--color-success, #2e8540); }
.tp-edit-actions-publish button.is-active.is-draft .dot { background: var(--color-line-strong); }

.tp-edit-actions-btns { display: inline-flex; gap: 8px; }

/* loading shimmer for initial fetch */
.tp-edit-loading {
  padding: 60px 24px;
  text-align: center;
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
}

/* v2.33.0: 行程天數 section (mockup: docs/design-sessions/2026-05-20-edit-trip-days-management) */
.tp-edit-days-list {
  display: flex; flex-direction: column; gap: 8px;
  margin: 8px 0;
}
.tp-edit-day-row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.tp-edit-day-num {
  width: 32px; height: 32px;
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  border-radius: var(--radius-full);
  display: grid; place-items: center;
  font-size: var(--font-size-caption);
  font-weight: 700;
  flex-shrink: 0;
}
.tp-edit-day-content { flex: 1; min-width: 0; }
.tp-edit-day-date {
  font-size: var(--font-size-callout);
  font-weight: 600;
  color: var(--color-foreground);
}
.tp-edit-day-meta {
  font-size: var(--font-size-caption);
  color: var(--color-muted);
  margin-top: 2px;
}
.tp-edit-day-meta.has-entries {
  color: var(--color-accent-deep);
  font-weight: 600;
}
.tp-edit-day-meta.is-empty {
  font-style: italic;
}
.tp-edit-day-remove {
  width: 36px; height: 36px;
  display: grid; place-items: center;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-muted);
  cursor: pointer;
  border-radius: var(--radius-full);
  font-size: var(--font-size-headline);
  flex-shrink: 0;
  transition: all 120ms;
}
.tp-edit-day-remove:hover:not(:disabled) {
  /* v2.33.14: 改 accent (terracotta) 不用 destructive red — user 不要紅色
     (real destructive moment 是 confirm dialog，那邊保留紅色) */
  border-color: var(--color-accent);
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
}
.tp-edit-day-remove:disabled { opacity: 0.4; cursor: not-allowed; }
.tp-edit-day-remove.has-entries-warning {
  /* v2.33.14: has-entries warning 用 accent-deep (terracotta) 取代 destructive
     red — user 回報「不要紅色，要和手機一樣」。Mobile retina 上 destructive
     #C13515 看起來偏 terracotta，desktop 大畫面看起來偏 vivid red。改 accent
     一致對齊 Tripline 暖橘色系，無 cross-device 色差。 */
  border-color: var(--color-accent-deep);
  color: var(--color-accent-deep);
}
.tp-edit-day-remove.has-entries-warning:hover:not(:disabled) {
  background: var(--color-accent-deep);
  border-color: var(--color-accent-deep);
  color: var(--color-accent-foreground);
}

/* 加一天 card button — 同 day row 大小 + accent 底色 (per user 2026-05-20 sign-off) */
.tp-edit-day-add-card {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%;
  padding: 14px 14px;
  min-height: 56px;
  border: 1px dashed var(--color-accent);
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  border-radius: var(--radius-md);
  font: inherit;
  font-size: var(--font-size-callout);
  font-weight: 700;
  cursor: pointer;
  transition: background 120ms, border-color 120ms, transform 80ms;
}
.tp-edit-day-add-card:hover:not(:disabled) {
  background: var(--color-accent-bg);
  border-style: solid;
}
.tp-edit-day-add-card:active:not(:disabled) { transform: scale(0.98); }
.tp-edit-day-add-card:disabled { opacity: 0.5; cursor: not-allowed; }
.tp-edit-day-add-card .plus {
  display: inline-grid; place-items: center;
  width: 24px; height: 24px;
  background: var(--color-accent-fill);
  color: var(--color-accent-foreground);
  border-radius: var(--radius-full);
  font-weight: 700;
  flex-shrink: 0;
}
.tp-edit-day-add-card .plus .svg-icon { width: 14px; height: 14px; }

/* v2.33.7: gap placeholder — 中間刪 day 留 dashed 框，user 點即可加回 */
.tp-edit-day-gap {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%;
  padding: 14px 14px;
  min-height: 56px;
  border: 1px dashed var(--color-line-strong);
  background: var(--color-tertiary);
  color: var(--color-muted);
  border-radius: var(--radius-md);
  font: inherit;
  font-size: var(--font-size-callout);
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms, border-color 120ms, color 120ms, transform 80ms;
}
.tp-edit-day-gap:hover:not(:disabled) {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent);
  color: var(--color-accent-deep);
}
.tp-edit-day-gap:active:not(:disabled) { transform: scale(0.98); }
.tp-edit-day-gap:disabled { opacity: 0.5; cursor: not-allowed; }
.tp-edit-day-gap .plus {
  display: inline-grid; place-items: center;
  width: 22px; height: 22px;
  background: var(--color-line-strong);
  color: var(--color-background);
  border-radius: var(--radius-full);
  flex-shrink: 0;
}
.tp-edit-day-gap:hover:not(:disabled) .plus {
  background: var(--color-accent-fill);
  color: var(--color-accent-foreground);
}
.tp-edit-day-gap .plus .svg-icon { width: 12px; height: 12px; }

/* v2.33.8: 整體平移行程 button + modal */
.tp-edit-day-shift-btn {
  display: flex; align-items: center; gap: 8px;
  width: 100%;
  padding: 12px 14px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-foreground);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-callout);
  margin-bottom: 8px;
  text-align: left;
  transition: background 120ms, border-color 120ms;
}
.tp-edit-day-shift-btn:hover:not(:disabled) {
  background: var(--color-hover);
  border-color: var(--color-accent);
}
.tp-edit-day-shift-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.tp-edit-day-shift-label {
  flex: 1; min-width: 0;
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
}
.tp-edit-day-shift-label strong {
  color: var(--color-foreground);
  font-weight: 700;
  font-size: var(--font-size-callout);
}
.tp-edit-day-shift-chev {
  color: var(--color-muted);
  font-size: var(--font-size-headline);
  font-weight: 600;
  flex-shrink: 0;
}

/* v2.33.9 fix: 之前 reuse .tp-confirm-backdrop 但該 class scoped 在
   ConfirmModal SCOPED_STYLES（只在 ConfirmModal 開時注入）。Shift modal
   單獨開時 backdrop 沒 position:fixed → 跌出 viewport。改用 local class。 */
.tp-shift-backdrop {
  position: fixed; inset: 0;
  z-index: 1100;
  background: rgba(20, 14, 9, 0.42);
  display: grid; place-items: center;
  padding: 20px;
  animation: tp-shift-backdrop-in 150ms ease;
}
@keyframes tp-shift-backdrop-in { from { opacity: 0; } to { opacity: 1; } }

.tp-shift-modal {
  width: min(380px, 100%);
  border-radius: var(--radius-xl);
  background: var(--color-background);
  padding: 20px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border);
  animation: tp-shift-modal-in 200ms ease;
}
@keyframes tp-shift-modal-in {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.tp-shift-modal-title {
  margin: 0 0 14px;
  font-size: var(--font-size-title3);
  font-weight: 700;
}
.tp-shift-modal-label {
  display: block;
  font-size: var(--font-size-caption);
  font-weight: 600;
  color: var(--color-foreground);
  margin-bottom: 6px;
}
/* v2.33.22 cleanup: .tp-shift-modal-input 規則移除 — v2.33.17 shift modal
   已切到 TripDatePicker（react-day-picker 自帶 trigger button）。 */
.tp-shift-modal-preview {
  margin: 14px 0 16px;
  padding: 10px 12px;
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  border-radius: var(--radius-md);
  font-size: var(--font-size-footnote);
  line-height: 1.5;
}
/* v2.33.15: 改用 local class — 之前 reuse .tp-confirm-btn / .tp-confirm-btn-cancel
   是 ConfirmModal SCOPED_STYLES 內部 class，shift modal 單獨開時樣式沒注入
   → cancel button fallback browser native (黑底白字)。同 v2.33.9 backdrop 修法。 */
.tp-shift-modal-actions {
  display: flex; gap: 8px;
}
.tp-shift-modal-btn {
  flex: 1; min-width: 112px;
  min-height: var(--spacing-tap-min);
  border-radius: var(--radius-full);
  font: inherit;
  font-weight: 700;
  font-size: var(--font-size-footnote);
  cursor: pointer;
  border: 1px solid;
  transition: background 120ms, border-color 120ms, filter 120ms;
}
.tp-shift-modal-cancel {
  background: var(--color-secondary);
  color: var(--color-foreground);
  border-color: var(--color-border);
}
.tp-shift-modal-cancel:hover:not(:disabled) {
  background: var(--color-tertiary);
  border-color: var(--color-line-strong);
}
.tp-shift-modal-cancel:focus-visible {
  outline: 2px solid var(--color-foreground);
  outline-offset: 2px;
}
.tp-shift-modal-cancel:disabled { opacity: 0.5; cursor: not-allowed; }

.tp-shift-modal-confirm {
  background: var(--color-accent-fill);
  color: var(--color-accent-foreground);
  border-color: var(--color-accent-fill);
}
.tp-shift-modal-confirm:hover:not(:disabled) {
  background: var(--color-accent-deep);
  border-color: var(--color-accent-deep);
}
.tp-shift-modal-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
`;

interface SortableDestinationRowProps {
  dest: DestinationRow;
  index: number;
  onRemove: (placeId: string) => void;
}

function SortableDestRow({ dest, index, onRemove }: SortableDestinationRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dest.place_id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`tp-edit-dest-row ${isDragging ? 'is-dragging' : ''} ${dest.isNew ? 'is-new' : ''}`}
      data-testid={`edit-trip-dest-row-${dest.place_id}`}
    >
      <button
        type="button"
        className="tp-edit-dest-grip"
        aria-label={`拖移目的地：${dest.name}`}
        {...attributes}
        {...listeners}
      >
        <Icon name="arrows-vertical" />
      </button>
      <span className="tp-edit-dest-num" aria-hidden="true">{index + 1}</span>
      <span className="tp-edit-dest-name">
        {dest.name}
        {dest.isNew && <span className="tp-edit-dest-badge">新增</span>}
      </span>
      <span className="tp-edit-dest-quota">
        {dest.day_quota != null && dest.day_quota > 0 ? `${dest.day_quota} 天` : ''}
      </span>
      <button
        type="button"
        className="tp-edit-dest-remove"
        onClick={() => onRemove(dest.place_id)}
        aria-label={`移除目的地：${dest.name}`}
      >
        <Icon name="x-mark" />
      </button>
    </div>
  );
}

/** v2.33.7: 算兩個 ISO date 之間相差幾天（正整數，可能為 0）。 */
function daysBetween(d1: string, d2: string): number {
  const t1 = new Date(d1 + 'T00:00:00Z').getTime();
  const t2 = new Date(d2 + 'T00:00:00Z').getTime();
  return Math.round((t2 - t1) / 86_400_000);
}

/** v2.33.7: 從 YYYY-MM-DD 偏移 N 天，回 YYYY-MM-DD。 */
function shiftDateByDays(yyyyMmDd: string, delta: number): string {
  const t = new Date(yyyyMmDd + 'T00:00:00Z').getTime();
  return new Date(t + delta * 86_400_000).toISOString().slice(0, 10);
}

/** v2.33.7: chinese weekday 從 ISO date 算出。 */
function chineseDayOfWeek(yyyyMmDd: string): string {
  const idx = new Date(yyyyMmDd + 'T00:00:00Z').getUTCDay();
  return ['日', '一', '二', '三', '四', '五', '六'][idx]!;
}

/** v2.33.7: 從 timeline sum travel.distanceM → rounded km (對齊 DaySection 邏輯) */
function computeTotalKm(timeline: unknown): number | null {
  if (!Array.isArray(timeline)) return null;
  let totalM = 0;
  let hasAny = false;
  for (const e of timeline) {
    if (typeof e !== 'object' || e === null) continue;
    const travel = (e as { travel?: { distanceM?: number | null } }).travel;
    const d = travel?.distanceM;
    if (typeof d === 'number' && Number.isFinite(d)) {
      totalM += d;
      hasAny = true;
    }
  }
  if (!hasAny) return null;
  return Math.round(totalM / 1000);
}

/** v2.33.2: ISO date `2026-05-01` → `5/1` short form 對齊 mockup 視覺。 */
function formatShortDate(yyyyMmDd: string | null | undefined): string {
  if (!yyyyMmDd) return '';
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(yyyyMmDd);
  if (!m) return yyyyMmDd;
  return `${Number(m[1])}/${Number(m[2])}`;
}

function deriveAutoTitle(destinations: DestinationRow[], startDate?: string): string {
  if (destinations.length === 0) return '';
  const year = startDate ? startDate.slice(0, 4) : new Date().getFullYear().toString();
  if (destinations.length === 1) return `${year} ${destinations[0]!.name}`;
  if (destinations.length === 2) return `${year} ${destinations[0]!.name}・${destinations[1]!.name}`;
  return `${year} ${destinations[0]!.name}等 ${destinations.length} 地`;
}

function destNamesEqual(a: DestinationRow[], b: DestinationRow[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]!.name !== b[i]!.name) return false;
  }
  return true;
}

export default function EditTripPage() {
  const auth = useRequireAuth();
  const { tripId } = useParams<{ tripId: string }>();
  const handleBack = useNavigateBack(tripId ? routes.tripsSelected(tripId) : routes.trips());

  const [loading, setLoading] = useState(true);
  const [original, setOriginal] = useState<TripApi | null>(null);
  const [originalDests, setOriginalDests] = useState<DestinationRow[]>([]);

  // editable state
  const [destinations, setDestinations] = useState<DestinationRow[]>([]);
  const [title, setTitle] = useState('');
  // v2.33.93 simplify: merged titleEdited + titleHintDismissed → titleHintHidden.
  // 之前兩個 flag 唯一 consumer 是 line 944 OR；分立沒意義。
  const [titleHintHidden, setTitleHintHidden] = useState(false);
  const [description, setDescription] = useState('');
  const [lang, setLang] = useState<Lang>('zh-TW');
  const [published, setPublished] = useState(0);
  // v2.31.36 (migration 0068): travelMode + selfDrive* state removed — dead columns dropped。

  // POI search inline state
  const [showSearch, setShowSearch] = useState(false);
  const [destQuery, setDestQuery] = useState('');
  const [poiSearchError, setPoiSearchError] = useState<string | null>(null);
  const { results: poiResults, searching: poiSearching } = usePoiSearch({
    enabled: showSearch,
    query: destQuery,
    limit: 10,
    normalise: (raw) => {
      const arr = (raw as { results?: PoiSearchResult[] })?.results ?? [];
      return Array.isArray(arr) ? arr : [];
    },
    onError: (kind) => setPoiSearchError(kind === 'http-error' ? '搜尋失敗，請稍後再試' : '網路連線失敗'),
  });

  useEffect(() => {
    if (destQuery.trim().length < 2) setPoiSearchError(null);
  }, [destQuery]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // v2.33.0: days management — immediate-mutation pattern (cascade delete 不可
  // 復原，atomic 比 queue-and-commit 安全)。「儲存變更」只管 scalar fields。
  const [days, setDays] = useState<DaySummary[] | null>(null);
  const [daysMutating, setDaysMutating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const refetchDays = useCallback(async () => {
    if (!tripId) return;
    try {
      const res = await apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/days?all=1`);
      if (!res.ok) throw new Error(`days fetch failed: ${res.status}`);
      const data = (await res.json()) as DaySummaryRow[];
      setDays(
        data.map((d) => ({
          id: d.id,
          dayNum: d.dayNum,
          date: d.date ?? null,
          dayOfWeek: d.dayOfWeek ?? null,
          entryCount: Array.isArray(d.timeline) ? d.timeline.length : 0,
          totalKm: computeTotalKm(d.timeline),
        })),
      );
    } catch (err) {
      // 非阻擋：days fetch fail 只影響 days section，scalar form 仍可用
      console.error('refetchDays failed', err);
    }
  }, [tripId]);

  // GET trip on mount / tripId change
  useEffect(() => {
    if (!auth.user || !tripId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetchRaw(`/trips/${encodeURIComponent(tripId)}`);
        if (!res.ok) throw new Error(`load failed: ${res.status}`);
        const data = (await res.json()) as TripApi;
        if (cancelled) return;
        setOriginal(data);
        // v2.31.13: backend trip_destinations 表沒 place_id 欄位（client-side 用
        // React key 而已，沒 backend persist）。既有 dest 用 synthetic key，name
        // 是 schema 必填 → 拿來做 valid check。
        const initialDests: DestinationRow[] = (data.destinations ?? [])
          .filter((d): d is TripDestApi & { name: string } =>
            typeof d.name === 'string' && d.name.trim().length > 0)
          .map((d, idx) => ({
            place_id: `existing-${d.destOrder ?? idx}-${d.name}`,
            name: d.name,
            lat: d.lat ?? null,
            lng: d.lng ?? null,
            day_quota: d.dayQuota ?? null,
          }));
        setOriginalDests(initialDests);
        setDestinations(initialDests);
        setTitle(data.title ?? '');
        setTitleHintHidden(false);
        setDescription(data.description ?? '');
        setLang((data.lang as Lang) ?? 'zh-TW');
        setPublished(data.published ?? 0);
        // v2.31.36 (migration 0068): defaultTravelMode + selfDrive* load removed — dead columns。
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '載入行程失敗');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [auth.user, tripId]);

  // v2.33.0: days fetch — parallel with trip fetch; refetch on each mutation
  useEffect(() => {
    if (!auth.user || !tripId) return;
    void refetchDays();
  }, [auth.user, tripId, refetchDays]);

  const handleAddDay = useCallback(async (position: 'start' | 'end') => {
    if (!tripId || daysMutating) return;
    setDaysMutating(true);
    try {
      const res = await apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/days`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position }),
      });
      if (!res.ok) {
        const text = await res.text();
        let message = '新增天數失敗，請稍後再試。';
        try {
          const data = JSON.parse(text) as { error?: { message?: string } };
          if (data?.error?.message) message = data.error.message;
        } catch { /* not JSON */ }
        throw new Error(message);
      }
      await refetchDays();
      window.dispatchEvent(new CustomEvent(EVENT.tripUpdated, { detail: { tripId } }));
      showToast(position === 'start' ? '已在最前加入一天' : '已在最後加入一天', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '新增天數失敗', 'error');
    } finally {
      setDaysMutating(false);
    }
  }, [tripId, daysMutating, refetchDays]);

  // v2.33.7: 加回中間天 gap（例如刪 Day 3 後 5/2、5/4，中間 5/3 用 dashed
  // placeholder 顯示，user 點即可加回）
  const handleRestoreDay = useCallback(async (date: string) => {
    if (!tripId || daysMutating) return;
    setDaysMutating(true);
    try {
      const res = await apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/days`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: 'insert', date }),
      });
      if (!res.ok) {
        const text = await res.text();
        let message = '加回天數失敗，請稍後再試。';
        try {
          const data = JSON.parse(text) as { error?: { message?: string } };
          if (data?.error?.message) message = data.error.message;
        } catch { /* not JSON */ }
        throw new Error(message);
      }
      await refetchDays();
      window.dispatchEvent(new CustomEvent(EVENT.tripUpdated, { detail: { tripId } }));
      showToast(`已加回 ${formatShortDate(date)}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '加回天數失敗', 'error');
    } finally {
      setDaysMutating(false);
    }
  }, [tripId, daysMutating, refetchDays]);

  const handleRequestDelete = useCallback((day: DaySummary) => {
    setPendingDelete({
      dayNum: day.dayNum,
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      entryCount: day.entryCount,
    });
  }, []);

  // v2.33.8: 整體平移行程 — POST /days/shift
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [shiftNewDate, setShiftNewDate] = useState<string>('');

  const handleOpenShift = useCallback(() => {
    if (!days || days.length === 0 || !days[0]?.date) return;
    setShiftNewDate(days[0].date);
    setShiftModalOpen(true);
  }, [days]);

  const handleConfirmShift = useCallback(async () => {
    if (!tripId || daysMutating || !shiftNewDate) return;
    setDaysMutating(true);
    try {
      const res = await apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/days/shift`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: shiftNewDate }),
      });
      if (!res.ok) {
        const text = await res.text();
        let message = '平移失敗，請稍後再試。';
        try {
          const data = JSON.parse(text) as { error?: { message?: string } };
          if (data?.error?.message) message = data.error.message;
        } catch { /* not JSON */ }
        throw new Error(message);
      }
      await refetchDays();
      window.dispatchEvent(new CustomEvent(EVENT.tripUpdated, { detail: { tripId } }));
      showToast(`出發日期已變更為 ${formatShortDate(shiftNewDate)}`, 'success');
      setShiftModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '平移失敗', 'error');
    } finally {
      setDaysMutating(false);
    }
  }, [tripId, daysMutating, shiftNewDate, refetchDays]);

  // 平移日期 modal 收斂到統一引擎：body scroll-lock + Escape（變更中鎖）+ focus-trap。
  const {
    panelRef: shiftPanelRef,
    backdropRef: shiftBackdropRef,
    handlePanelKeyDown: shiftPanelKeyDown,
  } = useSheetBehavior(shiftModalOpen, () => setShiftModalOpen(false), {
    canDismiss: !daysMutating,
  });

  const handleConfirmDelete = useCallback(async () => {
    if (!tripId || !pendingDelete || daysMutating) return;
    const dayNum = pendingDelete.dayNum;
    setDaysMutating(true);
    try {
      const res = await apiFetchRaw(
        `/trips/${encodeURIComponent(tripId)}/days/${dayNum}`,
        { method: 'DELETE', credentials: 'same-origin' },
      );
      if (!res.ok) {
        const text = await res.text();
        let message = '刪除天數失敗，請稍後再試。';
        try {
          const data = JSON.parse(text) as { error?: { message?: string } };
          if (data?.error?.message) message = data.error.message;
        } catch { /* not JSON */ }
        throw new Error(message);
      }
      const result = (await res.json()) as { removedEntryCount?: number };
      const removed = result.removedEntryCount ?? 0;
      await refetchDays();
      window.dispatchEvent(new CustomEvent(EVENT.tripUpdated, { detail: { tripId } }));
      showToast(
        removed > 0 ? `Day ${dayNum} 已刪除（連同 ${removed} 個景點）` : `Day ${dayNum} 已刪除`,
        'success',
      );
      setPendingDelete(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '刪除天數失敗', 'error');
    } finally {
      setDaysMutating(false);
    }
  }, [tripId, pendingDelete, daysMutating, refetchDays]);

  // Region change hint logic — only show if (a) destinations names changed
  // vs original AND (b) user hasn't manually edited title since open AND (c)
  // hint not dismissed.
  const showTitleHint = useMemo(() => {
    if (loading || !original) return false;
    if (titleHintHidden) return false;
    return !destNamesEqual(destinations, originalDests);
  }, [loading, original, titleHintHidden, destinations, originalDests]);

  const suggestedTitle = useMemo(
    () => deriveAutoTitle(destinations, original?.startDate),
    [destinations, original?.startDate],
  );

  function selectPoi(poi: PoiSearchResult) {
    if (destinations.some((d) => d.place_id === poi.place_id)) {
      setShowSearch(false); setDestQuery('');
      return;
    }
    setDestinations((prev) => [
      ...prev,
      {
        place_id: poi.place_id,

        name: poi.name,
        lat: poi.lat,
        lng: poi.lng,
        day_quota: null,
        isNew: !originalDests.some((d) => d.place_id === poi.place_id),
      },
    ]);
    setShowSearch(false);
    setDestQuery('');
  }

  function removeDest(placeId: string) {
    setDestinations((prev) => prev.filter((d) => d.place_id !== placeId));
  }

  function handleDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const fromIdx = destinations.findIndex((d) => d.place_id === e.active.id);
    const toIdx = destinations.findIndex((d) => d.place_id === e.over!.id);
    if (fromIdx < 0 || toIdx < 0) return;
    setDestinations((prev) => arrayMove(prev, fromIdx, toIdx));
  }

  function applyTitleSuggestion() {
    setTitle(suggestedTitle);
    setTitleHintHidden(true);
  }

  function dismissTitleHint() {
    setTitleHintHidden(true);
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !original || !tripId) return;
    setSubmitting(true);
    setError(null);

    // Build PATCH body — only include fields that changed.
    const body: Record<string, unknown> = {};
    if (title !== (original.title ?? '')) body.title = title || null;
    if (description !== (original.description ?? '')) body.description = description || null;
    if (lang !== ((original.lang as Lang) ?? 'zh-TW')) body.lang = lang;
    if (published !== (original.published ?? 0)) body.published = published;
    // v2.31.36 (migration 0068): default_travel_mode + 5 self_drive_* write removed — dead columns。

    const destsChanged = !destNamesEqual(destinations, originalDests)
      || destinations.some((d, i) => {
        const o = originalDests[i];
        return !o || o.place_id !== d.place_id || (o.day_quota ?? null) !== (d.day_quota ?? null);
      });
    if (destsChanged) {
      body.destinations = destinations.map((d) => ({
        name: d.name,
        lat: d.lat ?? null,
        lng: d.lng ?? null,
        place_id: d.place_id,

        day_quota: d.day_quota ?? null,
      }));
    }

    if (Object.keys(body).length === 0) {
      // No changes — just go back.
      setSubmitting(false);
      handleBack();
      return;
    }

    try {
      const res = await apiFetchRaw(`/trips/${encodeURIComponent(tripId)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        let message = '儲存變更失敗，請稍後再試。';
        try {
          const data = JSON.parse(text) as { error?: { code?: string; message?: string } };
          if (data?.error?.message) message = data.error.message;
        } catch { /* not JSON */ }
        throw new Error(message);
      }
      // v2.33.108: auto-save 後不再 navigate（user 仍在 edit page）。
      // 廣播更新事件給 listening pages (ActiveTrip / TripsList) + reset original
      // 讓 dirty 重置，避免下次 effect 又觸發。
      window.dispatchEvent(new CustomEvent(EVENT.tripUpdated, { detail: { tripId } }));
      setOriginal({
        ...(original ?? {}),
        title, description, lang, published,
      } as typeof original);
      setOriginalDests(destinations.map((d) => ({ ...d })));
      setSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存變更失敗');
      setSubmitting(false);
    }
  }

  // v2.33.108: 移除「儲存」TitleBar button → SaveStatus 顯示 auto-save 狀態。
  // dirty 從 destsChanged + field 比較推導。
  // 注意：hooks 必須在 early return 之前 — rules of hooks。
  const isDirty = useMemo(() => {
    if (!original) return false;
    if (title !== (original.title ?? '')) return true;
    if (description !== (original.description ?? '')) return true;
    if (lang !== ((original.lang as Lang) ?? 'zh-TW')) return true;
    if (published !== (original.published ?? 0)) return true;
    if (!destNamesEqual(destinations, originalDests)) return true;
    if (destinations.some((d, i) => {
      const o = originalDests[i];
      return !o || o.place_id !== d.place_id || (o.day_quota ?? null) !== (d.day_quota ?? null);
    })) return true;
    return false;
  }, [original, originalDests, title, description, lang, published, destinations]);

  // v2.33.108: debounce auto-save effect — 800ms 後 fire handleSubmit。
  useEffect(() => {
    if (!isDirty || submitting) return;
    const timer = setTimeout(() => {
      formRef.current?.requestSubmit();
    }, 800);
    return () => clearTimeout(timer);
  }, [isDirty, submitting, title, description, lang, published, destinations]);

  if (!auth.user) return null;

  if (!tripId) {
    return (
      <OperationShell
        shellClassName="tp-edit-page-shell"
        testId="edit-trip-page"
        title="編輯行程"
        back={handleBack}
      >
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-muted)' }}>
          無效的行程 ID
        </div>
      </OperationShell>
    );
  }

  // v2.33.0: dateRange const removed — 改由 days section header 顯示日期區間。

  // v2.33.139: titleBar 拔 SaveStatus indicator（同 EditEntryPage）— user
  // feedback「右上角不用顯示狀態」。靜默 auto-save，error 走 toast。
  return (
    <>
      <ToastContainer />
      <OperationShell
        shellClassName="tp-edit-page-shell"
        testId="edit-trip-page"
        title="編輯行程"
        back={handleBack}
      >
            <style>{TRIP_FORM_STYLES}</style>
            <style>{SCOPED_STYLES}</style>
            <form id="edit-trip-form" ref={formRef} onSubmit={handleSubmit} className="tp-edit-page-form">
              <p className="tp-edit-page-sub">修改目的地 + 行程天數。</p>

              {loading ? (
                <div className="tp-edit-loading" data-testid="edit-trip-loading">載入中⋯</div>
              ) : (
                <>
                  {/* Title (with region change hint) — 2026-07-07 user 要求移到最上
                    * （原在天數 section 後）。mockup v2/v3 已同步。 */}
                  <div className="tp-edit-row">
                    <label htmlFor="edit-trip-title-input">行程名稱（選填）</label>
                    <input
                      id="edit-trip-title-input"
                      type="text"
                      value={title}
                      onChange={(e) => { setTitle(e.target.value); setTitleHintHidden(true); }}
                      placeholder={suggestedTitle || '由「年份+目的地」自動命名'}
                      data-testid="edit-trip-title-input"
                    />
                    {showTitleHint && suggestedTitle && (
                      <div className="tp-edit-title-hint" role="alert" data-testid="edit-trip-title-hint">
                        <span className="tp-edit-title-hint-text">
                          目的地已變更，要更新名稱為「<strong>{suggestedTitle}</strong>」？
                        </span>
                        <button
                          type="button"
                          className="tp-edit-title-hint-btn"
                          onClick={applyTitleSuggestion}
                          data-testid="edit-trip-title-hint-apply"
                        >
                          套用
                        </button>
                        <button
                          type="button"
                          className="tp-edit-title-hint-dismiss"
                          onClick={dismissTitleHint}
                          aria-label="忽略提示"
                          data-testid="edit-trip-title-hint-dismiss"
                        >
                          <Icon name="x-mark" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Destinations */}
                  <div className="tp-edit-row">
                    <label>目的地</label>
                    {destinations.length > 0 ? (
                      <DndContext
                        collisionDetection={closestCenter}
                        accessibility={TP_DRAG_ACCESSIBILITY}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext items={destinations.map((d) => d.place_id)} strategy={verticalListSortingStrategy}>
                          <div className="tp-edit-dest-rows" data-testid="edit-trip-dest-rows">
                            {destinations.map((d, i) => (
                              <SortableDestRow key={d.place_id} dest={d} index={i} onRemove={removeDest} />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    ) : (
                      <p style={{ margin: '0 0 8px', color: 'var(--color-muted)', fontSize: 'var(--font-size-footnote)' }}>
                        尚無目的地，按下方按鈕加入。
                      </p>
                    )}
                    <div className="tp-edit-dest-add-wrap">
                      {!showSearch ? (
                        <button
                          type="button"
                          className="tp-edit-dest-add-btn"
                          onClick={() => setShowSearch(true)}
                          data-testid="edit-trip-dest-add-btn"
                        >
                          <Icon name="plus" />
                          <span>加入目的地</span>
                        </button>
                      ) : (
                        <div className="tp-edit-dest-search-wrap">
                          <input
                            type="text"
                            value={destQuery}
                            onChange={(e) => setDestQuery(e.target.value)}
                            placeholder="搜尋景點、城市、地址⋯"
                            autoFocus
                            autoComplete="off"
                            data-testid="edit-trip-dest-search-input"
                          />
                          {destQuery.trim().length >= 2 && (
                            <div className="tp-edit-dest-dropdown" role="listbox" data-testid="edit-trip-dest-dropdown">
                              {poiSearching && <div className="tp-edit-dest-status">搜尋中⋯</div>}
                              {!poiSearching && poiSearchError && <div className="tp-edit-dest-status">{poiSearchError}</div>}
                              {!poiSearching && !poiSearchError && poiResults.length === 0 && (
                                <div className="tp-edit-dest-status">沒找到結果，試試別的關鍵字</div>
                              )}
                              {!poiSearching && poiResults.length > 0 && poiResults.map((p) => (
                                <button
                                  key={p.place_id}
                                  type="button"
                                  role="option"
                                  className="tp-edit-dest-result"
                                  onClick={() => selectPoi(p)}
                                  data-testid={`edit-trip-dest-result-${p.place_id}`}
                                >
                                  <span className="name">{p.name}</span>
                                  <span className="addr">{p.address}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* v2.33.0: 行程天數（取代 v2.32.5 之前的 read-only date section）。
                      增/減天即時呼叫 backend；移除有 entries 的天 → ConfirmModal。 */}
                  <div className="tp-edit-row" data-testid="edit-trip-days-section">
                    <label>行程天數</label>
                    {days === null ? (
                      <div className="tp-edit-loading" data-testid="edit-trip-days-loading">載入中⋯</div>
                    ) : (
                      <>
                        <p className="tp-edit-date-helper" style={{ marginBottom: 8 }}>
                          {days.length > 0 && days[0]?.date && days[days.length - 1]?.date
                            ? `${formatShortDate(days[0]!.date)}（${days[0]!.dayOfWeek ?? ''}）– ${formatShortDate(days[days.length - 1]!.date)}（${days[days.length - 1]!.dayOfWeek ?? ''}），共 ${days.length} 天`
                            : `共 ${days.length} 天`}
                          。可在最前或最後加入新一天（日期自動順延 / 提前）；移除有景點的天會跳出確認。
                        </p>

                        {/* v2.33.8: 整體平移行程 — 直接設定 Day 1 起始日期 */}
                        {days.length > 0 && days[0]?.date && (
                          <button
                            type="button"
                            className="tp-edit-day-shift-btn"
                            onClick={handleOpenShift}
                            disabled={daysMutating}
                            data-testid="edit-trip-day-shift-btn"
                          >
                            <span className="tp-edit-day-shift-label">
                              出發日期：<strong>{formatShortDate(days[0]!.date)}（{days[0]!.dayOfWeek ?? ''}）</strong>
                            </span>
                            <span className="tp-edit-day-shift-chev" aria-hidden="true">›</span>
                          </button>
                        )}

                        <button
                          type="button"
                          className="tp-edit-day-add-card"
                          onClick={() => handleAddDay('start')}
                          disabled={daysMutating}
                          data-testid="edit-trip-day-prepend"
                        >
                          <span className="plus"><Icon name="plus" /></span>
                          <span>加一天</span>
                        </button>

                        <div className="tp-edit-days-list" data-testid="edit-trip-days-list">
                          {days.flatMap((d, idx, arr) => {
                            const elements: React.ReactNode[] = [];
                            elements.push(
                              <div className="tp-edit-day-row" key={`day-${d.id}`} data-testid={`edit-trip-day-row-${d.dayNum}`}>
                                <span className="tp-edit-day-num">{d.dayNum}</span>
                                <div className="tp-edit-day-content">
                                  <div className="tp-edit-day-date">
                                    {d.date ? `${formatShortDate(d.date)}（${d.dayOfWeek ?? ''}）` : `Day ${d.dayNum}`}
                                  </div>
                                  <div
                                    className={`tp-edit-day-meta ${d.entryCount > 0 ? 'has-entries' : 'is-empty'}`}
                                  >
                                    {d.entryCount > 0
                                      ? d.totalKm != null
                                        ? `${d.entryCount} 個景點 · ${d.totalKm} km`
                                        : `${d.entryCount} 個景點`
                                      : '空'}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={`tp-edit-day-remove ${d.entryCount > 0 ? 'has-entries-warning' : ''}`}
                                  onClick={() => handleRequestDelete(d)}
                                  disabled={daysMutating || arr.length <= 1}
                                  aria-label={`移除 Day ${d.dayNum}${d.entryCount > 0 ? `（會刪除 ${d.entryCount} 個景點）` : ''}`}
                                  data-testid={`edit-trip-day-remove-${d.dayNum}`}
                                >
                                  <Icon name="x-mark" />
                                </button>
                              </div>
                            );
                            // v2.33.7: 偵測 gap — current day 跟 next day 之間有缺日 → render placeholder
                            const next = arr[idx + 1];
                            if (next && d.date && next.date) {
                              const diff = daysBetween(d.date, next.date);
                              for (let g = 1; g < diff; g++) {
                                const gapDate = shiftDateByDays(d.date, g);
                                elements.push(
                                  <button
                                    type="button"
                                    key={`gap-${gapDate}`}
                                    className="tp-edit-day-gap"
                                    onClick={() => handleRestoreDay(gapDate)}
                                    disabled={daysMutating}
                                    data-testid={`edit-trip-day-gap-${gapDate}`}
                                    aria-label={`加回 ${formatShortDate(gapDate)}（${chineseDayOfWeek(gapDate)}）`}
                                  >
                                    <span className="plus"><Icon name="plus" /></span>
                                    <span className="tp-edit-day-gap-text">
                                      加回 {formatShortDate(gapDate)}（{chineseDayOfWeek(gapDate)}）
                                    </span>
                                  </button>
                                );
                              }
                            }
                            return elements;
                          })}
                        </div>

                        <button
                          type="button"
                          className="tp-edit-day-add-card"
                          onClick={() => handleAddDay('end')}
                          disabled={daysMutating}
                          data-testid="edit-trip-day-append"
                        >
                          <span className="plus"><Icon name="plus" /></span>
                          <span>加一天</span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Description */}
                  <div className="tp-edit-row">
                    <label htmlFor="edit-trip-desc-input">描述（選填，用於 SEO）</label>
                    <textarea
                      id="edit-trip-desc-input"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      data-testid="edit-trip-desc-input"
                    />
                  </div>

                  {/* Lang */}
                  <div className="tp-edit-row" data-testid="edit-trip-lang-select">
                    <label htmlFor="edit-trip-lang">顯示語言</label>
                    <TripSelect<Lang>
                      id="edit-trip-lang"
                      value={lang}
                      onChange={setLang}
                      ariaLabel="顯示語言"
                      options={[
                        { value: 'zh-TW', label: '繁體中文（台灣）' },
                        { value: 'en', label: 'English' },
                        { value: 'ja', label: '日本語' },
                      ]}
                    />
                  </div>

                  {/* v2.31.36 (migration 0068): default travel mode + self-drive form removed
                      — dead columns dropped。UI 收集了但 backend 沒讀取使用（recompute 用 Haversine gate）。
                      若日後需要重啟此功能，先設計 segment computation read path 再加回 UI。 */}

                  {error && <InlineError message={error} testId="edit-trip-error" />}
                </>
              )}
            </form>

            {!loading && (
              <div className="tp-page-bottom-bar">
                <div className="tp-edit-actions-publish" role="radiogroup" aria-label="發布狀態">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={published === 0}
                    className={`is-draft ${published === 0 ? 'is-active' : ''}`}
                    onClick={() => setPublished(0)}
                    data-testid="edit-trip-published-draft"
                  >
                    <span className="dot"></span>
                    <span>草稿</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={published === 1}
                    className={`is-published ${published === 1 ? 'is-active' : ''}`}
                    onClick={() => setPublished(1)}
                    data-testid="edit-trip-published-on"
                  >
                    <span className="dot"></span>
                    <span>上線</span>
                  </button>
                </div>
                {/* v2.33.108: 移除「儲存變更」button — auto-save 已 wire。剩「返回」（已 auto-saved 無需 cancel 語意）。 */}
                <div className="tp-edit-actions-btns">
                  <button
                    type="button"
                    className="tp-edit-btn"
                    onClick={handleBack}
                    data-testid="edit-trip-back"
                  >
                    返回
                  </button>
                </div>
              </div>
            )}
      </OperationShell>
      {/* v2.33.0: destructive confirm 移除 day with entries / 最後一天 fallback。 */}
      <ConfirmModal
        open={!!pendingDelete}
        title={pendingDelete ? `刪除 Day ${pendingDelete.dayNum}？` : ''}
        message={
          pendingDelete
            ? pendingDelete.entryCount > 0
              ? `Day ${pendingDelete.dayNum}${pendingDelete.date ? `（${formatShortDate(pendingDelete.date)}）` : ''}目前有 ${pendingDelete.entryCount} 個景點。確認後將同時刪除這些景點與排程，此操作不可復原。`
              : `Day ${pendingDelete.dayNum}${pendingDelete.date ? `（${formatShortDate(pendingDelete.date)}）` : ''}目前是空的。確認移除？`
            : ''
        }
        warning={
          pendingDelete && pendingDelete.entryCount > 0
            ? '後續天數的 Day 編號會往前遞補（日期保留，可能會留下空檔的日子）。'
            : undefined
        }
        confirmLabel={pendingDelete ? `刪除 Day ${pendingDelete.dayNum}` : '刪除'}
        busy={daysMutating}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      {/* v2.33.8 / v2.33.9 fix: 整體平移行程 modal (本 component 自己定義
          backdrop，避免依賴 ConfirmModal SCOPED_STYLES) */}
      {shiftModalOpen && days && days[0]?.date && (
        <div ref={shiftBackdropRef} className="tp-shift-backdrop" role="presentation" onClick={daysMutating ? undefined : () => setShiftModalOpen(false)} data-testid="edit-trip-shift-modal-backdrop">
          <div ref={shiftPanelRef} tabIndex={-1} className="tp-shift-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} onKeyDown={shiftPanelKeyDown} data-testid="edit-trip-shift-modal">
            <h2 className="tp-shift-modal-title">變更出發日期</h2>
            <label className="tp-shift-modal-label" htmlFor="edit-trip-shift-date">出發日期</label>
            <div data-testid="edit-trip-shift-date-input">
              <TripDatePicker
                id="edit-trip-shift-date"
                value={shiftNewDate}
                onChange={setShiftNewDate}
                ariaLabel="變更出發日期"
              />
            </div>
            <div className="tp-shift-modal-preview" data-testid="edit-trip-shift-preview">
              {(() => {
                // v2.33.93 simplify: 重用 daysBetween + shiftDateByDays 而非 inline 重複 ms 數學
                const oldStart = days[0]!.date!;
                const oldEnd = days[days.length - 1]!.date ?? oldStart;
                const delta = daysBetween(oldStart, shiftNewDate);
                const newEnd = shiftDateByDays(oldEnd, delta);
                return `${formatShortDate(oldStart)}（${chineseDayOfWeek(oldStart)}）– ${formatShortDate(oldEnd)}（${chineseDayOfWeek(oldEnd)}） → ${formatShortDate(shiftNewDate)}（${chineseDayOfWeek(shiftNewDate)}）– ${formatShortDate(newEnd)}（${chineseDayOfWeek(newEnd)}）`;
              })()}
            </div>
            <div className="tp-shift-modal-actions">
              <button
                type="button"
                className="tp-shift-modal-btn tp-shift-modal-cancel"
                onClick={() => setShiftModalOpen(false)}
                disabled={daysMutating}
              >
                取消
              </button>
              <button
                type="button"
                className="tp-shift-modal-btn tp-shift-modal-confirm"
                onClick={handleConfirmShift}
                disabled={daysMutating || shiftNewDate === days[0]!.date}
                data-testid="edit-trip-shift-confirm-btn"
              >
                {daysMutating ? '變更中⋯' : '確認變更'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
