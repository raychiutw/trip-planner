/**
 * FlightsSection — 航班 section CRUD UI (v2.34.x 行程筆記 PR5)
 *
 * Props:
 *   tripId / items / onChange — items mutation 上拋給 parent (TripNotesPage)
 *   而非各自重新 fetch（單一 source of truth = TripNotesPage state）
 *
 * State per row:
 *   - display mode (default): 顯卡片式 boarding pass row
 *   - edit mode: 7 input fields 全展開 (airline / flight_no / depart_airport /
 *     arrive_airport / depart_at / arrive_at / note)
 *
 * Autosave (對齊 v2.33.108):
 *   - field blur → flush autosave hook → PATCH /flights/:id with expectedVersion
 *   - 成功 silent (無 toast 無 indicator)
 *   - 失敗 → AlertPanel persistent + retry (DESIGN.md L549)
 *   - STALE 409 → refetch list → retry
 *
 * Drag-reorder via @dnd-kit/sortable → PATCH /flights/reorder bulk
 */
import { useCallback, useState } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Icon from '../shared/Icon';
import AlertPanel from '../shared/AlertPanel';
import ConfirmModal from '../shared/ConfirmModal';
import { apiFetch } from '../../lib/apiClient';

export interface TripFlight {
  id: number;
  sortOrder: number;
  airline: string;
  flightNo: string;
  cabinClass: string;
  departAirport: string;
  arriveAirport: string;
  departAt: string;
  arriveAt: string;
  note: string;
  version: number;
}

interface FlightsSectionProps {
  tripId: string;
  items: TripFlight[];
  onChange: (next: TripFlight[]) => void;
}

