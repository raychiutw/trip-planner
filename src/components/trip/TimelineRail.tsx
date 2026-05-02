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

import { memo, useCallback, useMemo, useState } from 'react';
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
import { TP_DRAG_ACCESSIBILITY } from '../../lib/drag-announcements';
import Icon from '../shared/Icon';
import { showToast } from '../shared/Toast';
import InlineError from '../shared/InlineError';
import MarkdownText from '../shared/MarkdownText';
import StopLightbox from './StopLightbox';
import EntryActionPopover, { type EntryActionConfirmPayload } from './EntryActionPopover';
import { Restaurant, type RestaurantData } from './Restaurant';
import TravelPill from './TravelPill';
import type { TimelineEntryData } from './TimelineEvent';
import { parseTimeRange, formatDuration, deriveTypeMeta } from '../../lib/timelineUtils';
import { useDragDrop } from '../../hooks/useDragDrop';

const SCOPED_STYLES = `
.tp-rail-detail {
  margin: 0 0 12px calc(48px + 16px);
  padding: 14px 16px;
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  display: flex; flex-direction: column; gap: 12px;
  animation: tp-rail-detail-in 160ms var(--transition-timing-function-apple, ease-out);
}
@media (max-width: 480px) {
  .tp-rail-detail { margin-left: 8px; }
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
.tp-rail-detail-locs {
  display: flex; flex-wrap: wrap; gap: 6px;
}
.tp-rail-detail-loc-chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: var(--font-size-footnote); color: var(--color-foreground);
  background: var(--color-background); border: 1px solid var(--color-border);
  padding: 6px 10px; border-radius: var(--radius-full);
  text-decoration: none; min-height: 32px;
}
.tp-rail-detail-loc-chip:hover { background: var(--color-accent-subtle); border-color: var(--color-accent-bg); color: var(--color-accent-deep); }

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
.tp-rail-note-error {
  font-size: var(--font-size-footnote); color: var(--color-destructive);
  margin-top: 4px;
}

.ocean-rail-head[aria-expanded="true"] .ocean-rail-caret { transform: rotate(90deg); color: var(--color-accent-deep); }
.ocean-rail-caret { transition: transform 120ms; display: inline-block; }

/* 2026-05-01 餐廳推薦 section — 顯示 entry.infoBoxes 中 type='restaurants' 的卡片。
 * 排序按 sortOrder 升冪：第一筆 hero（accent 邊框 + 漸層底），其餘 standard。
 * ≥2 家時前一張和後續間插「備選」divider。1 家走 standard 不分 hero/alt。
 * 全展開無收合（user 拍板）。 */
.tp-rail-rest-list { display: flex; flex-direction: column; gap: 8px; }
.tp-rail-rest-alt-heading {
  display: flex; align-items: center; gap: 10px;
  font-size: var(--font-size-eyebrow);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-muted);
  margin: 6px 0 -2px;
  padding-left: 2px;
}
.tp-rail-rest-alt-heading::after {
  content: ''; flex: 1; height: 1px; background: var(--color-border);
}
/* Restaurant.tsx 內的 .rest-card 預設 margin: 8px 0；放進 list 用 gap:8 控
 * 間距，這裡覆蓋 margin 為 0 避免 double spacing。 */
.tp-rail-rest-list .rest-card { margin: 0; }

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
  font: inherit; font-size: 16px;
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
.ocean-rail-grip {
  grid-column: 1;
  border: 0; background: transparent;
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px;
  cursor: grab;
  color: var(--color-muted);
  opacity: 0.4;
  border-radius: var(--radius-sm);
  touch-action: none;
  flex-shrink: 0;
  transition: color 120ms, opacity 160ms;
}
.ocean-rail-row-wrap:hover .ocean-rail-grip,
.ocean-rail-grip:hover,
.ocean-rail-grip:focus-visible {
  opacity: 1;
  color: var(--color-accent);
}
.ocean-rail-grip:active { cursor: grabbing; }
.ocean-rail-grip .svg-icon { width: 16px; height: 16px; }
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

const RailRow = memo(function RailRow({ entry, index, expanded, onToggle, isPast, isNow, isLast, dayId }: RailRowProps) {
  const tripId = useTripId();
  const allDays = useTripDays();
  const parsed = parseTimeRange(entry.time);
  const meta = deriveTypeMeta(entry);

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

  const [editingNote, setEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [popoverAction, setPopoverAction] = useState<'copy' | 'move' | null>(null);
  // Section 4.5 (terracotta-ui-parity-polish): 取代 window.confirm 為 ConfirmModal pattern
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const beginEditNote = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setDraftNote(entry.note ?? '');
    setSaveError(null);
    setEditingNote(true);
  };

  const cancelEditNote = useCallback(() => {
    setEditingNote(false);
    setDraftNote('');
    setSaveError(null);
  }, []);

  const saveNote = useCallback(async () => {
    if (!tripId || entryIdNum == null) return;
    setSavingNote(true);
    setSaveError(null);
    try {
      const res = await apiFetchRaw(`/trips/${tripId}/entries/${entryIdNum}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        body: JSON.stringify({ note: draftNote }),
      });
      if (!res.ok) throw new Error('儲存失敗');
      setEditingNote(false);
      window.dispatchEvent(new CustomEvent('tp-entry-updated', {
        detail: { tripId, entryId: entryIdNum },
      }));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setSavingNote(false);
    }
  }, [tripId, entryIdNum, draftNote]);

  const handleNoteKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditNote();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void saveNote();
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
      window.dispatchEvent(new CustomEvent('tp-entry-updated', {
        detail: { tripId, entryId: entryIdNum },
      }));
      setShowDeleteConfirm(false);
    } catch (err) {
      // 顯示錯誤但保留 modal 開啟讓 user 重試
      setSaveError(err instanceof Error ? err.message : '刪除失敗');
    } finally {
      setDeleting(false);
    }
  }, [tripId, entryIdNum]);

  // v2.10 Wave 1: copy / move handler — popover onConfirm callback。
  // copy → POST /trips/:id/entries/:eid/copy ；move → PATCH /trips/:id/entries/:eid。
  const handleCopyOrMove = useCallback(async ({ targetDayId }: EntryActionConfirmPayload) => {
    if (!tripId || entryIdNum == null || popoverAction == null) return;
    const path = popoverAction === 'copy'
      ? `/trips/${tripId}/entries/${entryIdNum}/copy`
      : `/trips/${tripId}/entries/${entryIdNum}`;
    const method = popoverAction === 'copy' ? 'POST' : 'PATCH';
    const body = popoverAction === 'copy'
      ? JSON.stringify({ targetDayId })
      : JSON.stringify({ day_id: targetDayId });
    const res = await apiFetchRaw(path, {
      method,
      credentials: 'same-origin',
      body,
    });
    if (!res.ok) throw new Error(popoverAction === 'copy' ? '複製失敗' : '移動失敗');
    window.dispatchEvent(new CustomEvent('tp-entry-updated', {
      detail: { tripId, entryId: entryIdNum },
    }));
  }, [tripId, entryIdNum, popoverAction]);

  const hasDescription = !!entry.description?.trim();
  const hasLocations = !!entry.locations && entry.locations.length > 0;
  const hasNote = !!entry.note?.trim();

  // 2026-05-01 餐廳推薦 — 從 infoBoxes 取出 type='restaurants' 並按 sortOrder 升冪。
  // 1 家：standard variant；≥2 家：第一筆 hero + 後續 standard（中間插「備選」divider）
  const sortedRestaurants: RestaurantData[] = useMemo(() => {
    const box = entry.infoBoxes?.find((b) => b.type === 'restaurants');
    const items = box?.restaurants ?? [];
    return [...items].sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  }, [entry.infoBoxes]);
  const hasRestaurants = sortedRestaurants.length > 0;

  return (
    <>
      <div
        ref={sortable.setNodeRef}
        style={sortableStyle}
        className="ocean-rail-item"
        data-now={isNow || undefined}
        data-past={isPast || undefined}
        data-accent={meta.accent || undefined}
        data-last={isLast || undefined}
        data-scroll-anchor={entry.id != null ? `entry-${entry.id}` : undefined}
      >
        {/* mockup S12 Variant A 5 欄 grid: grip(24) | time+dur(60) | icon(44) | content | caret(24)
         * 2026-05-01: grip 移到 col 1（首子元素）+ time 包進 stack 加 dur 副行 +
         * 移除 .ocean-rail-dot 編號圓圈（mockup 沒有此元素，與 grip 視覺競爭）。 */}
        <button
          type="button"
          className="ocean-rail-grip"
          {...sortable.listeners}
          {...sortable.attributes}
          aria-label={`拖拉排序：${entry.title ?? '（無標題）'}`}
          data-testid={entry.id != null ? `timeline-rail-grip-${entry.id}` : undefined}
        >
          <Icon name="grip" />
        </button>
        {(() => {
          const durLabel = formatDuration(parsed.duration);
          return (
            <span className="ocean-rail-time-stack">
              <span className="ocean-rail-time">{parsed.start}</span>
              {durLabel && <span className="ocean-rail-dur">{durLabel}</span>}
            </span>
          );
        })()}
        <button
          type="button"
          className="ocean-rail-head"
          onClick={onToggle}
          disabled={!canExpand}
          aria-expanded={canExpand ? expanded : undefined}
          aria-label={`${expanded ? '收合' : '展開'}景點：${entry.title ?? '（無標題）'}`}
          data-testid={entry.id != null ? `timeline-rail-row-${entry.id}` : undefined}
        >
          <span className="ocean-rail-icon" aria-hidden="true">
            <Icon name={meta.icon} />
          </span>
          <span className="ocean-rail-content">
            <span className="ocean-rail-chip">{meta.label}</span>
            <span className="ocean-rail-name">{entry.title ?? ''}</span>
            {typeof entry.googleRating === 'number' && (
              <span className="ocean-rail-sub">
                <span>★ {entry.googleRating.toFixed(1)}</span>
              </span>
            )}
          </span>
          <span className="ocean-rail-caret" aria-hidden="true">›</span>
        </button>
      </div>

      {expanded && entry.id != null && (
        <div className="tp-rail-detail" data-testid={`timeline-rail-detail-${entry.id}`}>
          {hasDescription && (
            <div className="tp-rail-detail-section">
              <h4>說明</h4>
              {entry.description && <MarkdownText text={entry.description} as="p" className="tp-rail-detail-desc" />}
            </div>
          )}

          {hasLocations && entry.locations && (
            <div className="tp-rail-detail-section">
              <h4>地點</h4>
              <div className="tp-rail-detail-locs">
                {entry.locations.map((loc, i) => {
                  const display = loc.label || loc.name || loc.googleQuery || '地點';
                  const query = loc.googleQuery || loc.url || loc.label || loc.name || '';
                  const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
                  return (
                    <a
                      key={`${display}-${i}`}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tp-rail-detail-loc-chip"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Icon name="map" />
                      <span>{display}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {hasRestaurants && (
            <div className="tp-rail-detail-section">
              <h4>餐廳推薦</h4>
              <div className="tp-rail-rest-list" data-testid={`timeline-rail-rest-${entry.id}`}>
                {sortedRestaurants.map((r, i) => {
                  const isHero = sortedRestaurants.length > 1 && i === 0;
                  const showAltDivider = sortedRestaurants.length > 1 && i === 1;
                  return (
                    <div key={`${r.name}-${i}`} onClick={(e) => e.stopPropagation()}>
                      {showAltDivider && <h5 className="tp-rail-rest-alt-heading">備選</h5>}
                      <Restaurant restaurant={r} variant={isHero ? 'hero' : 'standard'} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="tp-rail-detail-section">
            <h4>備註</h4>
            {editingNote ? (
              <>
                <textarea
                  className="tp-rail-note-input"
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  onKeyDown={handleNoteKey}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  data-testid={`timeline-rail-note-input-${entry.id}`}
                />
                <div className="tp-rail-note-actions">
                  <button
                    type="button"
                    className="tp-rail-note-save"
                    onClick={(e) => { e.stopPropagation(); void saveNote(); }}
                    disabled={savingNote}
                    data-testid={`timeline-rail-note-save-${entry.id}`}
                  >
                    {savingNote ? '儲存中…' : '儲存'}
                  </button>
                  <button
                    type="button"
                    className="tp-rail-note-cancel"
                    onClick={(e) => { e.stopPropagation(); cancelEditNote(); }}
                    disabled={savingNote}
                    data-testid={`timeline-rail-note-cancel-${entry.id}`}
                  >
                    取消
                  </button>
                  <span className="tp-rail-note-kbd">
                    <kbd>⌘</kbd> + <kbd>↩</kbd> 儲存 · <kbd>esc</kbd> 取消
                  </span>
                </div>
                {saveError && <InlineError message={saveError} />}
              </>
            ) : (
              <div
                className={clsx('tp-rail-note-value', !hasNote && 'is-empty')}
                onClick={beginEditNote}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    beginEditNote(e);
                  }
                }}
                data-testid={`timeline-rail-note-value-${entry.id}`}
              >
                {hasNote ? entry.note : '+ 加備註'}
              </div>
            )}
          </div>

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
                  onClick={(e) => { e.stopPropagation(); setPopoverAction('copy'); }}
                  aria-label="複製到其他天"
                  title="複製到其他天"
                  data-testid={`timeline-rail-copy-open-${entry.id}`}
                >
                  <Icon name="copy" />
                </button>
                <button
                  type="button"
                  className="tp-rail-action-icon"
                  onClick={(e) => { e.stopPropagation(); setPopoverAction('move'); }}
                  aria-label="移到其他天"
                  title="移到其他天"
                  data-testid={`timeline-rail-move-open-${entry.id}`}
                >
                  <Icon name="arrows-vertical" />
                </button>
                {popoverAction != null && (
                  <EntryActionPopover
                    open
                    action={popoverAction}
                    days={allDays}
                    currentDayId={dayId}
                    onClose={() => setPopoverAction(null)}
                    onConfirm={handleCopyOrMove}
                  />
                )}
              </div>
            )}
            <button
              type="button"
              className="tp-rail-action-icon"
              onClick={(e) => { e.stopPropagation(); beginEditNote(e); }}
              aria-label="編輯備註"
              title="編輯備註"
              data-testid={`timeline-rail-edit-note-${entry.id}`}
            >
              <Icon name="pencil" />
            </button>
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
            <button
              type="button"
              className="tp-rail-action-icon"
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              aria-label="收合"
              title="收合"
              data-testid={`timeline-rail-collapse-${entry.id}`}
            >
              <Icon name="minimize" />
            </button>
          </div>
        </div>
      )}

      <StopLightbox
        open={lightboxOpen}
        entry={entry}
        onClose={() => setLightboxOpen(false)}
      />

      {/* Section 4.5 (terracotta-ui-parity-polish): destructive ConfirmModal
       * 取代 window.confirm。Sentry-friendly。 */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(20, 14, 9, 0.42)',
            display: 'grid', placeItems: 'center', padding: 20,
          }}
          role="presentation"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="確認刪除景點"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(420px, 100%)',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--color-background)',
              color: 'var(--color-foreground)',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--color-border)',
              padding: 18,
            }}
            data-testid={`timeline-rail-delete-modal-${entry.id}`}
          >
            <h3 style={{ margin: 0, fontSize: 'var(--font-size-title3)', fontWeight: 800 }}>
              確認刪除？
            </h3>
            <p style={{ margin: '10px 0 16px', fontSize: 'var(--font-size-callout)', color: 'var(--color-muted)' }}>
              「{entry.title || '此景點'}」將從行程中移除。此操作無法復原。
            </p>
            {saveError && (
              <p style={{ fontSize: 'var(--font-size-footnote)', color: 'var(--color-destructive)', margin: '0 0 8px' }}>
                {saveError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDeleteConfirm()}
                data-testid={`timeline-rail-delete-confirm-${entry.id}`}
                style={{
                  flex: 1, minWidth: 112, minHeight: 'var(--spacing-tap-min)',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--color-priority-high-dot, #c0392b)',
                  borderColor: 'var(--color-priority-high-dot, #c0392b)',
                  color: '#fff',
                  font: 'inherit', fontWeight: 800, fontSize: 'var(--font-size-footnote)',
                  cursor: 'pointer', border: '1px solid',
                }}
              >
                {deleting ? '刪除中…' : '確認刪除'}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteConfirm(false)}
                data-testid={`timeline-rail-delete-cancel-${entry.id}`}
                style={{
                  flex: 1, minWidth: 112, minHeight: 'var(--spacing-tap-min)',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--color-secondary)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-foreground)',
                  font: 'inherit', fontWeight: 800, fontSize: 'var(--font-size-footnote)',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

const TimelineRail = memo(function TimelineRail({ events, nowIndex = -1, dayId }: TimelineRailProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // PR-K：local order override — drag-end 後立即套用 optimistic order，等
  // backend PATCH 完成 + tp-entry-updated 觸發 refetch 再用 fresh data 覆蓋。
  const [orderOverride, setOrderOverride] = useState<number[] | null>(null);
  const tripId = useTripId();

  // PR-K dnd-kit sensors。pointer 8px activation distance 避免誤觸 (跟 click
  // expand row 衝突)，keyboard 走 sortable coordinate getter。
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
  const eventsKey = events.map((e) => e.id ?? -1).join(',');
  useMemo(() => { setOrderOverride(null); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [eventsKey]);

  const handleDragEnd = useCallback(async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = orderedEvents.findIndex((ev) => (ev.id ?? `idx-${ev.id}`) === active.id);
    const newIdx = orderedEvents.findIndex((ev) => (ev.id ?? `idx-${ev.id}`) === over.id);
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
      apiFetchRaw(`/trips/${tripId}/recompute-travel`, {
        method: 'POST',
        credentials: 'same-origin',
      })
        .then((res) => {
          if (!res.ok) throw new Error(`recompute-travel ${res.status}`);
        })
        .catch(() => {
          showToast('順序已儲存，但車程時間更新失敗，重新整理後再試', 'info');
        });
      window.dispatchEvent(new CustomEvent('tp-entry-updated', {
        detail: { tripId, entryId: active.id, reordered: true, travelRecomputeRequested: true },
      }));
    } catch {
      setOrderOverride(null);
    }
  }, [orderedEvents, tripId]);

  if (!events || events.length === 0) return null;

  const firstTime = parseTimeRange(orderedEvents[0]?.time).start;
  const lastTime = parseTimeRange(orderedEvents[orderedEvents.length - 1]?.time).end ||
                   parseTimeRange(orderedEvents[orderedEvents.length - 1]?.time).start;

  // PR-K：sortable items list — entry.id 或 fallback `idx-N`（disabled in RailRow）
  const sortableItems = orderedEvents.map((e, i) => e.id ?? `idx-${i}`);

  return (
    <div className="ocean-rail">
      <style>{SCOPED_STYLES}</style>
      <div className="ocean-rail-header">
        <span className="ocean-rail-eyebrow">Itinerary</span>
        <span className="ocean-rail-meta">
          {orderedEvents.length} stops{firstTime && lastTime ? ` · ${firstTime}–${lastTime}` : ''}
        </span>
      </div>
      <DndContext sensors={sensors} accessibility={TP_DRAG_ACCESSIBILITY} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
      <div className="ocean-rail-body">
        <div className="ocean-rail-line" aria-hidden="true" />
        {orderedEvents.map((entry, i) => {
          const isPast = nowIndex >= 0 && i < nowIndex;
          const isNow = nowIndex >= 0 && i === nowIndex;
          const isLast = i === events.length - 1;
          const expanded = entry.id != null && expandedId === entry.id;
          const travelObj = entry.travel && typeof entry.travel === 'object' ? entry.travel : null;
          return (
            <div key={entry.id ?? i} className="ocean-rail-row-wrap">
              {i > 0 && travelObj && (
                <TravelPill
                  type={travelObj.type ?? null}
                  desc={travelObj.desc ?? null}
                  min={travelObj.min ?? null}
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
