/**
 * TimelineRail — 桌機 + 手機統一 compact editorial rail with V3 inline expansion (PR2 v2.7)
 *
 * Reverses the 2026-04-19 「整行可點跳詳情頁」 decision. Click a row → toggle
 * inline detail panel (description / locations / note). Note is click-to-edit
 * (textarea + Cmd+Enter / ESC) and persists via PATCH /api/trips/:id/entries/:eid.
 * On save success → dispatch `tp-entry-updated` event so TripPage triggers
 * `refetchCurrentDay`.
 *
 * Accordion behavior: only one row expanded at a time (parent-managed `expandedId`).
 * StopDetailPage URL still resolves for direct deep-link sharing but no longer
 * reachable via list click.
 */

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  DndContext,
  closestCenter, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTripId } from '../../contexts/TripIdContext';
import { useTripDays } from '../../contexts/TripDaysContext';
import { apiFetchRaw } from '../../lib/apiClient';
import { requestTravelRecompute } from '../../lib/travelRecompute';
import { EVENT } from '../../lib/events';
import { POI_TYPE_LABELS, type PoiType } from '../../lib/poiCategory';
import { TP_DRAG_ACCESSIBILITY } from '../../lib/drag-announcements';
import Icon from '../shared/Icon';
import ConfirmModal from '../shared/ConfirmModal';
import { showToast } from '../shared/Toast';
import { useAutosave } from '../../hooks/useAutosave';
import { ApiError } from '../../lib/errors';
import MarkdownText from '../shared/MarkdownText';
import StopLightbox from './StopLightbox';
// 2026-05-03 modal-to-fullpage migration: EntryActionPopover 由 /trip/:id/stop/:eid/(copy|move) page 取代。
// DayOption type 抽到 src/lib/entryAction.ts 給 caller (TripPage dayOptions) 共用。
import { useNavigate } from 'react-router-dom';
import MapLinks from './MapLinks';
import TravelPill from './TravelPill';
import type { StopPoiOptionData, TimelineEntryData } from './TimelineEvent';
import { parseEntryTime, formatDurationCompact, formatTimeRange, deriveTypeMeta } from '../../lib/timelineUtils';
import { dayNumFromId } from '../../lib/entryAction';
import { useDragDrop } from '../../hooks/useDragDrop';
import { useTripSegments } from '../../hooks/useTripSegments';
import { getTimelineEntryDisplayTitle } from '../../lib/stopDisplay';
import { condenseHours } from '../../lib/poiHours';