const SCOPED_STYLES = `
.tp-notes-flight-rows { display: flex; flex-direction: column; gap: 0; }
.tp-notes-flight-row {
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  display: grid; grid-template-columns: 24px 1fr auto; gap: 12px;
  background: transparent;
  transition: background 150ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.tp-notes-flight-row:last-child { border-bottom: none; }
.tp-notes-flight-row:hover { background: var(--color-background); }
.tp-notes-flight-row.is-dragging { background: var(--color-tertiary); opacity: 0.7; }

.tp-notes-flight-grip {
  width: 24px; height: 24px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--color-line-strong);
  cursor: grab; opacity: 0;
  transition: opacity 150ms;
  background: transparent; border: none; padding: 0;
  margin-top: 6px;
}
.tp-notes-flight-row:hover .tp-notes-flight-grip,
.tp-notes-flight-row:focus-within .tp-notes-flight-grip { opacity: 1; }
.tp-notes-flight-grip:active { cursor: grabbing; }
.tp-notes-flight-grip .svg-icon { width: 14px; height: 14px; }

.tp-notes-flight-body { min-width: 0; }

/* Display mode — boarding pass layout */
.tp-notes-flight-airline-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.tp-notes-flight-airline {
  font-weight: 600; font-size: var(--font-size-footnote);
}
.tp-notes-flight-no {
  font-weight: 600; font-size: var(--font-size-footnote);
  color: var(--color-muted);
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}

.tp-notes-flight-route {
  display: grid; grid-template-columns: 1fr auto 1fr;
  align-items: center; gap: 16px;
}
.tp-notes-flight-stop { text-align: center; }
.tp-notes-flight-time {
  font-size: var(--font-size-title2); font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
.tp-notes-flight-airport {
  font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-muted); margin-top: 2px;
}
.tp-notes-flight-date {
  font-size: var(--font-size-caption); color: var(--color-muted); margin-top: 2px;
}
.tp-notes-flight-divider {
  display: flex; flex-direction: column; align-items: center;
  color: var(--color-line-strong);
  font-size: var(--font-size-caption2);
}
.tp-notes-flight-divider-line {
  width: 60px; height: 1px; background: var(--color-line-strong); position: relative;
}
.tp-notes-flight-divider-line::after {
  content: ''; position: absolute; right: -3px; top: -3px;
  border: 4px solid transparent; border-left-color: var(--color-line-strong);
}

.tp-notes-flight-note {
  margin-top: 8px;
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  word-break: break-word;
}

/* Edit mode */
.tp-notes-flight-row.is-editing {
  background: var(--color-background);
  box-shadow: 0 0 0 2px var(--color-accent);
  border-radius: var(--radius-md);
  margin: 6px 8px;
  padding: 12px;
  border: 1px solid transparent;
  /* v2.34.42 prod audit: 編輯模式拔右側 actions 欄，改 form 底下 .tp-btn 文字 button */
  grid-template-columns: 24px 1fr;
}
.tp-notes-flight-edit-actions {
  display: flex; justify-content: flex-end; gap: 8px;
  margin-top: 12px;
}
.tp-notes-flight-edit-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
}
.tp-notes-flight-edit-grid input,
.tp-notes-flight-edit-grid textarea {
  width: 100%; padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-background);
  color: var(--color-foreground);
  font-size: var(--font-size-subheadline);
  outline: none;
}
.tp-notes-flight-edit-grid input:focus,
.tp-notes-flight-edit-grid textarea:focus { border-color: var(--color-accent); }
.tp-notes-flight-edit-note { grid-column: 1 / -1; min-height: 48px; resize: vertical; }
.tp-notes-flight-edit-label {
  font-size: var(--font-size-caption); font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase; letter-spacing: 0.04em;
  margin-bottom: 4px;
}

.tp-notes-flight-actions {
  display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;
}
.tp-notes-flight-icon-btn {
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--color-muted);
  background: transparent; border: none;
  cursor: pointer;
  transition: background 150ms, color 150ms;
}
/* v2.34.44 PR44 user feedback: ghost style */
.tp-notes-flight-icon-btn { opacity: 0.7; }
.tp-notes-flight-icon-btn:hover { opacity: 1; color: var(--color-accent-deep); }
.tp-notes-flight-icon-btn.is-danger:hover { opacity: 1; color: var(--color-destructive); }
.tp-notes-flight-icon-btn .svg-icon { width: 16px; height: 16px; }

.tp-notes-add-row-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%;
  padding: 12px 16px;
  color: var(--color-muted);
  background: transparent; border: none;
  font-size: var(--font-size-footnote); font-weight: 600;
  min-height: 44px; cursor: pointer;
  transition: background 150ms, color 150ms;
}
.tp-notes-add-row-btn:hover { background: var(--color-accent-subtle); color: var(--color-accent-deep); }
`;

function formatDateTime(iso: string): { time: string; date: string } {
  if (!iso) return { time: '--:--', date: '' };
  // Accept "YYYY-MM-DDTHH:MM" or just "HH:MM"
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) {
    // Try HH:MM only
    if (/^\d{1,2}:\d{2}$/.test(iso)) return { time: iso, date: '' };
    return { time: iso, date: '' };
  }
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  const m = dt.getMonth() + 1;
  const d = dt.getDate();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return { time: `${hh}:${mm}`, date: `${m}/${d} (${weekdays[dt.getDay()]})` };
}

interface SortableFlightRowProps {
  flight: TripFlight;
  isEditing: boolean;
  onEdit: () => void;
  onSaveField: (field: keyof TripFlight, value: string) => void;
  onDelete: () => void;
}

