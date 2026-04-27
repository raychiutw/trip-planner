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
 * 不含：reorder ideas / cross-day move / demote / conflict modal / undo toast / smart placement
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { apiFetchRaw } from '../../lib/apiClient';
import Icon from '../shared/Icon';
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
`;

function ideaDragId(id: number): string { return `idea-${id}`; }
function dayDropId(num: number): string { return `day-${num}`; }
function parseIdeaDragId(id: string): number | null {
  const m = id.match(/^idea-(\d+)$/);
  return m ? Number(m[1]) : null;
}
function parseDayDropId(id: string): number | null {
  const m = id.match(/^day-(\d+)$/);
  return m ? Number(m[1]) : null;
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

export interface IdeasTabContentProps {
  tripId: string;
  /** Optional：days available for promote dropdown / drop targets。空陣列時 promote 隱藏。 */
  dayNumbers?: number[];
}

export default function IdeasTabContent({ tripId, dayNumbers = [] }: IdeasTabContentProps) {
  const [ideas, setIdeas] = useState<TripIdea[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const reload = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetchRaw(`/api/trip-ideas?tripId=${encodeURIComponent(tripId)}`);
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
      const res = await apiFetchRaw(`/api/trip-ideas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`DELETE failed: HTTP ${res.status}`);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }, [reload]);

  const handlePromote = useCallback(async (idea: TripIdea, dayNum: number) => {
    if (!idea.poiId) {
      setError('此 idea 未綁 POI，無法直接 promote');
      return;
    }
    setBusyId(idea.id);
    try {
      const create = await apiFetchRaw(
        `/api/trips/${encodeURIComponent(tripId)}/days/${dayNum}/entries`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ poiId: idea.poiId, name: idea.title }),
        },
      );
      if (!create.ok) throw new Error(`promote create entry failed: ${create.status}`);
      const created = (await create.json()) as { id?: number };
      if (created?.id) {
        await apiFetchRaw(`/api/trip-ideas/${idea.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ promotedToEntryId: created.id }),
        });
      }
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }, [reload, tripId]);

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
    const dayNum = parseDayDropId(String(e.over.id));
    if (ideaId === null || dayNum === null) return;
    const idea = activeIdeas.find((i) => i.id === ideaId);
    if (!idea) return;
    void handlePromote(idea, dayNum);
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
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragId(null)}
    >
      <style>{SCOPED_STYLES}</style>
      {activeDragId && dayNumbers.length > 0 && (
        <div className="tp-ideas-drop-row" data-testid="ideas-drop-row">
          <span className="label">拖到日次以加入：</span>
          {dayNumbers.map((d) => <DroppableDayBadge key={d} num={d} />)}
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
      <DragOverlay>
        {draggedIdea ? (
          <div className="tp-idea-card" style={{ cursor: 'grabbing' }}>
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