const SCOPED_STYLES = `
.tp-rail-detail {
  /* 2026-07-07 user 要求：展開明細與 header 卡同寬（原 margin-left 56/44px
   * 對齊 dot 縮排 — v2.30.12 註解保留於 git history）。 */
  margin: 4px 0 8px;
  padding: 14px 16px;
  /* 展開明細與卡片同色系（繼承 .tp-rail-item[data-tone] 的 --tone-*；neutral fallback secondary）*/
  background: var(--tone-subtle, var(--color-secondary));
  border: 1px solid var(--tone-bg, var(--color-border));
  border-radius: var(--radius-md);
  display: flex; flex-direction: column; gap: 12px;
  /* iOS 式展開（2026-07-07）：interpolate-size 讓 height:auto 可 transition，
   * 搭 @starting-style 從 0 高平滑長開（Apple bezier）。不支援的瀏覽器
   * height/overflow 宣告無害，動畫 fallback 到下方 keyframes fade。
   * 收合維持條件 unmount（立即消失）— 測試與 a11y 語意不變。 */
  interpolate-size: allow-keywords;
  height: auto;
  overflow: hidden;
  transition:
    height 320ms var(--transition-timing-function-apple, ease-out),
    margin 320ms var(--transition-timing-function-apple, ease-out),
    padding 320ms var(--transition-timing-function-apple, ease-out),
    opacity 240ms ease-out;
  animation: tp-rail-detail-in 160ms var(--transition-timing-function-apple, ease-out);
}
@starting-style {
  .tp-rail-detail {
    height: 0;
    margin-top: 0; margin-bottom: 0;
    padding-top: 0; padding-bottom: 0;
    opacity: 0;
  }
}
/* 支援 interpolate-size 的瀏覽器走高度 transition，關掉舊 fade keyframes
 * 避免 opacity 被 animation 蓋過 transition（兩者疊跑不協調）。 */
@supports (interpolate-size: allow-keywords) {
  .tp-rail-detail { animation: none; }
}
@media (max-width: 760px) {
  .tp-rail-detail { padding: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .tp-rail-detail { transition: none; animation: none; }
}
@keyframes tp-rail-detail-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.tp-rail-detail-section h4 {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--color-muted);
  margin: 0 0 6px;
}
.tp-rail-detail-desc {
  font-size: var(--font-size-body); line-height: 1.55;
  color: var(--color-foreground);
  margin: 0;
}
/* v2.30.14：景點說明 section — master POI 整合 meta row + MapLinks */
.tp-rail-poi-meta {
  display: flex; align-items: center; gap: 6px;
  flex-wrap: wrap;
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  margin-bottom: 8px;
  font-variant-numeric: tabular-nums;
}
.tp-rail-poi-meta-sep { opacity: 0.4; }
.tp-rail-poi-meta-star { color: var(--color-accent); font-weight: 700; }
.tp-rail-poi-meta-strong { color: var(--color-foreground); font-weight: 600; }
.tp-rail-detail-maps { margin-bottom: 10px; }
.tp-rail-detail-desc-master {
  margin-top: 8px;
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
}

.tp-rail-note-value {
  font-size: var(--font-size-body); line-height: 1.55;
  background: var(--color-background); border: 1.5px solid transparent;
  border-radius: var(--radius-md);
  padding: 10px 12px;
  cursor: text;
  min-height: var(--spacing-tap-min);
  white-space: pre-wrap;
  transition: border-color 120ms;
}
.tp-rail-note-value:hover { border-color: var(--color-border); }
.tp-rail-note-value.is-empty { color: var(--color-muted); font-style: italic; cursor: pointer; }
.tp-rail-note-input {
  font: inherit; font-size: var(--font-size-body); line-height: 1.55;
  width: 100%;
  background: var(--color-background); border: 1.5px solid var(--color-accent);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  resize: vertical;
  min-height: 88px;
  color: var(--color-foreground);
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}
.tp-rail-note-input:focus { outline: none; }
.tp-rail-note-actions {
  display: flex; align-items: center; gap: 8px; margin-top: 8px;
  flex-wrap: wrap;
}
.tp-rail-note-save, .tp-rail-note-cancel {
  font: inherit; font-size: var(--font-size-footnote); font-weight: 700;
  border-radius: var(--radius-full); cursor: pointer;
  /* H4: Apple HIG 44px tap target — these are primary edit-mode actions. */
  min-height: var(--spacing-tap-min);
  padding: 8px 16px;
  border: 1px solid transparent;
}
.tp-rail-note-save {
  background: var(--color-accent); color: var(--color-accent-foreground); border-color: var(--color-accent);
}
.tp-rail-note-save:hover:not(:disabled) { filter: brightness(0.95); }
.tp-rail-note-save:disabled { opacity: 0.5; cursor: not-allowed; }
.tp-rail-note-cancel {
  background: transparent; color: var(--color-muted);
}
.tp-rail-note-cancel:hover { background: var(--color-background); color: var(--color-foreground); }
.tp-rail-note-kbd { font-size: var(--font-size-caption); color: var(--color-muted); margin-left: auto; }
.tp-rail-note-kbd kbd {
  background: var(--color-background); padding: 1px 6px; border-radius: var(--radius-xs);
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: var(--font-size-caption); border: 1px solid var(--color-border);
}
/* 鍵盤捷徑提示只在有實體鍵盤的裝置顯示；觸控裝置（無 hover + 粗指標）沒有 ⌘/esc 鍵。 */
@media (hover: none) and (pointer: coarse) {
  .tp-rail-note-kbd { display: none; }
}
.tp-rail-note-error {
  font-size: var(--font-size-footnote); color: var(--color-destructive);
  margin-top: 4px;
}

.tp-rail-head[aria-expanded="true"] .tp-rail-caret { transform: rotate(90deg); color: var(--color-accent-deep); }
.tp-rail-caret { transition: transform 120ms; display: inline-block; }

/* 備選景點 list — alternates only (v2.30.14)。master POI 已升格到 .tp-rail-poi-meta */
.tp-rail-poi-list { display: flex; flex-direction: column; gap: 8px; }
.tp-rail-poi-card {
  /* 備選 = 第三色粉（柔褐三色主題 2026-06）*/
  background: var(--color-accent-3-subtle);
  border: 1px solid var(--color-accent-3-bg);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  transition: border-color 160ms var(--transition-timing-function-apple);
}
.tp-rail-poi-card:hover { border-color: var(--color-accent-3); }
.tp-rail-poi-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; row-gap: 4px; }
.tp-rail-poi-name {
  font-size: var(--font-size-callout);
  font-weight: 700;
  color: var(--color-foreground);
  line-height: 1.35;
}
.tp-rail-poi-type {
  font-size: var(--font-size-caption);
  color: var(--color-muted);
  background: var(--color-tertiary);
  border-radius: var(--radius-full);
  padding: 2px 8px;
}
.tp-rail-poi-card-meta {
  font-size: var(--font-size-caption);
  color: var(--color-muted);
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}
.tp-rail-poi-desc {
  font-size: var(--font-size-footnote);
  color: var(--color-foreground);
  margin-top: 6px;
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tp-rail-poi-note {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  margin-top: 4px;
  line-height: 1.55;
}

/* 2026-04-29 mockup parity:expanded toolbar 從 body 上方移到底部(mockup S12
 * Variant A 規範)。margin-top + padding-top + border-top 視覺分隔 body 內容。
 * gap 改 4px 讓 4+2 兩組看起來更緊。 */
.tp-rail-actions {
  display: flex; gap: 4px; flex-wrap: wrap;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}
.tp-rail-action-spacer { flex: 1; }
.tp-rail-action-icon {
  /* v2.10 Wave 1: copy/move icon-only buttons. relative for popover absolute pos. */
  position: relative;
  font: inherit; font-size: var(--font-size-body);
  width: var(--spacing-tap-min); height: var(--spacing-tap-min);
  border-radius: var(--radius-full);
  background: var(--color-secondary); color: var(--color-foreground);
  border: 1px solid var(--color-border); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.tp-rail-action-icon:hover {
  background: var(--color-accent-subtle); color: var(--color-accent-deep); border-color: var(--color-accent-bg);
}
/* QA 2026-04-26 BUG-012：mockup .iconbtn.sm.danger for delete — destructive
 * 顏色用 priority-high tokens 對齊 DESIGN.md semantic colors。 */
.tp-rail-action-icon.is-danger:hover {
  background: var(--color-priority-high-bg);
  color: var(--color-priority-high-dot);
  border-color: var(--color-priority-high-dot);
}
.tp-rail-action-icon-group {
  /* anchor the absolute-positioned EntryActionPopover */
  position: relative;
  display: inline-flex; gap: 4px;
}

/* 2026-05-01 mockup S12 Variant A 對齊 — grip 在 row grid col 1，永遠淡顯
 * (opacity 0.4) 而非 hover-only 隱形，hover 才變 accent。提升 discoverability
 * 同時不喧賓奪主。觸控裝置同樣 0.4，避免「找不到拖拉把手」。 */
.tp-rail-grip {
  grid-column: 1;
  border: 0; background: transparent;
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px;
  cursor: grab;
  color: var(--color-muted);
  opacity: 0.4;
  border-radius: var(--radius-sm);
  /* drag-vs-scroll: pan-y lets a quick vertical swipe on the grip scroll the
   * timeline natively; the delay-based TouchSensor still claims a long-press for
   * reorder. Suppressing touch gestures entirely would make the grip a scroll
   * dead-zone (swipe neither scrolls nor drags). */
  touch-action: pan-y;
  flex-shrink: 0;
  transition: color 120ms, opacity 160ms;
}
.tp-rail-row-wrap:hover .tp-rail-grip,
.tp-rail-grip:hover,
.tp-rail-grip:focus-visible {
  opacity: 1;
  color: var(--color-accent);
}
.tp-rail-grip:active { cursor: grabbing; }
.tp-rail-grip .svg-icon { width: 16px; height: 16px; }
`;

