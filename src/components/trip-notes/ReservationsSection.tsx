/**
 * ReservationsSection — 預訂 section CRUD UI (v2.34.x 行程筆記 PR7)
 *
 * kind enum: restaurant / experience / ticket / transport / other
 *
 * Display: kind chip + title + 預訂時間 + 人數 + 預訂編號 + 電話 + 備註
 * Edit: 8 fields incl. kind select dropdown
 */
import { useCallback, useState } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Icon from '../shared/Icon';
import AlertPanel from '../shared/AlertPanel';
import ConfirmModal from '../shared/ConfirmModal';
import { apiFetch } from '../../lib/apiClient';

export interface TripReservation {
  id: number;
  sortOrder: number;
  kind: 'restaurant' | 'experience' | 'ticket' | 'transport' | 'other';
  title: string;
  reservedAt: string;
  partySize: number;
  reservationNo: string;
  phone: string;
  note: string;
  version: number;
}

interface ReservationsSectionProps {
  tripId: string;
  items: TripReservation[];
  onChange: (next: TripReservation[]) => void;
}

const KIND_LABEL: Record<TripReservation['kind'], string> = {
  restaurant: '餐廳',
  experience: '體驗',
  ticket: '門票',
  transport: '交通',
  other: '其他',
};

const KIND_KEYS = Object.keys(KIND_LABEL) as TripReservation['kind'][];

const SCOPED_STYLES = `
.tp-notes-reservation-rows { display: flex; flex-direction: column; gap: 0; }
.tp-notes-reservation-row {
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  display: grid; grid-template-columns: 24px 1fr auto; gap: 12px;
  background: transparent;
  transition: background 150ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.tp-notes-reservation-row:last-child { border-bottom: none; }
.tp-notes-reservation-row:hover { background: var(--color-background); }
.tp-notes-reservation-row.is-dragging { background: var(--color-tertiary); opacity: 0.7; }
.tp-notes-reservation-grip {
  width: 24px; height: 24px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--color-line-strong);
  cursor: grab; opacity: 0;
  transition: opacity 150ms;
  background: transparent; border: none; padding: 0;
  margin-top: 6px;
}
.tp-notes-reservation-row:hover .tp-notes-reservation-grip,
.tp-notes-reservation-row:focus-within .tp-notes-reservation-grip { opacity: 1; }
.tp-notes-reservation-grip:active { cursor: grabbing; }
.tp-notes-reservation-grip .svg-icon { width: 14px; height: 14px; }
.tp-notes-reservation-body { min-width: 0; }

.tp-notes-reservation-title-row {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.tp-notes-reservation-kind-chip {
  display: inline-flex; align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  font-size: var(--font-size-caption2); font-weight: 600;
  white-space: nowrap;
}
.tp-notes-reservation-title { font-size: var(--font-size-subheadline); font-weight: 600; }
.tp-notes-reservation-meta {
  margin-top: 4px;
  font-size: var(--font-size-footnote); color: var(--color-muted);
  display: flex; flex-wrap: wrap; gap: 10px;
}
.tp-notes-reservation-note { margin-top: 4px; font-size: var(--font-size-footnote); color: var(--color-muted); word-break: break-word; }

.tp-notes-reservation-row.is-editing {
  background: var(--color-background);
  box-shadow: 0 0 0 2px var(--color-accent);
  border-radius: var(--radius-md);
  margin: 6px 8px;
  padding: 12px;
  border: 1px solid transparent;
  grid-template-columns: 24px 1fr;
}
.tp-notes-reservation-edit-actions {
  display: flex; justify-content: flex-end; gap: 8px;
  margin-top: 12px;
}
.tp-notes-reservation-edit-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
}
.tp-notes-reservation-edit-grid input,
.tp-notes-reservation-edit-grid select,
.tp-notes-reservation-edit-grid textarea {
  width: 100%; padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-background);
  color: var(--color-foreground);
  font-size: var(--font-size-subheadline);
  outline: none;
}
.tp-notes-reservation-edit-grid input:focus,
.tp-notes-reservation-edit-grid select:focus,
.tp-notes-reservation-edit-grid textarea:focus { border-color: var(--color-accent); }
.tp-notes-reservation-edit-full { grid-column: 1 / -1; }
.tp-notes-reservation-edit-note { min-height: 48px; resize: vertical; }
.tp-notes-reservation-edit-label {
  font-size: var(--font-size-caption); font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase; letter-spacing: 0.04em;
  margin-bottom: 4px;
}

.tp-notes-reservation-actions {
  display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;
}
.tp-notes-reservation-icon-btn {
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--color-muted);
  background: transparent; border: none;
  cursor: pointer;
  transition: background 150ms, color 150ms;
}
/* v2.34.44 PR44 user feedback: ghost style */
.tp-notes-reservation-icon-btn { opacity: 0.7; }
.tp-notes-reservation-icon-btn:hover { opacity: 1; color: var(--color-accent-deep); }
.tp-notes-reservation-icon-btn.is-danger:hover { opacity: 1; color: var(--color-destructive); }
.tp-notes-reservation-icon-btn .svg-icon { width: 16px; height: 16px; }
`;

