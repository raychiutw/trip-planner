/**
 * LodgingsSection — 住宿 section CRUD UI
 *
 * v2.34.46 PR46：移除旅館 Day 關聯 + 還原 autosave-on-blur + edit mode 只留刪除 button。
 *
 * Display: hotel name + address + check_in/check_out range + booking_no chip
 * Edit: 7 fields (name / address / check_in_at / check_out_at / booking_no / phone / note)
 * autosave / drag-reorder / delete pattern 同 FlightsSection。
 */
import { useCallback, useState } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Icon from '../shared/Icon';
import AlertPanel from '../shared/AlertPanel';
import ConfirmModal from '../shared/ConfirmModal';
import NoteDateTimeField from './NoteDateTimeField';
import { apiFetch } from '../../lib/apiClient';

export interface TripLodging {
  id: number;
  sortOrder: number;
  name: string;
  address: string;
  checkInAt: string;
  checkOutAt: string;
  bookingNo: string;
  phone: string;
  note: string;
  version: number;
}

interface LodgingsSectionProps {
  tripId: string;
  items: TripLodging[];
  onChange: (next: TripLodging[]) => void;
}

const SCOPED_STYLES = `
.tp-notes-lodging-rows { display: flex; flex-direction: column; gap: 0; }
.tp-notes-lodging-row {
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  display: grid; grid-template-columns: 24px 1fr auto; gap: 12px;
  background: transparent;
  transition: background 150ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.tp-notes-lodging-row:last-child { border-bottom: none; }
.tp-notes-lodging-row:hover { background: var(--color-background); }
.tp-notes-lodging-row.is-dragging { background: var(--color-tertiary); opacity: 0.7; }
.tp-notes-lodging-grip {
  width: 24px; height: 24px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--color-line-strong);
  cursor: grab; opacity: 0;
  transition: opacity 150ms;
  background: transparent; border: none; padding: 0;
  margin-top: 6px;
}
.tp-notes-lodging-row:hover .tp-notes-lodging-grip,
.tp-notes-lodging-row:focus-within .tp-notes-lodging-grip { opacity: 1; }
.tp-notes-lodging-grip:active { cursor: grabbing; }
.tp-notes-lodging-grip .svg-icon { width: 14px; height: 14px; }
.tp-notes-lodging-body { min-width: 0; }

.tp-notes-lodging-name { font-size: var(--font-size-subheadline); font-weight: 700; }
.tp-notes-lodging-meta {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  margin-top: 6px;
  font-size: var(--font-size-footnote); color: var(--color-muted);
}
.tp-notes-lodging-chip {
  display: inline-flex; align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-tertiary);
  color: var(--color-muted);
  font-size: var(--font-size-caption2); font-weight: 600;
  white-space: nowrap;
  border: none; cursor: default;
}
.tp-notes-lodging-note { margin-top: 6px; font-size: var(--font-size-footnote); color: var(--color-muted); word-break: break-word; }

.tp-notes-lodging-row.is-editing {
  background: var(--color-background);
  box-shadow: 0 0 0 2px var(--color-accent);
  border-radius: var(--radius-md);
  margin: 6px 8px;
  padding: 12px;
  border: 1px solid transparent;
  grid-template-columns: 24px 1fr;
}
.tp-notes-lodging-edit-actions {
  display: flex; justify-content: flex-end; gap: 8px;
  margin-top: 12px;
}
.tp-notes-lodging-edit-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
}
.tp-notes-lodging-edit-field { min-width: 0; }
.tp-notes-lodging-edit-full { grid-column: 1 / -1; }
.tp-notes-lodging-edit-label {
  font-size: var(--font-size-caption); font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase; letter-spacing: 0.04em;
  margin-bottom: 4px;
}

.tp-notes-lodging-actions {
  display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;
}
.tp-notes-lodging-icon-btn {
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--color-muted);
  background: transparent; border: none;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 150ms, color 150ms;
}
.tp-notes-lodging-icon-btn:hover { opacity: 1; color: var(--color-accent-deep); }
.tp-notes-lodging-icon-btn.is-ghost.is-danger:hover { opacity: 1; color: var(--color-destructive); }
.tp-notes-lodging-icon-btn .svg-icon { width: 16px; height: 16px; }
`;