interface TimelineRailProps {
  events: TimelineEntryData[];
  /** Activate "now" indicator for this index */
  nowIndex?: number;
  /** v2.10 Wave 1: trip_days.id for current day — passed to RailRow for copy/move
   *  popover currentDayId + copy POST default sortOrder. Optional for tests. */
  dayId?: number | null;
}

interface RailRowProps {
  entry: TimelineEntryData;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  isPast: boolean;
  isNow: boolean;
  isLast: boolean;
  dayId?: number | null;
}

// v2.33.28: dedupe — 改 import POI_TYPE_LABELS canonical (poiCategory.ts)。
// hotel canonical = '飯店'（之前本地 '住宿' 屬 drift bug 家族 v2.31.23 root cause）。

// v2.33.45 round 6b: wrap memo — 之前 alternate POI 列表每筆 row 都會在
// RailRow re-render 時跟著 re-render，trips 含 hotel + ~10 alternates 時
// 浪費 render。poi prop 來自 entry.stopPois.filter(sort_order>1)，引用穩定。
const StopPoiChoiceCard = memo(function StopPoiChoiceCard({ poi }: { poi: StopPoiOptionData }) {
  const metaParts: string[] = [];
  if (typeof poi.rating === 'number') metaParts.push(`★ ${poi.rating.toFixed(1)}`);
  if (poi.price) metaParts.push(poi.price);
  const hoursStr = condenseHours(poi.hours);
  if (hoursStr) metaParts.push(hoursStr);
  if (poi.reservation) metaParts.push(poi.reservation);
  const typeLabel = poi.category || (poi.type ? POI_TYPE_LABELS[poi.type as PoiType] ?? poi.type : null);

  // v2.30.14：StopPoiChoiceCard 只渲染備選 (alternate)，「正選」已升格到景點說明。
  // v2.33.93 simplify: onClick stopPropagation 從 wrapper <div> 搬上 <article>，
  // 拔掉純為 event isolation 而存在的無布局意義 wrapper。
  return (
    <article className="tp-rail-poi-card" data-variant="alternate" onClick={(e) => e.stopPropagation()}>
      <div className="tp-rail-poi-head">
        <span className="tp-rail-poi-name">{poi.name}</span>
        {typeLabel && <span className="tp-rail-poi-type">{typeLabel}</span>}
        {poi.location && <MapLinks location={poi.location} inline />}
      </div>
      {metaParts.length > 0 && (
        <div className="tp-rail-poi-card-meta">{metaParts.join(' · ')}</div>
      )}
      {poi.description && (
        <MarkdownText text={poi.description} as="div" className="tp-rail-poi-desc" inline />
      )}
      {poi.note && (
        <MarkdownText text={poi.note} as="div" className="tp-rail-poi-note" inline />
      )}
    </article>
  );
});