interface SortableRowProps {
  reservation: TripReservation;
  isEditing: boolean;
  onEdit: () => void;
  onSaveField: (field: keyof TripReservation, value: string | number) => void;
  onDelete: () => void;
}

function SortableReservationRow({ reservation, isEditing, onEdit, onSaveField, onDelete }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: reservation.id,
    disabled: isEditing,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className="tp-notes-reservation-row is-editing" data-testid={`reservation-row-${reservation.id}`}>
        <div />
        <div className="tp-notes-reservation-body">
          <div className="tp-notes-reservation-edit-grid">
            <div>
              <div className="tp-notes-reservation-edit-label">類型</div>
              <select
                defaultValue={reservation.kind}
                onBlur={(e) => onSaveField('kind', e.target.value)}
                onChange={(e) => onSaveField('kind', e.target.value)}
                data-testid={`reservation-input-kind-${reservation.id}`}
              >
                {KIND_KEYS.map((k) => (
                  <option key={k} value={k}>{KIND_LABEL[k]}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="tp-notes-reservation-edit-label">人數</div>
              <input
                type="number"
                min="0"
                defaultValue={reservation.partySize || ''}
                onBlur={(e) => onSaveField('partySize', Number(e.target.value) || 0)}
                placeholder="例：4"
              />
            </div>
            <div className="tp-notes-reservation-edit-full">
              <div className="tp-notes-reservation-edit-label">名稱 / 標題</div>
              <input
                type="text"
                defaultValue={reservation.title}
                onBlur={(e) => onSaveField('title', e.target.value)}
                placeholder="例：そば処 鶴亀庵"
                data-testid={`reservation-input-title-${reservation.id}`}
              />
            </div>
            <div className="tp-notes-reservation-edit-full">
              <div className="tp-notes-reservation-edit-label">預訂時間</div>
              <input
                type="datetime-local"
                defaultValue={reservation.reservedAt}
                onBlur={(e) => onSaveField('reservedAt', e.target.value)}
              />
            </div>
            <div>
              <div className="tp-notes-reservation-edit-label">預訂編號</div>
              <input
                type="text"
                defaultValue={reservation.reservationNo}
                onBlur={(e) => onSaveField('reservationNo', e.target.value)}
                placeholder="例：R-9182"
              />
            </div>
            <div>
              <div className="tp-notes-reservation-edit-label">電話</div>
              <input
                type="tel"
                defaultValue={reservation.phone}
                onBlur={(e) => onSaveField('phone', e.target.value)}
                placeholder="例：+81-98-XXX-XXXX"
              />
            </div>
            <textarea
              className="tp-notes-reservation-edit-full tp-notes-reservation-edit-note"
              defaultValue={reservation.note}
              onBlur={(e) => onSaveField('note', e.target.value)}
              placeholder="備註 (取消政策、特殊需求等)…"
            />
          </div>
          <div className="tp-notes-reservation-edit-actions">
            <button type="button" className="tp-btn tp-btn-destructive" onClick={onDelete} data-testid={`reservation-delete-${reservation.id}`}>
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
      className={`tp-notes-reservation-row${isDragging ? ' is-dragging' : ''}`}
      data-testid={`reservation-row-${reservation.id}`}
    >
      <button
        type="button"
        className="tp-notes-reservation-grip"
        aria-label={`拖移預訂：${reservation.title}`}
        {...attributes}
        {...listeners}
      >
        <Icon name="grip" />
      </button>
      <div className="tp-notes-reservation-body" onClick={onEdit} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onEdit()}>
        <div className="tp-notes-reservation-title-row">
          <span className="tp-notes-reservation-kind-chip">{KIND_LABEL[reservation.kind]}</span>
          <span className="tp-notes-reservation-title">{reservation.title || '（未命名預訂）'}</span>
        </div>
        <div className="tp-notes-reservation-meta">
          {reservation.reservedAt && <span>{reservation.reservedAt.slice(0, 16).replace('T', ' ')}</span>}
          {reservation.partySize > 0 && <span>{reservation.partySize} 人</span>}
          {reservation.reservationNo && <span>編號 {reservation.reservationNo}</span>}
          {reservation.phone && <span>{reservation.phone}</span>}
        </div>
        {reservation.note && <div className="tp-notes-reservation-note">{reservation.note}</div>}
      </div>
      {/* v2.34.44 PR44: 拔 edit pencil（row body 點擊已進編輯）+ trash ghost */}
      <div className="tp-notes-reservation-actions">
        <button
          type="button"
          className="tp-notes-reservation-icon-btn is-danger"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label={`刪除預訂：${reservation.title}`}
          title="刪除"
          data-testid={`reservation-delete-${reservation.id}`}
        >
          <Icon name="trash" />
        </button>
      </div>
    </div>
  );
}

export default function ReservationsSection({ tripId, items, onChange }: ReservationsSectionProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAdd = useCallback(async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const created = await apiFetch<TripReservation>(`/trips/${tripId}/notes/reservations`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      onChange([...items, created]);
      setEditingId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增預訂失敗');
    } finally {
      setBusy(false);
    }
  }, [tripId, items, onChange, busy]);

  // v2.34.46 PR46: 還原 autosave-on-blur — 單一 field PATCH with OCC
  const handleSaveField = useCallback(async (reservationId: number, field: keyof TripReservation, value: string | number) => {
    const reservation = items.find((r) => r.id === reservationId);
    if (!reservation) return;
    if (reservation[field] === value) return;
    setError(null);
    try {
      const snakeField = (field as string).replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
      const updated = await apiFetch<TripReservation>(`/trips/${tripId}/notes/reservations/${reservationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ [snakeField]: value, expectedVersion: reservation.version }),
      });
      onChange(items.map((r) => (r.id === reservationId ? updated : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '預訂儲存失敗');
    }
  }, [tripId, items, onChange]);

  const handleDelete = useCallback(async (reservationId: number) => {
    setError(null);
    try {
      await apiFetch(`/trips/${tripId}/notes/reservations/${reservationId}`, { method: 'DELETE' });
      onChange(items.filter((r) => r.id !== reservationId));
      setPendingDeleteId(null);
      if (editingId === reservationId) setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除預訂失敗');
    }
  }, [tripId, items, onChange, editingId]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((r) => r.id === active.id);
    const newIndex = items.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    onChange(reordered);
    try {
      await apiFetch(`/trips/${tripId}/notes/reservations/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({
          items: reordered.map((r, i) => ({ id: r.id, sortOrder: i })),
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '排序儲存失敗');
      onChange(items);
    }
  }, [tripId, items, onChange]);

  const pendingDeleteReservation = pendingDeleteId !== null ? items.find((r) => r.id === pendingDeleteId) : null;

  return (
    <div className="tp-notes-reservations-section" data-testid="reservations-section">
      <style>{SCOPED_STYLES}</style>
      {error && (
        <div style={{ padding: '0 16px' }}>
          <AlertPanel
            variant="error"
            title="預訂操作失敗"
            message={`${error}。你的編輯內容還在，請點重試。`}
            actionLabel="重試"
            onAction={() => setError(null)}
          />
        </div>
      )}

      {items.length > 0 && (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div className="tp-notes-reservation-rows">
              {items.map((reservation) => (
                <SortableReservationRow
                  key={reservation.id}
                  reservation={reservation}
                  isEditing={editingId === reservation.id}
                  onEdit={() => setEditingId(reservation.id)}
                  onSaveField={(field, value) => void handleSaveField(reservation.id, field, value)}
                  onDelete={() => setPendingDeleteId(reservation.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button
        type="button"
        className="tp-notes-add-row-btn"
        onClick={() => void handleAdd()}
        disabled={busy}
        data-testid="reservation-add-btn"
      >
        <Icon name="plus" />
        加預訂
      </button>

      <ConfirmModal
        open={pendingDeleteReservation !== null}
        title="刪除預訂？"
        message={pendingDeleteReservation ? `「${pendingDeleteReservation.title || '未命名預訂'}」將被刪除，此操作無法復原。` : ''}
        confirmLabel="刪除"
        cancelLabel="取消"
        onConfirm={() => pendingDeleteReservation && void handleDelete(pendingDeleteReservation.id)}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