interface SortableRowProps {
  lodging: TripLodging;
  isEditing: boolean;
  onEdit: () => void;
  onSaveField: (field: keyof TripLodging, value: string) => void;
  onDelete: () => void;
}

function SortableLodgingRow({ lodging, isEditing, onEdit, onSaveField, onDelete }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lodging.id,
    disabled: isEditing,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className="tp-notes-lodging-row is-editing" data-testid={`lodging-row-${lodging.id}`}>
        <div />
        <div className="tp-notes-lodging-body">
          <div className="tp-notes-lodging-edit-grid">
            <div className="tp-notes-lodging-edit-field tp-notes-lodging-edit-full">
              <div className="tp-notes-lodging-edit-label">飯店 / 民宿</div>
              <input
                className="tp-input-long"
                type="text"
                defaultValue={lodging.name}
                onBlur={(e) => onSaveField('name', e.target.value)}
                placeholder="例：那霸久茂地里士滿酒店"
                data-testid={`lodging-input-name-${lodging.id}`}
              />
            </div>
            <div className="tp-notes-lodging-edit-field tp-notes-lodging-edit-full">
              <div className="tp-notes-lodging-edit-label">地址</div>
              <input
                className="tp-input-long"
                type="text"
                defaultValue={lodging.address}
                onBlur={(e) => onSaveField('address', e.target.value)}
                placeholder="例：沖繩縣那霸市久茂地 2-15-21"
              />
            </div>
            <div className="tp-notes-lodging-edit-field tp-notes-lodging-edit-full">
              <div className="tp-notes-lodging-edit-label">入住</div>
              <NoteDateTimeField
                value={lodging.checkInAt}
                onChange={(v) => onSaveField('checkInAt', v)}
                ariaLabel="入住"
              />
            </div>
            <div className="tp-notes-lodging-edit-field tp-notes-lodging-edit-full">
              <div className="tp-notes-lodging-edit-label">退房</div>
              <NoteDateTimeField
                value={lodging.checkOutAt}
                onChange={(v) => onSaveField('checkOutAt', v)}
                ariaLabel="退房"
              />
            </div>
            <div className="tp-notes-lodging-edit-field">
              <div className="tp-notes-lodging-edit-label">訂房編號</div>
              <input
                className="tp-input-long"
                type="text"
                defaultValue={lodging.bookingNo}
                onBlur={(e) => onSaveField('bookingNo', e.target.value)}
                placeholder="例：BK-7281"
              />
            </div>
            <div className="tp-notes-lodging-edit-field">
              <div className="tp-notes-lodging-edit-label">電話</div>
              <input
                className="tp-input-long"
                type="tel"
                defaultValue={lodging.phone}
                onBlur={(e) => onSaveField('phone', e.target.value)}
                placeholder="例：+81-98-867-2231"
              />
            </div>
            <textarea
              className="tp-input-long tp-notes-lodging-edit-full tp-notes-lodging-edit-note"
              defaultValue={lodging.note}
              onBlur={(e) => onSaveField('note', e.target.value)}
              placeholder="備註 (入住須知、停車、早餐等)…"
            />
          </div>
          <div className="tp-notes-lodging-edit-actions">
            <button type="button" className="tp-btn tp-btn-destructive" onClick={onDelete} data-testid={`lodging-delete-${lodging.id}`}>
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
      className={`tp-notes-lodging-row${isDragging ? ' is-dragging' : ''}`}
      data-testid={`lodging-row-${lodging.id}`}
    >
      <button
        type="button"
        className="tp-notes-lodging-grip"
        aria-label={`拖移住宿：${lodging.name}`}
        {...attributes}
        {...listeners}
      >
        <Icon name="grip" />
      </button>
      <div className="tp-notes-lodging-body" onClick={onEdit} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onEdit()}>
        <div className="tp-notes-lodging-name">{lodging.name || '（未命名住宿）'}</div>
        <div className="tp-notes-lodging-meta">
          {lodging.bookingNo && <span className="tp-notes-lodging-chip">訂房 {lodging.bookingNo}</span>}
          {lodging.checkInAt && (
            <span>
              入住 {lodging.checkInAt.slice(0, 16).replace('T', ' ')}
              {lodging.checkOutAt && ` → 退房 ${lodging.checkOutAt.slice(0, 16).replace('T', ' ')}`}
            </span>
          )}
        </div>
        {lodging.address && <div className="tp-notes-lodging-note">{lodging.address}</div>}
        {lodging.note && <div className="tp-notes-lodging-note">{lodging.note}</div>}
      </div>
      <div className="tp-notes-lodging-actions">
        <button
          type="button"
          className="tp-notes-lodging-icon-btn is-ghost is-danger"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label={`刪除住宿：${lodging.name}`}
          title="刪除"
          data-testid={`lodging-delete-${lodging.id}`}
        >
          <Icon name="trash" />
        </button>
      </div>
    </div>
  );
}