const RailRow = memo(function RailRow({ entry, index, expanded, onToggle, isPast, isNow, isLast, dayId }: RailRowProps) {
  const tripId = useTripId();
  const allDays = useTripDays();
  const parsed = parseEntryTime(entry);
  const meta = deriveTypeMeta(entry);
  const entryDisplayTitle = getTimelineEntryDisplayTitle(entry);

  // QA 2026-04-26 PR-K：dnd-kit sortable wiring。entry.id null 時 disabled
  // (避免拖到還沒儲存的 row)。drag handle 用 grip icon button (only-source)
  // 避免跟 row click 衝突 toggle expand。
  const sortableId = entry.id ?? `idx-${index}`;
  const sortable = useSortable({ id: sortableId, disabled: entry.id == null });
  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.6 : undefined,
    zIndex: sortable.isDragging ? 20 : undefined,
  };
  const canExpand = entry.id != null;
  const entryIdNum = entry.id ?? null;

  // v2.29.x per-POI note cutover：inline 快速編輯的 save target 從 entry-level
  // `trip_entries.note`（已 DROP）改為 master stopPoi（sortOrder=1）的 per-POI note。
  // master poiId 從 entry.stopPois 取 sortOrder===1 那筆的 poiId；缺 master 或
  // master 無 poiId（如尚未存檔的搜尋結果）→ 無法定位 PATCH target → 停用編輯。
  const masterPoiId = useMemo(() => {
    const items = entry.stopPois ?? [];
    const masterRow = items.find((p) => p.sortOrder === 1);
    return masterRow?.poiId ?? null;
  }, [entry.stopPois]);
  const canEditNote = masterPoiId != null;

  const [editingNote, setEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState('');
  // v2.33.108: note save 走 useAutosave hook（state/error 由 hook 管）。
  // deleteError 保留 separate state — 跟 note edit error 互不干擾。
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const navigate = useNavigate();
  // Section 4.5 (terracotta-ui-parity-polish): 取代 window.confirm 為 ConfirmModal pattern
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // v2.33.108: note 改 auto-save — onBlur 立即 flush，Cmd+Enter 仍 flush。
  // 移除「儲存 / 取消」button，改「完成」按鈕（純關閉 edit mode，狀態已 auto-saved）。
  // ESC 改 revert + 關 — 若未 save 直接 cancel；若已 save 則 revert 需透過原值重 PATCH（保守做法：ESC 一律 flush + close）。
  const noteAutosave = useAutosave<{ note: string }>({
    debounceMs: 800,
    save: async (body) => {
      if (!tripId || entryIdNum == null || masterPoiId == null) {
        throw new Error('Missing tripId / entryId / masterPoiId');
      }
      // v2.29.x：repoint 到 per-POI note 端點（master poiId）。LWW，不帶 version token。
      const res = await apiFetchRaw(`/trips/${tripId}/entries/${entryIdNum}/pois/${masterPoiId}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw await ApiError.fromResponse(res);
      window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, {
        detail: { tripId, entryId: entryIdNum },
      }));
      return await res.json() as Record<string, unknown>;
    },
  });

  // v2.33.143: autosave error 走 toast（拔 SaveStatus inline UI 後唯一錯誤 surface）。
  // 監聽 state==='error' transition 觸發 1 次 toast，避免每 re-render 都 toast。
  const lastNoteErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (noteAutosave.state === 'error' && noteAutosave.error && noteAutosave.error !== lastNoteErrorRef.current) {
      lastNoteErrorRef.current = noteAutosave.error;
      showToast(`備註儲存失敗：${noteAutosave.error}`, 'error', 6000);
    } else if (noteAutosave.state !== 'error') {
      lastNoteErrorRef.current = null;
    }
  }, [noteAutosave.state, noteAutosave.error]);

  const beginEditNote = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    // v2.29.x：無 master poiId → 無 PATCH target，停用 inline 編輯（no-op）。
    if (!canEditNote) return;
    setDraftNote(entry.note ?? '');
    setEditingNote(true);
  };

  const closeEditNote = useCallback(async () => {
    await noteAutosave.flush();
    setEditingNote(false);
    setDraftNote('');
  }, [noteAutosave]);

  const handleNoteChange = (value: string) => {
    setDraftNote(value);
    noteAutosave.patch({ note: value });
  };

  const handleNoteBlur = () => {
    void noteAutosave.flush();
  };

  const handleNoteKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      // ESC 直接關閉（已 auto-save flushed 或仍 in pending — flush 後關）
      void closeEditNote();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void closeEditNote();
    }
  };

  // QA 2026-04-26 BUG-012：mockup .iconbtn.sm.danger trash delete handler。
  // Section 4.5 (terracotta-ui-parity-polish): mockup 規定不用 window.confirm。
  // 改 ConfirmModal pattern — trash button 開 modal，modal 內 confirm 才 fire DELETE。
  // 成功後 dispatch event 觸發 refetch。
  const handleDeleteConfirm = useCallback(async () => {
    if (!tripId || entryIdNum == null) return;
    setDeleting(true);
    try {
      const res = await apiFetchRaw(`/trips/${tripId}/entries/${entryIdNum}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('刪除失敗');
      // 2026-07-06 車程重算缺口：刪除後 FK cascade 移除舊 pair，新相鄰 pair
      // 缺 row 沒人算 → 補顯式 day-scoped recompute（fire-and-forget，失敗
      // 靜默 — self-healing 與 TravelPill ⚠ 是 fallback）。
      void requestTravelRecompute(tripId, dayNumFromId(allDays, dayId))
        .catch(() => undefined);
      window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, {
        detail: { tripId, entryId: entryIdNum },
      }));
      setShowDeleteConfirm(false);
    } catch (err) {
      // 顯示錯誤但保留 modal 開啟讓 user 重試
      setDeleteError(err instanceof Error ? err.message : '刪除失敗');
    } finally {
      setDeleting(false);
    }
  }, [tripId, entryIdNum, dayId, allDays]);

  // v2.10 Wave 1 → 2026-05-03 modal-to-fullpage: copy / move 改 navigate
  // 到 /trip/:id/stop/:eid/(copy|move) page，page 自己處理 fetch days +
  // 確認 + dispatch tp-entry-updated event。TimelineRail 只需 navigate。
  const goCopyOrMove = useCallback((action: 'copy' | 'move') => {
    if (!tripId || entryIdNum == null) return;
    navigate(`/trip/${encodeURIComponent(tripId)}/stop/${entryIdNum}/${action}`);
  }, [tripId, entryIdNum, navigate]);

  const hasNote = !!entry.note?.trim();

  const stopPois: StopPoiOptionData[] = useMemo(() => {
    const items = entry.stopPois ?? [];
    return [...items]
      .filter((p) => !!p.name?.trim())
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  }, [entry.stopPois]);

  // v2.30.14：master POI (sortOrder=1) 欄位升格到「景點說明」section、不再渲染獨立
  // 「正選」卡片；備選 (sortOrder>=2) 留在「備選景點」section（只在 alternates 存
  // 在時渲染）。Section 順序：景點說明 → 備註 → 備選景點。
  const master = stopPois[0] ?? null;
  const alternates = stopPois.slice(1);
  const hasAlternates = alternates.length > 0;

  const masterMeta = useMemo(() => {
    const parts: { text: string; kind: 'star' | 'strong' | 'plain' }[] = [];
    if (master && typeof master.rating === 'number') {
      parts.push({ text: `★ ${master.rating.toFixed(1)}`, kind: 'star' });
    }
    if (master?.price) parts.push({ text: master.price, kind: 'strong' });
    const condensedHours = condenseHours(master?.hours);
    if (condensedHours) parts.push({ text: condensedHours, kind: 'plain' });
    if (master?.reservation) parts.push({ text: master.reservation, kind: 'plain' });
    return parts;
  }, [master]);

  // MapLinks 來源優先 master.location → fallback entry.locations[0]（舊資料相容）
  const mapLocation = master?.location ?? entry.locations?.[0] ?? null;
  const entryDesc = entry.description?.trim() ?? '';
  const masterDesc = master?.description?.trim() ?? '';
  const hasDescriptionSection =
    !!entryDesc || !!masterDesc || masterMeta.length > 0 || !!mapLocation;

  return (
    <>
      <div
        ref={sortable.setNodeRef}
        style={sortableStyle}
        className="tp-rail-item"
        data-now={isNow || undefined}
        data-past={isPast || undefined}
        data-tone={meta.tone}
        data-last={isLast || undefined}
        data-expanded={expanded || undefined}
        data-scroll-anchor={entry.id != null ? `entry-${entry.id}` : undefined}
      >
        {/* mockup .tp-detail-row:1923 — 6-col grid: grip(24) | time(50) | dot(24) | icon(44) | body(1fr) | caret(20)。
         * 2026-05-10 (#510)：重新加回 .tp-rail-dot — 編號圓圈是 wayfinding，
         * mockup terracotta-preview-v2.html 6241 一直都有，移除它的舊註解（基於更早 S12 Variant A）已過期。 */}
        <button
          type="button"
          className="tp-rail-grip"
          {...sortable.listeners}
          {...sortable.attributes}
          aria-label={`拖拉排序：${entryDisplayTitle}`}
          data-testid={entry.id != null ? `timeline-rail-grip-${entry.id}` : undefined}
        >
          <Icon name="grip" />
        </button>
        <span className="tp-rail-dot" aria-hidden="true">{index + 1}</span>
        <button
          type="button"
          className="tp-rail-head"
          onClick={() => {
            // v2.31.81 #5：row click → dispatch entryFocused 讓 TripMapRail pan 到該 pin。
            // v2.31.87 #5+#6：detail 加 isExpanding（! expanded = 點後 next state）
            //   isExpanding=true (展開) → TripMapRail flyTo zoom 15
            //   isExpanding=false (收合) → flyTo zoom 11（trip overview level）
            if (entry.id != null) {
              window.dispatchEvent(new CustomEvent(EVENT.entryFocused, {
                detail: { entryId: entry.id, isExpanding: !expanded },
              }));
            }
            onToggle();
          }}
          disabled={!canExpand}
          aria-expanded={canExpand ? expanded : undefined}
          aria-label={`${expanded ? '收合' : '展開'}景點：${entryDisplayTitle}`}
          data-testid={entry.id != null ? `timeline-rail-row-${entry.id}` : undefined}
        >
          <span className="tp-rail-icon" aria-hidden="true">
            <Icon name={meta.icon} />
          </span>
          <span className="tp-rail-content">
            <span className="tp-rail-name">{entryDisplayTitle}</span>
            {(() => {
              const durLabel = formatDurationCompact(parsed.duration);
              // mockup hotel row sub-line 是「HOTEL · 退房 + 早餐」— 不顯示 rating
              // 即使 POI 有 rating（design choice：飯店重點是 check-out / 早餐
              // 等資訊，rating 對 hotel timeline entry 不那麼相關）。
              const isHotel = meta.label === '住宿';
              const rating = typeof entry.googleRating === 'number' && !isHotel ? entry.googleRating : null;
              const desc = entry.description?.trim() ?? '';
              const shortDesc = desc && desc.length <= 24 && !desc.includes('\n') ? desc : '';
              return (
                <span className="tp-rail-sub">
                  {(parsed.start || parsed.end) && (
                    <>
                      <span className="tp-rail-sub-time">{formatTimeRange(parsed.start, parsed.end)}</span>
                      <span className="tp-rail-sub-sep">·</span>
                    </>
                  )}
                  <span className="tp-rail-sub-type">{meta.label}</span>
                  {durLabel && (
                    <>
                      <span className="tp-rail-sub-sep">·</span>
                      <span>{durLabel}</span>
                    </>
                  )}
                  {rating != null && (
                    <>
                      <span className="tp-rail-sub-sep">·</span>
                      <span className="tp-rail-sub-star">★</span>
                      <span>{rating.toFixed(1)}</span>
                    </>
                  )}
                  {shortDesc && (
                    <>
                      <span className="tp-rail-sub-sep">·</span>
                      <span>{shortDesc}</span>
                    </>
                  )}
                </span>
              );
            })()}
          </span>
          <span className="tp-rail-caret" aria-hidden="true">›</span>
        </button>
      </div>

      {expanded && entry.id != null && (
        <div className="tp-rail-detail" data-tone={meta.tone} data-testid={`timeline-rail-detail-${entry.id}`}>
          {hasDescriptionSection && (
            <div
              className="tp-rail-detail-section"
              data-testid={`timeline-rail-description-${entry.id}`}
            >
              <h4>景點說明</h4>
              {masterMeta.length > 0 && (
                <div className="tp-rail-poi-meta">
                  {masterMeta.map((m, i) => (
                    <Fragment key={i}>
                      {i > 0 && <span className="tp-rail-poi-meta-sep">·</span>}
                      <span
                        className={clsx({
                          'tp-rail-poi-meta-star': m.kind === 'star',
                          'tp-rail-poi-meta-strong': m.kind === 'strong',
                        })}
                      >
                        {m.text}
                      </span>
                    </Fragment>
                  ))}
                </div>
              )}
              {mapLocation && (
                <div
                  className="tp-rail-detail-maps"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MapLinks location={mapLocation} inline />
                </div>
              )}
              {entryDesc && (
                <MarkdownText text={entryDesc} as="p" className="tp-rail-detail-desc" />
              )}
              {masterDesc && masterDesc !== entryDesc && (
                <MarkdownText
                  text={masterDesc}
                  as="p"
                  className="tp-rail-detail-desc tp-rail-detail-desc-master"
                />
              )}
            </div>
          )}

          <div className="tp-rail-detail-section">
            <h4>備註</h4>
            {editingNote ? (
              <>
                <textarea
                  className="tp-rail-note-input"
                  value={draftNote}
                  onChange={(e) => handleNoteChange(e.target.value)}
                  onBlur={handleNoteBlur}
                  onKeyDown={handleNoteKey}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  data-testid={`timeline-rail-note-input-${entry.id}`}
                />
                <div className="tp-rail-note-actions">
                  {/* v2.33.143: SaveStatus indicator 拔除 — silent auto-save，失敗
                      走 toast (見 noteAutosave 旁 useEffect)。 */}
                  <button
                    type="button"
                    className="tp-rail-note-cancel"
                    onClick={(e) => { e.stopPropagation(); void closeEditNote(); }}
                    data-testid={`timeline-rail-note-close-${entry.id}`}
                  >
                    完成
                  </button>
                  <span className="tp-rail-note-kbd">
                    <kbd>⌘</kbd> + <kbd>↩</kbd> 完成 · <kbd>esc</kbd> 關閉
                  </span>
                </div>
              </>
            ) : canEditNote ? (
              <div
                className={clsx('tp-rail-note-value', !hasNote && 'is-empty')}
                onClick={beginEditNote}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  // role="button" 須同時支援 Enter 與 Space（WAI-ARIA），Space preventDefault
                  // 防頁面捲動（adversarial H1，與 EditEntryPage PerPoiNoteRow 同源修正）。
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    beginEditNote(e);
                  }
                }}
                data-testid={`timeline-rail-note-value-${entry.id}`}
              >
                {hasNote ? entry.note : '+ 加備註'}
              </div>
            ) : hasNote ? (
              // v2.29.x：無 master poiId → 顯示 master note（read-only），不提供編輯 affordance。
              // note 來源已是 master（mapDay 設定）。空 note + 無 master 時整段不渲染。
              <div
                className="tp-rail-note-value"
                data-testid={`timeline-rail-note-value-${entry.id}`}
              >
                {entry.note}
              </div>
            ) : (
              <p className="tp-rail-detail-desc tp-rail-detail-desc-master" style={{ margin: 0 }}>
                尚無備註
              </p>
            )}
          </div>

          {hasAlternates && (
            <div className="tp-rail-detail-section">
              <h4>備選景點</h4>
              <div
                className="tp-rail-poi-list"
                data-testid={`timeline-rail-alternates-${entry.id}`}
              >
                {alternates.map((poi, i) => (
                  <StopPoiChoiceCard key={`${poi.poiId ?? poi.name}-${i}`} poi={poi} />
                ))}
              </div>
            </div>
          )}

          {/* 2026-04-29 mockup parity:expanded toolbar 從 body 上方移到底部
           * (mockup S12 Variant A 規範);排列 4+2 grouped:左 4 常用編輯
           * (放大|複|移|編)+ spacer + 右 2 終止/狀態(刪|收合)。 */}
          <div className="tp-rail-actions">
            <button
              type="button"
              className="tp-rail-action-icon"
              onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
              aria-label="放大檢視"
              title="放大檢視"
              data-testid={`timeline-rail-lightbox-open-${entry.id}`}
            >
              <Icon name="maximize" />
            </button>
            {dayId != null && allDays.length > 1 && (
              <div className="tp-rail-action-icon-group">
                <button
                  type="button"
                  className="tp-rail-action-icon"
                  onClick={(e) => { e.stopPropagation(); goCopyOrMove('copy'); }}
                  aria-label="複製到其他天"
                  title="複製到其他天"
                  data-testid={`timeline-rail-copy-open-${entry.id}`}
                >
                  <Icon name="copy" />
                </button>
                <button
                  type="button"
                  className="tp-rail-action-icon"
                  onClick={(e) => { e.stopPropagation(); goCopyOrMove('move'); }}
                  aria-label="移到其他天"
                  title="移到其他天"
                  data-testid={`timeline-rail-move-open-${entry.id}`}
                >
                  <Icon name="arrows-vertical" />
                </button>
              </div>
            )}
            {/* v2.26.0：「編」按鈕改 navigate 到 EditEntryPage 全頁 form
              * （含起訖時間 + 從上一站移動方式 + 備註）。tp-rail-detail 內 inline
              * note edit 仍保留作為快速 path（單獨改備註不用跳頁）。 */}
            {tripId && entry.id != null && (
              <button
                type="button"
                className="tp-rail-action-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/trip/${encodeURIComponent(tripId)}/stop/${entry.id}/edit`);
                }}
                aria-label="編輯景點"
                title="編輯景點"
                data-testid={`timeline-rail-edit-${entry.id}`}
              >
                <Icon name="pencil" />
              </button>
            )}
            {/* v2.31.92：移除「置換景點」button（編輯景點已含此功能 path）+「收合」
                button（row click 已 toggle expand/collapse，重複 entry）。 */}
            <div className="tp-rail-action-spacer" />
            <button
              type="button"
              className="tp-rail-action-icon is-danger"
              onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
              aria-label="刪除景點"
              title="刪除景點"
              data-testid={`timeline-rail-delete-${entry.id}`}
            >
              <Icon name="trash" />
            </button>
          </div>
        </div>
      )}

      <StopLightbox
        open={lightboxOpen}
        entry={entry}
        onClose={() => setLightboxOpen(false)}
      />

      {/* 2026-07-07 stacking-context bug fix：原 inline modal（fixed inset:0
       * z:1000）在 desktop 2-col 下被祖先 transform/contain 困在左欄 stacking
       * context — backdrop 蓋不到右側 sticky 地圖、dialog 被地圖 panel 切掉。
       * 改用 shared ConfirmModal（createPortal 到 body + --z-modal 9000），
       * 與全站其他刪除 confirm（trip-notes / favorites / trips-list）同 pattern。 */}
      <ConfirmModal
        open={showDeleteConfirm}
        title="確認刪除？"
        message={`「${entryDisplayTitle}」將從行程中移除。此操作無法復原。`}
        warning={deleteError ?? undefined}
        confirmLabel="確認刪除"
        busy={deleting}
        onConfirm={() => void handleDeleteConfirm()}
        // deleting 中不可關（Escape/backdrop 也擋）— DELETE 失敗的 error 要留在
        // modal 裡顯示（對齊原 inline 版 !deleting guard；codex review P1）
        onCancel={() => { if (!deleting) setShowDeleteConfirm(false); }}
      />
    </>
  );
});

