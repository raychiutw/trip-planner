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

import { memo, useCallback, useState } from 'react';
import clsx from 'clsx';
import { useTripId } from '../../contexts/TripIdContext';
import { useTripDays } from '../../contexts/TripDaysContext';
import { apiFetchRaw } from '../../lib/apiClient';
import Icon from '../shared/Icon';
import MarkdownText from '../shared/MarkdownText';
import StopLightbox from './StopLightbox';
import EntryActionPopover, { type EntryActionConfirmPayload } from './EntryActionPopover';
import type { TimelineEntryData } from './TimelineEvent';
import { parseTimeRange, formatDuration, deriveTypeMeta } from '../../lib/timelineUtils';

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

.tp-rail-actions {
  display: flex; gap: 6px; flex-wrap: wrap;
  margin-bottom: 4px;
}
.tp-rail-action-btn {
  font: inherit; font-size: var(--font-size-footnote); font-weight: 600;
  padding: 8px 14px; border-radius: var(--radius-full);
  background: var(--color-accent-subtle); color: var(--color-accent-deep);
  border: 1.5px solid var(--color-accent-bg); cursor: pointer;
  /* H4 — primary action chip, 44px tap target */
  min-height: var(--spacing-tap-min);
  display: inline-flex; align-items: center; gap: 6px;
}
.tp-rail-action-btn:hover {
  background: var(--color-accent); color: var(--color-accent-foreground); border-color: var(--color-accent);
}
.tp-rail-action-spacer { flex: 1; }
.tp-rail-action-icon {
  /* v2.10 Wave 1: ⎘ ⇅ icon-only buttons. relative for popover absolute pos. */
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
`;

interface TimelineRailProps {
  events: TimelineEntryData[];
  /** Activate "now" indicator for this index */
  nowIndex?: number;
  /** v2.10 Wave 1: trip_days.id for current day — passed to RailRow for ⎘/⇅
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
  const canExpand = entry.id != null;
  const entryIdNum = entry.id ?? null;

  const [editingNote, setEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [popoverAction, setPopoverAction] = useState<'copy' | 'move' | null>(null);

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

  // QA 2026-04-26 BUG-012：mockup .iconbtn.sm.danger 🗑 delete handler。
  // 走既有 DELETE /api/trips/:id/entries/:eid → cascade delete trip_pois。
  // 用 native confirm() 確認（避免誤觸），成功後 dispatch event 觸發 refetch。
  const handleDelete = useCallback(async () => {
    if (!tripId || entryIdNum == null) return;
    if (!window.confirm(`確定刪除「${entry.title || '此景點'}」？此操作無法復原。`)) return;
    try {
      const res = await apiFetchRaw(`/trips/${tripId}/entries/${entryIdNum}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('刪除失敗');
      window.dispatchEvent(new CustomEvent('tp-entry-updated', {
        detail: { tripId, entryId: entryIdNum },
      }));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '刪除失敗');
    }
  }, [tripId, entryIdNum, entry.title]);

  // v2.10 Wave 1: ⎘ copy / ⇅ move handler — popover onConfirm callback。
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

  return (
    <>
      <div
        className="ocean-rail-item"
        data-now={isNow || undefined}
        data-past={isPast || undefined}
        data-accent={meta.accent || undefined}
        data-last={isLast || undefined}
        data-scroll-anchor={entry.id != null ? `entry-${entry.id}` : undefined}
      >
        <span className="ocean-rail-time">{parsed.start}</span>
        <span className="ocean-rail-dot" aria-hidden="true">{index + 1}</span>
        <button
          type="button"
          className="ocean-rail-head"
          onClick={onToggle}
          disabled={!canExpand}
          aria-expanded={canExpand ? expanded : undefined}
          aria-label={`${expanded ? '收闔' : '展開'}景點：${entry.title ?? '（無標題）'}`}
          data-testid={entry.id != null ? `timeline-rail-row-${entry.id}` : undefined}
        >
          <span className="ocean-rail-icon" aria-hidden="true">
            <Icon name={meta.icon} />
          </span>
          <span className="ocean-rail-content">
            <span className="ocean-rail-name">{entry.title ?? ''}</span>
            <span className="ocean-rail-sub">
              <span className="ocean-rail-type">{meta.label}</span>
              {formatDuration(parsed.duration) && (
                <>
                  <span className="ocean-rail-sep">·</span>
                  <span>{formatDuration(parsed.duration)}</span>
                </>
              )}
              {typeof entry.googleRating === 'number' && (
                <>
                  <span className="ocean-rail-sep">·</span>
                  <span>★ {entry.googleRating.toFixed(1)}</span>
                </>
              )}
            </span>
          </span>
          <span className="ocean-rail-caret" aria-hidden="true">›</span>
        </button>
      </div>

      {expanded && entry.id != null && (
        <div className="tp-rail-detail" data-testid={`timeline-rail-detail-${entry.id}`}>
          <div className="tp-rail-actions">
            <button
              type="button"
              className="tp-rail-action-btn"
              onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
              aria-label="放大檢視"
              data-testid={`timeline-rail-lightbox-open-${entry.id}`}
            >
              <span aria-hidden="true">⛶</span>
              <span>放大檢視</span>
            </button>
            <div className="tp-rail-action-spacer" />
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
                  ⎘
                </button>
                <button
                  type="button"
                  className="tp-rail-action-icon"
                  onClick={(e) => { e.stopPropagation(); setPopoverAction('move'); }}
                  aria-label="移到其他天"
                  title="移到其他天"
                  data-testid={`timeline-rail-move-open-${entry.id}`}
                >
                  ⇅
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
            {/* QA 2026-04-26 BUG-012：mockup 規範 4 個 icon button — 🗑 delete
             * + ✕ collapse 不論單天/多天都顯示（每個 entry 都該能刪/收闔）。 */}
            <button
              type="button"
              className="tp-rail-action-icon is-danger"
              onClick={(e) => { e.stopPropagation(); void handleDelete(); }}
              aria-label="刪除景點"
              title="刪除景點"
              data-testid={`timeline-rail-delete-${entry.id}`}
            >
              🗑
            </button>
            <button
              type="button"
              className="tp-rail-action-icon"
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              aria-label="收闔"
              title="收闔"
              data-testid={`timeline-rail-collapse-${entry.id}`}
            >
              ✕
            </button>
          </div>

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
                {saveError && <p className="tp-rail-note-error" role="alert">{saveError}</p>}
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
        </div>
      )}

      <StopLightbox
        open={lightboxOpen}
        entry={entry}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
});

const TimelineRail = memo(function TimelineRail({ events, nowIndex = -1, dayId }: TimelineRailProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!events || events.length === 0) return null;

  const firstTime = parseTimeRange(events[0]?.time).start;
  const lastTime = parseTimeRange(events[events.length - 1]?.time).end ||
                   parseTimeRange(events[events.length - 1]?.time).start;

  return (
    <div className="ocean-rail">
      <style>{SCOPED_STYLES}</style>
      <div className="ocean-rail-header">
        <span className="ocean-rail-eyebrow">Itinerary</span>
        <span className="ocean-rail-meta">
          {events.length} stops{firstTime && lastTime ? ` · ${firstTime}–${lastTime}` : ''}
        </span>
      </div>
      <div className="ocean-rail-body">
        <div className="ocean-rail-line" aria-hidden="true" />
        {events.map((entry, i) => {
          const isPast = nowIndex >= 0 && i < nowIndex;
          const isNow = nowIndex >= 0 && i === nowIndex;
          const isLast = i === events.length - 1;
          const expanded = entry.id != null && expandedId === entry.id;
          return (
            <RailRow
              key={entry.id ?? i}
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
          );
        })}
      </div>
    </div>
  );
});

export default TimelineRail;