export default function LodgingsSection({ tripId, items, onChange }: LodgingsSectionProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAdd = useCallback(async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const created = await apiFetch<TripLodging>(`/trips/${tripId}/notes/lodgings`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      onChange([...items, created]);
      setEditingId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增住宿失敗');
    } finally {
      setBusy(false);
    }
  }, [tripId, items, onChange, busy]);

  // v2.34.46 PR46: 還原 autosave-on-blur。onBlur 直接 PATCH 單一 field with OCC。
  const handleSaveField = useCallback(async (lodgingId: number, field: keyof TripLodging, value: string) => {
    const lodging = items.find((l) => l.id === lodgingId);
    if (!lodging) return;
    if (lodging[field] === value) return; // dirty check
    setError(null);
    try {
      const snakeField = (field as string).replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
      const updated = await apiFetch<TripLodging>(`/trips/${tripId}/notes/lodgings/${lodgingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ [snakeField]: value, expectedVersion: lodging.version }),
      });
      onChange(items.map((l) => (l.id === lodgingId ? updated : l)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '住宿儲存失敗');
    }
  }, [tripId, items, onChange]);

  const handleDelete = useCallback(async (lodgingId: number) => {
    setError(null);
    try {
      await apiFetch(`/trips/${tripId}/notes/lodgings/${lodgingId}`, { method: 'DELETE' });
      onChange(items.filter((l) => l.id !== lodgingId));
      setPendingDeleteId(null);
      if (editingId === lodgingId) setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除住宿失敗');
    }
  }, [tripId, items, onChange, editingId]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((l) => l.id === active.id);
    const newIndex = items.findIndex((l) => l.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    onChange(reordered);
    try {
      await apiFetch(`/trips/${tripId}/notes/lodgings/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({
          items: reordered.map((l, i) => ({ id: l.id, sortOrder: i })),
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '排序儲存失敗');
      onChange(items);
    }
  }, [tripId, items, onChange]);

  const pendingDeleteLodging = pendingDeleteId !== null ? items.find((l) => l.id === pendingDeleteId) : null;

  return (
    <div className="tp-notes-lodgings-section" data-testid="lodgings-section">
      <style>{SCOPED_STYLES}</style>
      {error && (
        <div style={{ padding: '0 16px' }}>
          <AlertPanel
            variant="error"
            title="住宿操作失敗"
            message={`${error}。你的編輯內容還在，請點重試。`}
            actionLabel="重試"
            onAction={() => setError(null)}
          />
        </div>
      )}

      {items.length > 0 && (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <div className="tp-notes-lodging-rows">
              {items.map((lodging) => (
                <SortableLodgingRow
                  key={lodging.id}
                  lodging={lodging}
                  isEditing={editingId === lodging.id}
                  onEdit={() => setEditingId(lodging.id)}
                  onSaveField={(field, value) => void handleSaveField(lodging.id, field, value)}
                  onDelete={() => setPendingDeleteId(lodging.id)}
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
        data-testid="lodging-add-btn"
      >
        <Icon name="plus" />
        加住宿
      </button>

      <ConfirmModal
        open={pendingDeleteLodging !== null}
        title="刪除住宿？"
        message={pendingDeleteLodging ? `「${pendingDeleteLodging.name || '未命名住宿'}」將被刪除，此操作無法復原。` : ''}
        confirmLabel="刪除"
        cancelLabel="取消"
        onConfirm={() => pendingDeleteLodging && void handleDelete(pendingDeleteLodging.id)}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