function SortableFlightRow({ flight, isEditing, onEdit, onSaveField, onDelete }: SortableFlightRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: flight.id,
    disabled: isEditing,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const dep = formatDateTime(flight.departAt);
  const arr = formatDateTime(flight.arriveAt);

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className="tp-notes-flight-row is-editing" data-testid={`flight-row-${flight.id}`}>
        <div /> {/* no grip in edit mode */}
        <div className="tp-notes-flight-body">
          <div className="tp-notes-flight-edit-grid">
            <div>
              <div className="tp-notes-flight-edit-label">航空</div>
              <input
                type="text"
                defaultValue={flight.airline}
                onBlur={(e) => onSaveField('airline', e.target.value)}
                placeholder="例：中華航空"
                data-testid={`flight-input-airline-${flight.id}`}
              />
            </div>
            <div>
              <div className="tp-notes-flight-edit-label">航班</div>
              <input
                type="text"
                defaultValue={flight.flightNo}
                onBlur={(e) => onSaveField('flightNo', e.target.value)}
                placeholder="例：CI 120"
                data-testid={`flight-input-no-${flight.id}`}
              />
            </div>
            <div>
              <div className="tp-notes-flight-edit-label">出發機場</div>
              <input
                type="text"
                defaultValue={flight.departAirport}
                onBlur={(e) => onSaveField('departAirport', e.target.value)}
                placeholder="例：TPE 桃園"
              />
            </div>
            <div>
              <div className="tp-notes-flight-edit-label">抵達機場</div>
              <input
                type="text"
                defaultValue={flight.arriveAirport}
                onBlur={(e) => onSaveField('arriveAirport', e.target.value)}
                placeholder="例：OKA 那霸"
              />
            </div>
            <div>
              <div className="tp-notes-flight-edit-label">起飛時間</div>
              <input
                type="datetime-local"
                defaultValue={flight.departAt}
                onBlur={(e) => onSaveField('departAt', e.target.value)}
              />
            </div>
            <div>
              <div className="tp-notes-flight-edit-label">抵達時間</div>
              <input
                type="datetime-local"
                defaultValue={flight.arriveAt}
                onBlur={(e) => onSaveField('arriveAt', e.target.value)}
              />
            </div>
            <textarea
              className="tp-notes-flight-edit-note"
              defaultValue={flight.note}
              onBlur={(e) => onSaveField('note', e.target.value)}
              placeholder="備註 (座位、訂位編號、艙等)…"
            />
          </div>
          <div className="tp-notes-flight-edit-actions">
            <button type="button" className="tp-btn tp-btn-destructive" onClick={onDelete} data-testid={`flight-delete-${flight.id}`}>
              刪除
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`tp-notes-flight-row${isDragging ? ' is-dragging' : ''}`}
      data-testid={`flight-row-${flight.id}`}
    >
      <button
        type="button"
        className="tp-notes-flight-grip"
        aria-label={`拖移航班：${flight.airline} ${flight.flightNo}`}
        {...attributes}
        {...listeners}
      >
        <Icon name="grip" />
      </button>
      <div className="tp-notes-flight-body" onClick={onEdit} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onEdit()}>
        <div className="tp-notes-flight-airline-row">
          <span className="tp-notes-flight-airline">{flight.airline || '未填'}</span>
          <span className="tp-notes-flight-no">{flight.flightNo}{flight.cabinClass ? ` · ${flight.cabinClass}` : ''}</span>
        </div>
        <div className="tp-notes-flight-route">
          <div className="tp-notes-flight-stop">
            <div className="tp-notes-flight-time">{dep.time}</div>
            <div className="tp-notes-flight-airport">{flight.departAirport || '未填'}</div>
            {dep.date && <div className="tp-notes-flight-date">{dep.date}</div>}
          </div>
          <div className="tp-notes-flight-divider">
            <span aria-hidden="true">✈</span>
            <div className="tp-notes-flight-divider-line" />
          </div>
          <div className="tp-notes-flight-stop">
            <div className="tp-notes-flight-time">{arr.time}</div>
            <div className="tp-notes-flight-airport">{flight.arriveAirport || '未填'}</div>
            {arr.date && <div className="tp-notes-flight-date">{arr.date}</div>}
          </div>
        </div>
        {flight.note && <div className="tp-notes-flight-note">{flight.note}</div>}
      </div>
      {/* v2.34.44 PR44: 拔 edit pencil + trash ghost */}
      <div className="tp-notes-flight-actions">
        <button
          type="button"
          className="tp-notes-flight-icon-btn is-danger"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label={`刪除航班：${flight.airline} ${flight.flightNo}`}
          title="刪除"
          data-testid={`flight-delete-${flight.id}`}
        >
          <Icon name="trash" />
        </button>
      </div>
    </div>
  );
}