const TimelineRail = memo(function TimelineRail({ events, nowIndex = -1, dayId }: TimelineRailProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // PR-K：local order override — drag-end 後立即套用 optimistic order，等
  // backend PATCH 完成 + tp-entry-updated 觸發 refetch 再用 fresh data 覆蓋。
  const [orderOverride, setOrderOverride] = useState<number[] | null>(null);
  const tripId = useTripId();
  const allDays = useTripDays();
  // v2.24.0 γ.1：fetch segments → 為每對 entry 提供 segment row 給 TravelPill 啟用
  // tap-switch dialog。Hook listen tp-segment-updated + tp-entry-updated 自動 re-fetch。
  const { segmentMap, ready: segmentsReady } = useTripSegments(tripId);

  // PR-K dnd-kit sensors。includeTouch 拆 mouse/touch：桌機 MouseSensor 8px 即時
  // 拖曳（避免誤觸 click expand row），觸控走 TouchSensor 200ms 長按（快速垂直
  // 滑動仍可捲動），keyboard 走 sortable coordinate getter。
  const { sensors } = useDragDrop({ includeTouch: true, pointerActivationDistance: 8, sortable: true });

  // 套 order override (drag 後 optimistic) 重排 events
  const orderedEvents = useMemo(() => {
    if (!orderOverride) return events;
    const byId = new Map<number, TimelineEntryData>();
    events.forEach((e) => { if (e.id != null) byId.set(e.id, e); });
    const result: TimelineEntryData[] = [];
    orderOverride.forEach((id) => { const e = byId.get(id); if (e) result.push(e); });
    // 保險：events 有但 override 漏的 id 接在尾巴
    events.forEach((e) => { if (e.id != null && !orderOverride.includes(e.id)) result.push(e); });
    return result;
  }, [events, orderOverride]);

  // events prop 變動 → reset override（refetch 帶回 backend authoritative order）
  // v2.33.44 round 6a: useMemo() 內呼 setState 是 side-effect masquerading as memo
  // (React 19 concurrent / strict mode 會 fire twice + warning)。改 useEffect 正確路徑。
  const eventsKey = events.map((e) => e.id ?? -1).join(',');
  useEffect(() => { setOrderOverride(null); }, [eventsKey]);

  // 2026-07-06 self-healing 車程補算：刪除/搬日/複製/後端直寫（AI chat、import、
  // share clone、tp-* CLI）後，新相鄰 pair 缺 segment row（FK cascade 只刪舊
  // pair，新 pair 無人算）或換 POI 後 computed_at=NULL。render 時偵測缺口 →
  // 自動 day-scoped recompute，以缺口清單當 signature 防重（同缺口只試一次，
  // unhealable 缺座標 pair 不會被無關 mutation 反覆 re-arm）。其餘防護在
  // helper：in-flight dedup、唯讀 403 → 該 trip auto 停用、失敗靜默（fallback
  // 是 TravelPill ⚠ 手動鈕）。segmentsReady gate 防首次 render 空 map 誤判；
  // orderOverride gate 防 drag optimistic order 在 PATCH commit 前誤判新
  // adjacency 白燒一輪（perf review CRITICAL）。
  useEffect(() => {
    if (!tripId || !segmentsReady || orderOverride != null) return;
    // auto 只在 day scope 明確時打 — 解析不到 dayNum 不能放大成全 trip
    // recompute（47-pair trip ≈ 52 subrequests 貼 CF 50 上限，自動路徑
    // fail-open 方向錯誤；explicit 手動 ⚠ 才保留全 trip fallback）。
    const dayNum = dayNumFromId(allDays, dayId);
    if (dayNum == null) return;
    const gaps: string[] = [];
    for (let i = 1; i < orderedEvents.length; i++) {
      const prev = orderedEvents[i - 1];
      const curr = orderedEvents[i];
      if (prev?.id == null || curr?.id == null) continue;
      // 缺座標 pair 不進 gaps：backend recompute 對它無能為力（skip 不寫
      // row），觸發只會白燒該日全部 pair 的 Google 重算。user 補座標後
      // entry 資料變 → masterLat 有值 → 進 gaps → 自動補算，閉環成立。
      if (prev.masterLat == null || prev.masterLng == null
        || curr.masterLat == null || curr.masterLng == null) continue;
      const seg = segmentMap.get(`${prev.id}-${curr.id}`);
      if (!seg || seg.computedAt == null) gaps.push(`${prev.id}-${curr.id}`);
    }
    if (gaps.length === 0) return;
    void requestTravelRecompute(tripId, dayNum, {
      auto: true,
      signature: gaps.join(','),
    });
  }, [tripId, segmentsReady, orderOverride, segmentMap, orderedEvents, dayId, allDays]);

  const handleDragEnd = useCallback(async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = orderedEvents.findIndex((ev, i) => (ev.id ?? `idx-${i}`) === active.id);
    const newIdx = orderedEvents.findIndex((ev, i) => (ev.id ?? `idx-${i}`) === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(orderedEvents, oldIdx, newIdx);
    const newIds = reordered.map((ev) => ev.id).filter((id): id is number => id != null);
    setOrderOverride(newIds);
    if (!tripId) return;
    // Section 6/3：reorder 走 batch endpoint，避免 N+1 PATCH。drop 後一次送
    // 所有改變位置的 entry 的 sort_order，atomic 失敗 → revert override。
    try {
      const updates = newIds.map((id, idx) => ({ id, sort_order: idx }));
      const res = await apiFetchRaw(`/trips/${tripId}/entries/batch`, {
        method: 'PATCH',
        credentials: 'same-origin',
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) throw new Error(`batch reorder failed: ${res.status}`);
      // OSM PR (migration 0045)：reorder 後重新計算 entry travel — 兩個相鄰 entry
      // 的 driving / walking / transit 距離取決於順序，sort_order 變動 → 必須重算。
      // 走 fire-and-forget：travel 顯示是 secondary，重算失敗（API 503/no ORS key）
      // 不阻塞 UI 但 toast 提示 user 重排已存、travel 數字未更新，避免誤以為
      // reorder 沒生效（travel 是 user reorder 的視覺信號）。
      // 2026-07-06 perf review：rail 內拖曳只改本日 adjacency（segment pair 嚴格
      // 同日），day-scope 化省掉其他天的 Google 重算；dayNum 解析不到才退全 trip。
      requestTravelRecompute(tripId, dayNumFromId(allDays, dayId))
        .catch(() => {
          showToast('順序已儲存，但車程時間更新失敗，重新整理後再試', 'info');
        });
      window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, {
        detail: { tripId, entryId: active.id, reordered: true, travelRecomputeRequested: true },
      }));
    } catch {
      setOrderOverride(null);
    }
  }, [orderedEvents, tripId, allDays, dayId]);

  // Recompute travel on demand（TravelPill ⚠「重新計算」trigger）。
  // fire-and-forget 對齊 drag-reorder 路徑；完成 dispatch tp-entry-updated 觸發 refetch。
  // In-flight guard：endpoint 不帶 day param 會跑全 trip；用 ref 同步檢查防快點 N× burn quota。
  // ?day=N scope：dayId → useTripDays() 找對應 dayNum，避免重算其他天 segments。
  const recomputePendingRef = useRef(false);
  const handleRecomputeTravel = useCallback(() => {
    if (!tripId || recomputePendingRef.current) return;
    recomputePendingRef.current = true;
    requestTravelRecompute(tripId, dayNumFromId(allDays, dayId))
      .then((data) => {
        // v2.30.12: 解析 response 給 user 精確 feedback。避免「重新計算」按了
        // 卻 0 段被算（座標缺、kill switch）變沉默成功 toast。
        const computed = data?.pairsComputed ?? 0;
        const missing = data?.pairsSkippedMissingCoords ?? 0;
        const errs = (data?.errorsDetail ?? []).length;
        if (computed === 0 && missing > 0) {
          showToast(`${missing} 段缺少景點座標無法計算，請補上經緯度`, 'info');
        } else if (computed === 0 && errs > 0) {
          showToast(`${errs} 段重算失敗（Google Routes API）`, 'info');
        } else if (computed === 0) {
          showToast('沒有可重算的車程', 'info');
        } else if (errs > 0 || missing > 0) {
          const skipped = missing + errs;
          showToast(`重算 ${computed} 段，${skipped} 段跳過`, 'info');
        } else {
          showToast(`已重新計算 ${computed} 段車程`, 'info');
        }
        window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, {
          detail: { tripId, travelRecomputeRequested: true },
        }));
      })
      .catch(() => {
        showToast('車程重新計算失敗，請稍後再試', 'info');
      })
      .finally(() => {
        recomputePendingRef.current = false;
      });
  }, [tripId, dayId, allDays]);

  if (!events || events.length === 0) return null;

  const firstTime = orderedEvents[0] ? parseEntryTime(orderedEvents[0]).start : '';
  const lastTime = orderedEvents[orderedEvents.length - 1]
    ? (parseEntryTime(orderedEvents[orderedEvents.length - 1]!).end || parseEntryTime(orderedEvents[orderedEvents.length - 1]!).start)
    : '';

  // PR-K：sortable items list — entry.id 或 fallback `idx-N`（disabled in RailRow）
  const sortableItems = orderedEvents.map((e, i) => e.id ?? `idx-${i}`);

  return (
    <div className="tp-rail">
      <style>{SCOPED_STYLES}</style>
      <div className="tp-rail-header">
        <span className="tp-rail-eyebrow">行程</span>
        <span className="tp-rail-meta">
          {orderedEvents.length} 個停留點{firstTime && lastTime ? ` · ${firstTime}–${lastTime}` : ''}
        </span>
      </div>
      <DndContext sensors={sensors} accessibility={TP_DRAG_ACCESSIBILITY} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
      <div className="tp-rail-body">
        {/* v2.33.60 round 14: 拔 <div.tp-rail-line> orphan — CSS 已 display:none，DOM 也清掉 */}
        {orderedEvents.map((entry, i) => {
          const isPast = nowIndex >= 0 && i < nowIndex;
          const isNow = nowIndex >= 0 && i === nowIndex;
          const isLast = i === orderedEvents.length - 1;
          const expanded = entry.id != null && expandedId === entry.id;
          // v2.24.0 γ.1：lookup segment for (prev, curr) pair
          const prev = i > 0 ? orderedEvents[i - 1] : null;
          // v2.31.8: `entry.travel` 在 backend _merge.ts 是 segmentsMap.get(from=eid) =
          // 「離開此 entry 到下一站」語意；UI pill 在 (prev → curr) 中間，意思是
          // 「抵達 curr 的旅程」。所以 fallback 要用 `prev.travel`（離開 prev = 抵達 curr）
          // 不是 `entry.travel`，否則 segments 還沒載入時會閃顯錯誤方向值。
          // segments 載入後 segment prop 覆蓋 → 正確值。
          const travelObj = prev?.travel && typeof prev.travel === 'object' ? prev.travel : null;
          const segment = (prev?.id != null && entry.id != null)
            ? segmentMap.get(`${prev.id}-${entry.id}`)
            : undefined;
          // 2026-07-06 車程重算缺口：pair 兩端都是真 entry 卻無 segment row 也無
          // legacy travel（刪除/搬日後的新 adjacency、或缺座標 pair 永遠算不出）
          // → 不能整顆 pill 消失（user 連 ⚠ 重算鈕都沒有，無從補救 — codex
          // review P1）。segments ready 後才判 missing，避免載入期閃 ⚠。
          const pairMissing = segmentsReady && !segment && !travelObj
            && prev?.id != null && entry.id != null;
          return (
            <div key={entry.id ?? i} className="tp-rail-row-wrap">
              {i > 0 && (travelObj || segment || pairMissing) && (
                <TravelPill
                  type={travelObj?.type ?? null}
                  desc={travelObj?.desc ?? null}
                  min={travelObj?.min ?? null}
                  distanceM={travelObj?.distanceM ?? null}
                  segment={segment ? {
                    id: segment.id,
                    mode: segment.mode,
                    min: segment.min,
                    distanceM: segment.distanceM,
                    computedAt: segment.computedAt,
                  } : undefined}
                  missing={pairMissing || undefined}
                  tripId={tripId}
                  fromName={prev ? getTimelineEntryDisplayTitle(prev) : null}
                  toName={getTimelineEntryDisplayTitle(entry)}
                  onRecompute={handleRecomputeTravel}
                />
              )}
              <RailRow
                entry={entry}
                index={i}
                expanded={expanded}
                onToggle={() => {
                  if (entry.id == null) return;
                  setExpandedId((cur) => (cur === entry.id ? null : entry.id ?? null));
                }}
                isPast={isPast}
                isNow={isNow}
                isLast={isLast}
                dayId={dayId}
              />
            </div>
          );
        })}
      </div>
        </SortableContext>
      </DndContext>
    </div>
  );
});

export default TimelineRail;
