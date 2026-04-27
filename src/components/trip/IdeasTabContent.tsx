/**
 * IdeasTabContent — TripSheet 的 Ideas tab real UI（B-P5 / B-P6 task 4.1 + 6.6）
 *
 * Source: GET /api/trip-ideas?tripId=...
 * Actions:
 *   - 「+ Day N」text-based promote — POST /api/trips/:id/days/:num/entries +
 *     PATCH /api/trip-ideas/:id { promotedToEntryId }
 *   - **Drag-to-promote**（B-P5 Phase 2）— 拖 idea card 到頂部 Day badge 觸發同樣
 *     promote API；drop targets 只在拖動時顯示
 *   - 「移除」DELETE /api/trip-ideas/:id（soft delete via archived_at）
 *
 * dnd-kit lazy load via React.lazy on this file (TripSheet wraps in lazy())。
 * 不含：reorder ideas / cross-day move / demote / undo toast
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { apiFetchRaw } from '../../lib/apiClient';
import {
  findFirstTimeConflict,
  getExplicitSlotPlacement,
  getSmartPlacement,
  type DragScheduleEntry,
  type SmartPlacement,
} from '../../lib/drag-strategy';
import { useDragDrop } from '../../hooks/useDragDrop';
import { TP_DRAG_ACCESSIBILITY } from '../../lib/drag-announcements';
import Icon from '../shared/Icon';
import ConflictModal from './ConflictModal';
import UndoToast from './UndoToast';
import type { TripIdea } from '../../types/api';

const SCOPED_STYLES = `
.tp-ideas-list {
  flex: 1; min-height: 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: 8px;
  padding: 16px;
}
.tp-idea-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  background: var(--color-background);
  display: flex; flex-direction: column; gap: 6px;
  cursor: grab;
  user-select: none;
}
.tp-idea-card:active { cursor: grabbing; }
.tp-idea-card.is-dragging { opacity: 0.4; }
.tp-idea-card-header {
  display: flex; align-items: flex-start; gap: 8px;
  font-size: var(--font-size-callout); font-weight: 600;
  color: var(--color-foreground);
}
.tp-idea-card-meta {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  display: flex; gap: 8px; flex-wrap: wrap;
}
.tp-idea-card-actions {
  display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;
}
.tp-idea-card-action {
  font: inherit; font-size: var(--font-size-footnote); font-weight: 500;
  padding: 4px 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-background); color: var(--color-foreground);
  cursor: pointer; min-height: var(--spacing-tap-min);
}
.tp-idea-card-action:hover { border-color: var(--color-accent); color: var(--color-accent); }
.tp-idea-card-action.is-danger:hover { border-color: var(--color-destructive); color: var(--color-destructive); }
.tp-idea-card-action[disabled] { opacity: 0.5; cursor: not-allowed; }
.tp-idea-card-promoted {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  font-style: italic;
}
.tp-ideas-empty {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 48px 24px; text-align: center;
  color: var(--color-muted);
}
.tp-ideas-empty .eyebrow {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.22em; text-transform: uppercase;
}
.tp-ideas-empty h3 {
  font-size: var(--font-size-title3); font-weight: 700;
  letter-spacing: -0.01em; color: var(--color-foreground);
}
.tp-ideas-empty p { font-size: var(--font-size-callout); max-width: 320px; }
.tp-ideas-status {
  font-size: var(--font-size-footnote); color: var(--color-muted);
  padding: 8px 16px;
}
.tp-ideas-status-error {
  display: flex; align-items: center; gap: 6px;
  color: var(--color-destructive);
}
.tp-ideas-status-error .svg-icon { width: 14px; height: 14px; flex-shrink: 0; }
.tp-ideas-drop-row {
  display: flex; gap: 8px; flex-wrap: wrap;
  padding: 12px 16px;
  background: var(--color-accent-subtle);
  border-bottom: 1px solid var(--color-border);
  position: sticky; top: 0; z-index: 5;
}
.tp-ideas-drop-row > .label {
  font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-accent); align-self: center;
}
.tp-day-drop-badge {
  padding: 6px 14px;
  border-radius: var(--radius-md);
  background: var(--color-background);
  border: 2px dashed var(--color-accent);
  font-size: var(--font-size-callout); font-weight: 600;
  color: var(--color-accent);
  transition: background-color 120ms;
}
.tp-day-drop-badge.is-over {
  background: var(--color-accent);
  color: var(--color-accent-foreground);
}
.tp-day-drop-zone {
  display: flex; flex-direction: column; gap: 6px;
}
.tp-day-slot-row {
  display: flex; gap: 4px; flex-wrap: wrap;
}
.tp-day-slot-chip {
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background: var(--color-background);
  border: 1px dashed var(--color-border);
  font-size: var(--font-size-caption);
  font-weight: 700;
  color: var(--color-muted);
  transition: background-color 120ms, border-color 120ms, color 120ms;
}
.tp-day-slot-chip.is-over {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-accent-foreground);
}
/* Section 7 task 7.1: DragOverlay ghost — 0.95x 縮放 + 強化 shadow + 2deg tilt
 * 表「舉起」 affordance（Mindtrip / Notion pattern）。 */