export default function FlightsSection({ tripId, items, onChange }: FlightsSectionProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAdd = useCallback(async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const created = await apiFetch<TripFlight>(`/trips/${tripId}/notes/flights`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      onChange([...items, created]);
      setEditingId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增航班失敗');
    } finally {
      setBusy(false);
    }
  }, [tripId, items, onChange, busy]);

  // v2.34.46 PR46: 還原 autosave-on-blur — 單一 field PATCH with OCC
  const handleSaveField = useCallback(async (flightId: number, field: keyof TripFlight, value: string) => {
    const flight = items.find((f) => f.id === flightId);
    if (!flight) return;
    if (flight[field] === value) return;
    setError(null);
    try {
      const snakeField = (field as string).replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
      const updated = await apiFetch<TripFlight>(`/trips/${tripId}/notes/flights/${flightId}`, {
        method: 'PATCH',
        body: JSON.stringify({ [snakeField]: value, expectedVersion: flight.version }),
      });
      onChange(items.map((f) => (f.id === flightId ? updated : f)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '航班儲存失敗');
    }
  }, [tripId, items, onChange]);

  const handleDelete = useCallback(async (flightId: number) => {
    setError(null);
    try {
      await apiFetch(`/trips/${tripId}/notes/flights/${flightId}`, { method: 'DELETE' });
      onChange(items.filter((f) => f.id !== flightId));
      setPendingDeleteId(null);
      if (editingId === flightId) setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除航班失敗');
    }
  }, [tripId, items, onChange, editingId]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((f) => f.id === active.id);
    const newIndex = items.findIndex((f) => f.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    // Optimistic update
    onChange(reordered);
    try {
      await apiFetch(`/trips/${tripId}/notes/flights/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({
          items: reordered.map((f, i) => ({ id: f.id, sortOrder: i })),
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '排序儲存失敗');
      // revert
      onChange(items);
    }
  }, [tripId, items, onChange]);

  const pendingDeleteFlight = pendingDeleteId !== null ? items.find((f) => f.id === pendingDeleteId) : null;

  return (
    <div className="tp-notes-flights-section" data-testid="flights-section">
      <style>{SCOPED_STYLES}</style>
      {error && (
        <div style={{ padding: '0 16px' }}>
          <AlertPanel
            variant="error"
            title="航班操作失敗"
            message={`${error}。你的編輯內容還在，請點重試。`}
            actionLabel="重試"
            onAction={() => setError(null)}
          />
        </div>
      )}

      {items.length > 0 ? (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <div className="tp-notes-flight-rows">
              {items.map((flight) => (
                <SortableFlightRow
                  key={flight.id}
                  flight={flight}
                  isEditing={editingId === flight.id}
                  onEdit={() => setEditingId(flight.id)}
                  onSaveField={(field, value) => void handleSaveField(flight.id, field, value)}
                  onDelete={() => setPendingDeleteId(flight.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : null}

      <button
        type="button"
        className="tp-notes-add-row-btn"
        onClick={() => void handleAdd()}
        disabled={busy}
        data-testid="flight-add-btn"
      >
        <Icon name="plus" />
        加航段
      </button>

      <ConfirmModal
        open={pendingDeleteFlight !== null}
        title="刪除航班？"
        message={pendingDeleteFlight ? `「${pendingDeleteFlight.airline} ${pendingDeleteFlight.flightNo}」將被刪除，此操作無法復原。` : ''}
        confirmLabel="刪除"
        cancelLabel="取消"
        onConfirm={() => pendingDeleteFlight && void handleDelete(pendingDeleteFlight.id)}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