.tp-idea-card-overlay {
  transform: scale(0.95) rotate(2deg);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.12);
  cursor: grabbing;
  border-color: var(--color-accent);
  background: var(--color-background);
}
@media (prefers-reduced-motion: reduce) {
  .tp-idea-card-overlay { transform: none; }
}
`;

function ideaDragId(id: number): string { return `idea-${id}`; }
function dayDropId(num: number): string { return `day-${num}`; }
function daySlotDropId(num: number, startTime: string): string { return `day-${num}-slot-${startTime.replace(':', '')}`; }
function parseIdeaDragId(id: string): number | null {
  const m = id.match(/^idea-(\d+)$/);
  return m ? Number(m[1]) : null;
}
function parseDayDropId(id: string): number | null {
  const m = id.match(/^day-(\d+)$/);
  return m ? Number(m[1]) : null;
}
function parseDaySlotDropId(id: string): { dayNum: number; explicitStartTime: string } | null {
  const m = id.match(/^day-(\d+)-slot-(\d{2})(\d{2})$/);
  return m ? { dayNum: Number(m[1]), explicitStartTime: `${m[2]}:${m[3]}` } : null;
}

const PROMOTE_TIME_SLOTS = [
  { startTime: '09:00', label: '09' },
  { startTime: '12:00', label: '12' },
  { startTime: '14:00', label: '14' },
  { startTime: '18:00', label: '18' },
] as const;

const ENTRY_POI_TYPES = new Set(['hotel', 'restaurant', 'shopping', 'parking', 'attraction', 'transport', 'activity', 'other']);

function normalizeEntryPoiType(type: string | null | undefined): string {
  if (!type) return 'attraction';
  if (ENTRY_POI_TYPES.has(type)) return type;
  if (type === 'sight') return 'attraction';
  return 'other';
}

type DayTimelineResponse = {
  timeline?: Array<{
    id?: number | string | null;
    title?: string | null;
    time?: string | null;
    sortOrder?: number | null;
    sort_order?: number | null;
    orderInDay?: number | null;
    order_in_day?: number | null;
  }>;
};

function normalizeTimelineEntry(entry: NonNullable<DayTimelineResponse['timeline']>[number]): DragScheduleEntry {
  return {
    id: entry.id,
    title: entry.title,
    time: entry.time,
    sortOrder: entry.sortOrder ?? entry.sort_order ?? null,
    orderInDay: entry.orderInDay ?? entry.order_in_day ?? null,
  };
}

interface DraggableIdeaCardProps {
  idea: TripIdea;
  busy: boolean;
  isDragging: boolean;
  children: React.ReactNode;
}

function DraggableIdeaCard({ idea, busy, isDragging, children }: DraggableIdeaCardProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: ideaDragId(idea.id),
    disabled: busy || !!idea.promotedToEntryId || !idea.poiId,
  });
  return (
    <li
      ref={setNodeRef}
      className={`tp-idea-card${isDragging ? ' is-dragging' : ''}`}
      {...attributes}
      {...listeners}
      data-testid={`idea-card-${idea.id}`}
    >
      {children}
    </li>
  );
}

function DroppableDayBadge({ num }: { num: number }) {
  const { isOver, setNodeRef } = useDroppable({ id: dayDropId(num) });
  return (
    <div
      ref={setNodeRef}
      className={`tp-day-drop-badge${isOver ? ' is-over' : ''}`}
      data-testid={`day-drop-${num}`}
    >
      Day {num}
    </div>
  );
}

function DroppableDaySlot({ num, startTime, label }: { num: number; startTime: string; label: string }) {
  const { isOver, setNodeRef } = useDroppable({ id: daySlotDropId(num, startTime) });
  return (
    <div
      ref={setNodeRef}
      className={`tp-day-slot-chip${isOver ? ' is-over' : ''}`}
      data-testid={`day-slot-drop-${num}-${startTime.replace(':', '')}`}
    >
      {label}:00
    </div>
  );
}

export interface IdeasTabContentProps {
  tripId: string;
  /** Optional：days available for promote dropdown / drop targets。空陣列時 promote 隱藏。 */
  dayNumbers?: number[];
}

interface PendingConflict {
  idea: TripIdea;
  dayNum: number;
  explicitStartTime: string;
  placement: SmartPlacement;
  entries: DragScheduleEntry[];
  conflictTitle?: string | null;
}

interface LastPromote {
  entryId: number;
  ideaId: number;
  dayNum: number;
  toastKey: number;
}

export default function IdeasTabContent({ tripId, dayNumbers = [] }: IdeasTabContentProps) {
  const [ideas, setIdeas] = useState<TripIdea[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null);
  const [lastPromote, setLastPromote] = useState<LastPromote | null>(null);

  const { sensors } = useDragDrop({ includeTouch: true, pointerActivationDistance: 4 });

  const reload = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetchRaw(`/trip-ideas?tripId=${encodeURIComponent(tripId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { ideas?: TripIdea[] };
      setIdeas(data.ideas ?? []);
    } catch (e) {
      setError((e as Error).message ?? '無法載入 ideas');
      setIdeas([]);
    }
  }, [tripId]);

  useEffect(() => { void reload(); }, [reload]);

  const handleDelete = useCallback(async (id: number) => {
    setBusyId(id);
    try {
      const res = await apiFetchRaw(`/trip-ideas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`DELETE failed: HTTP ${res.status}`);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }, [reload]);

  const loadDayEntries = useCallback(async (dayNum: number) => {
    try {
      const res = await apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/days/${dayNum}`);
      if (!res.ok) return [];
      const day = (await res.json()) as DayTimelineResponse;
      return (day.timeline ?? []).map(normalizeTimelineEntry);
    } catch {
      return [];
    }
  }, [tripId]);

  const commitPromote = useCallback(async (idea: TripIdea, dayNum: number, placement: SmartPlacement) => {
    const create = await apiFetchRaw(
      `/trips/${encodeURIComponent(tripId)}/days/${dayNum}/entries`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: idea.title,
          time: placement.time,
          sort_order: placement.sortOrder,
          poi_type: normalizeEntryPoiType(idea.poiType),
          note: idea.note ?? null,
          lat: idea.poiLat ?? null,
          lng: idea.poiLng ?? null,
        }),
      },
    );
    if (!create.ok) throw new Error(`promote create entry failed: ${create.status}`);
    const created = (await create.json()) as { id?: number };
    if (created?.id) {
      await apiFetchRaw(`/trip-ideas/${idea.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ promotedToEntryId: created.id }),
      });
      // Section 2.6: drag promote 後 5 秒 undo toast 視窗
      setLastPromote({ entryId: created.id, ideaId: idea.id, dayNum, toastKey: Date.now() });
    }
    await reload();
  }, [reload, tripId]);

  const handleUndoPromote = useCallback(async () => {
    const last = lastPromote;
    if (!last) return;
    setLastPromote(null);
    try {
      await apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/entries/${last.entryId}`, {
        method: 'DELETE',
      });
      await apiFetchRaw(`/trip-ideas/${last.ideaId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ promotedToEntryId: null }),
      });
      await reload();
    } catch (e) {
      setError((e as Error).message ?? 'undo 失敗');
    }
  }, [lastPromote, reload, tripId]);

  const handleUndoTimeout = useCallback(() => {
    setLastPromote(null);
  }, []);

  const handlePromote = useCallback(async (idea: TripIdea, dayNum: number, explicitStartTime?: string) => {
    if (!idea.poiId) {
      setError('此 idea 未綁 POI，無法直接 promote');
      return;
    }
    setBusyId(idea.id);
    try {
      const entries = await loadDayEntries(dayNum);
      const placement = explicitStartTime
        ? getExplicitSlotPlacement(explicitStartTime, entries)
        : getSmartPlacement(entries);
      if (explicitStartTime) {
        const conflict = findFirstTimeConflict(placement, entries);
        if (conflict) {
          setPendingConflict({
            idea,
            dayNum,
            explicitStartTime,
            placement,
            entries,
            conflictTitle: conflict.title,
          });
          return;
        }
      }
      await commitPromote(idea, dayNum, placement);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }, [commitPromote, loadDayEntries]);

  const handleConflictCancel = useCallback(() => {
    setPendingConflict(null);
  }, []);

  const handleConflictParallel = useCallback(() => {
    const pending = pendingConflict;
    if (!pending) return;
    setPendingConflict(null);
    setBusyId(pending.idea.id);
    void commitPromote(pending.idea, pending.dayNum, pending.placement)
      .catch((e) => setError((e as Error).message))
      .finally(() => setBusyId(null));
  }, [commitPromote, pendingConflict]);

  const handleConflictMoveAfter = useCallback(() => {
    const pending = pendingConflict;
    if (!pending) return;
    const placement = getSmartPlacement(pending.entries);
    setPendingConflict(null);
    setBusyId(pending.idea.id);
    void commitPromote(pending.idea, pending.dayNum, placement)
      .catch((e) => setError((e as Error).message))
      .finally(() => setBusyId(null));
  }, [commitPromote, pendingConflict]);

  const activeIdeas = useMemo(
    () => (ideas ?? []).filter((i) => !i.archivedAt),
    [ideas],
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveDragId(String(e.active.id));
  }, []);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveDragId(null);
    if (!e.over) return;
    const ideaId = parseIdeaDragId(String(e.active.id));
    const slot = parseDaySlotDropId(String(e.over.id));
    const dayNum = slot?.dayNum ?? parseDayDropId(String(e.over.id));
    if (ideaId === null || dayNum === null) return;
    const idea = activeIdeas.find((i) => i.id === ideaId);
    if (!idea) return;
    void handlePromote(idea, dayNum, slot?.explicitStartTime);
  }, [activeIdeas, handlePromote]);

  const draggedIdea = useMemo(
    () => {
      if (!activeDragId) return null;
      const id = parseIdeaDragId(activeDragId);
      return id !== null ? activeIdeas.find((i) => i.id === id) ?? null : null;
    },
    [activeDragId, activeIdeas],
  );

  return (
    <DndContext
      sensors={sensors}
      accessibility={TP_DRAG_ACCESSIBILITY}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragId(null)}
    >
      <style>{SCOPED_STYLES}</style>
      <ConflictModal
        open={pendingConflict != null}
        conflictTitle={pendingConflict?.conflictTitle}
        time={pendingConflict?.placement.time ?? ''}
        onMoveAfter={handleConflictMoveAfter}
        onParallel={handleConflictParallel}
        onCancel={handleConflictCancel}
      />
      <UndoToast
        open={lastPromote != null}
        message={lastPromote ? `已加入 Day ${lastPromote.dayNum}` : ''}
        onUndo={handleUndoPromote}
        onTimeout={handleUndoTimeout}
        resetKey={lastPromote?.toastKey}
      />
      {activeDragId && dayNumbers.length > 0 && (
        <div className="tp-ideas-drop-row" data-testid="ideas-drop-row">
          <span className="label">拖到日次以加入：</span>
          {dayNumbers.map((d) => (
            <div className="tp-day-drop-zone" key={d}>
              <DroppableDayBadge num={d} />
              <div className="tp-day-slot-row" aria-label={`Day ${d} time slots`}>
                {PROMOTE_TIME_SLOTS.map((slot) => (
                  <DroppableDaySlot
                    key={slot.startTime}
                    num={d}
                    startTime={slot.startTime}
                    label={slot.label}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {error && (
        <div className="tp-ideas-status tp-ideas-status-error" role="alert" data-testid="ideas-error">
          <Icon name="warning" />
          <span>{error}</span>
        </div>
      )}
      {ideas === null && (
        <div className="tp-ideas-status" data-testid="ideas-loading">載入中…</div>
      )}
      {ideas !== null && activeIdeas.length === 0 && (
        <div className="tp-ideas-empty" data-testid="ideas-empty">
          <div className="eyebrow">Ideas</div>
          <h3>還沒收藏任何想法</h3>
          <p>從探索頁加入想法，或直接從聊天告訴 AI「想加 X 餐廳」。</p>
        </div>
      )}
      {ideas !== null && activeIdeas.length > 0 && (
        <ul className="tp-ideas-list" data-testid="ideas-list">
          {activeIdeas.map((idea) => (
            <DraggableIdeaCard
              key={idea.id}
              idea={idea}
              busy={busyId === idea.id}
              isDragging={activeDragId === ideaDragId(idea.id)}
            >
              <div className="tp-idea-card-header">{idea.title}</div>
              {(idea.poiAddress || idea.poiType) && (
                <div className="tp-idea-card-meta">
                  {idea.poiType && <span>{idea.poiType}</span>}
                  {idea.poiAddress && <span>{idea.poiAddress}</span>}
                </div>
              )}
              {idea.note && <div className="tp-idea-card-meta">{idea.note}</div>}
              {idea.promotedToEntryId ? (
                <div className="tp-idea-card-promoted">
                  ✓ 已排入 entry #{idea.promotedToEntryId}
                </div>
              ) : (
                <div className="tp-idea-card-actions">
                  {idea.poiId && dayNumbers.length > 0 ? (
                    dayNumbers.map((d) => (
                      <button
                        key={d}
                        type="button"
                        className="tp-idea-card-action"
                        disabled={busyId === idea.id}
                        onClick={() => handlePromote(idea, d)}
                        data-testid={`ideas-promote-${idea.id}-day-${d}`}
                      >
                        + Day {d}
                      </button>
                    ))
                  ) : (
                    !idea.poiId && (
                      <span className="tp-idea-card-meta">（自由文字 idea，需先綁 POI 才能 promote）</span>
                    )
                  )}
                  <button
                    type="button"
                    className="tp-idea-card-action is-danger"
                    disabled={busyId === idea.id}
                    onClick={() => handleDelete(idea.id)}
                    data-testid={`ideas-delete-${idea.id}`}
                  >
                    移除
                  </button>
                </div>
              )}
            </DraggableIdeaCard>
          ))}
        </ul>
      )}
      <DragOverlay dropAnimation={null}>
        {draggedIdea ? (
          <div className="tp-idea-card tp-idea-card-overlay" data-testid="ideas-drag-overlay">
            <div className="tp-idea-card-header">{draggedIdea.title}</div>
            {draggedIdea.poiType && (
              <div className="tp-idea-card-meta"><span>{draggedIdea.poiType}</span></div>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
