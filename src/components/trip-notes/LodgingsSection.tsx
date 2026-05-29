/**
 * LodgingsSection — 住宿 section CRUD UI (v2.34.x 行程筆記 PR6)
 *
 * Display: hotel name + address chip + check_in/check_out range + booking_no
 * Edit: 8 fields (name / address / check_in_at / check_out_at / booking_no / phone / note / day_id)
 *
 * day_id link：可選綁到某天 (PR4 設計 Premise 5.2 + lodging-day reverse navigation)
 *   - PR6 簡化：先 input number type，PR7+ 接 Day picker
 *
 * autosave / drag-reorder / delete pattern 同 FlightsSection。
 */
import { useCallback, useContext, useRef, useState } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import Icon from '../shared/Icon';
import AlertPanel from '../shared/AlertPanel';
import ConfirmModal from '../shared/ConfirmModal';
import { apiFetch } from '../../lib/apiClient';
import { TripContext } from '../../contexts/TripContext';
import { routes } from '../../lib/routes';

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
  // v2.34.44 PR44 migration 0074: single dayId → dayIds[] junction table
  // 不連續天的相同飯店視為不同紀錄（user 自己拆 row）。
  dayIds: number[];
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
.tp-notes-lodging-chip.is-day {
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  cursor: pointer;
  transition: background 150ms;
}
.tp-notes-lodging-chip.is-day:hover { background: var(--color-accent-bg); }
.tp-notes-lodging-note { margin-top: 6px; font-size: var(--font-size-footnote); color: var(--color-muted); word-break: break-word; }

/* Edit mode (shared with FlightsSection styles convention) */
.tp-notes-lodging-row.is-editing {
  background: var(--color-background);
  box-shadow: 0 0 0 2px var(--color-accent);
  border-radius: var(--radius-md);
  margin: 6px 8px;
  padding: 12px;
  border: 1px solid transparent;
  /* v2.34.42 prod audit: 編輯模式拔右側 actions 欄，改 form 底下 .tp-btn 文字 button */
  grid-template-columns: 24px 1fr;
}
.tp-notes-lodging-edit-actions {
  display: flex; justify-content: flex-end; gap: 8px;
  margin-top: 12px;
}
.tp-notes-lodging-edit-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
}
.tp-notes-lodging-edit-grid input,
.tp-notes-lodging-edit-grid textarea {
  width: 100%; padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-background);
  color: var(--color-foreground);
  /* v2.34.44 PR44 fix: 加 color 避免 input value 顯示 muted（user feedback「飯店名稱沒帶出來」） */
  color: var(--color-foreground);
  font-size: var(--font-size-subheadline);
  outline: none;
}
/* v2.34.44 PR44: multi-day checkboxes 改用 chip-style wrap */
.tp-notes-lodging-day-checkboxes {
  display: flex; flex-wrap: wrap; gap: 6px;
  padding: 6px 0;
}
.tp-notes-lodging-day-chk {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  background: var(--color-tertiary);
  color: var(--color-foreground);
  font-size: var(--font-size-footnote);
  cursor: pointer;
  user-select: none;
  border: 1px solid transparent;
  transition: background 150ms;
}
.tp-notes-lodging-day-chk:hover { background: var(--color-hover); }
.tp-notes-lodging-day-chk.is-checked {
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  border-color: var(--color-accent);
}
.tp-notes-lodging-day-chk input[type="checkbox"] { margin: 0; cursor: pointer; }
.tp-notes-lodging-day-empty {
  font-size: var(--font-size-footnote); color: var(--color-muted);
}
.tp-notes-lodging-edit-grid input:focus,
.tp-notes-lodging-edit-grid textarea:focus { border-color: var(--color-accent); }
.tp-notes-lodging-edit-full { grid-column: 1 / -1; }
.tp-notes-lodging-edit-note { min-height: 48px; resize: vertical; }
.tp-notes-lodging-edit-label {
  font-size: var(--font-size-caption); font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase; letter-spacing: 0.04em;
  margin-bottom: 4px;
}

.tp-notes-lodging-actions {
  display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;
}
/* v2.34.44 PR44 user feedback: 拔 edit pencil + trash 改 ghost 風格（無 bg fill 對齊 .tp-btn-ghost 慣例）。
 * 32×32 size 對齊 minimum tap target，但 hover 不再 bg-fill；只 color 變化 + opacity。 */
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

interface DayOption { id: number; dayNum: number; label: string; }

interface SortableRowProps {
  lodging: TripLodging;
  isEditing: boolean;
  days: DayOption[];
  onEdit: () => void;
  onCloseEdit: () => void;
  onSaveField: (field: keyof TripLodging, value: string | number | null | number[]) => void;
  onDelete: () => void;
  onNavigateDay: (dayNum: number) => void;
}

function SortableLodgingRow({ lodging, isEditing, days, onEdit, onCloseEdit, onSaveField, onDelete, onNavigateDay }: SortableRowProps) {
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
            <div className="tp-notes-lodging-edit-full">
              <div className="tp-notes-lodging-edit-label">飯店 / 民宿</div>
              <input
                type="text"
                defaultValue={lodging.name}
                onBlur={(e) => onSaveField('name', e.target.value)}
                placeholder="例：那霸久茂地里士滿酒店"
                data-testid={`lodging-input-name-${lodging.id}`}
              />
            </div>
            <div className="tp-notes-lodging-edit-full">
              <div className="tp-notes-lodging-edit-label">地址</div>
              <input
                type="text"
                defaultValue={lodging.address}
                onBlur={(e) => onSaveField('address', e.target.value)}
                placeholder="例：沖繩縣那霸市久茂地 2-15-21"
              />
            </div>
            <div>
              <div className="tp-notes-lodging-edit-label">入住</div>
              <input
                type="datetime-local"
                defaultValue={lodging.checkInAt}
                onBlur={(e) => onSaveField('checkInAt', e.target.value)}
              />
            </div>
            <div>
              <div className="tp-notes-lodging-edit-label">退房</div>
              <input
                type="datetime-local"
                defaultValue={lodging.checkOutAt}
                onBlur={(e) => onSaveField('checkOutAt', e.target.value)}
              />
            </div>
            <div>
              <div className="tp-notes-lodging-edit-label">訂房編號</div>
              <input
                type="text"
                defaultValue={lodging.bookingNo}
                onBlur={(e) => onSaveField('bookingNo', e.target.value)}
                placeholder="例：BK-7281"
              />
            </div>
            <div>
              <div className="tp-notes-lodging-edit-label">電話</div>
              <input
                type="tel"
                defaultValue={lodging.phone}
                onBlur={(e) => onSaveField('phone', e.target.value)}
                placeholder="例：+81-98-867-2231"
              />
            </div>
            <div className="tp-notes-lodging-edit-full">
              <div className="tp-notes-lodging-edit-label">連結到 Day（可多選 — 不連續天請拆多筆）</div>
              <div className="tp-notes-lodging-day-checkboxes" data-testid={`lodging-input-day-${lodging.id}`}>
                {days.map((d) => {
                  const checked = lodging.dayIds.includes(d.id);
                  return (
                    <label key={d.id} className={`tp-notes-lodging-day-chk${checked ? ' is-checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? Array.from(new Set([...lodging.dayIds, d.id])).sort((a, b) => a - b)
                            : lodging.dayIds.filter((id) => id !== d.id);
                          onSaveField('dayIds', next);
                        }}
                      />
                      <span>{d.label}</span>
                    </label>
                  );
                })}
                {days.length === 0 && <div className="tp-notes-lodging-day-empty">此 trip 還沒有 Day</div>}
              </div>
            </div>
            <textarea
              className="tp-notes-lodging-edit-full tp-notes-lodging-edit-note"
              defaultValue={lodging.note}
              onBlur={(e) => onSaveField('note', e.target.value)}
              placeholder="備註 (入住須知、停車、早餐等)…"
            />
          </div>
          <div className="tp-notes-lodging-edit-actions">
            <button type="button" className="tp-btn tp-btn-destructive" onClick={onDelete} data-testid={`lodging-delete-${lodging.id}`}>
              刪除
            </button>
            <button type="button" className="tp-btn tp-btn-primary" onClick={onCloseEdit} data-testid={`lodging-close-edit-${lodging.id}`}>
              完成
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
          {/* v2.34.44 PR44: multi-day support — 顯示每個 day 一個 chip */}
          {lodging.dayIds.map((dayId) => {
            const day = days.find((d) => d.id === dayId);
            if (!day) return null;
            return (
              <button
                key={dayId}
                type="button"
                className="tp-notes-lodging-chip is-day"
                onClick={(e) => { e.stopPropagation(); onNavigateDay(day.dayNum); }}
                data-testid={`lodging-day-chip-${lodging.id}-${dayId}`}
                title={`跳到 ${day.label}`}
              >
                {day.label} →
              </button>
            );
          })}
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
      {/* v2.34.44 PR44 user feedback: 拔 edit pencil（點 row body 進編輯）；trash 改 ghost style */}
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
  const tripCtx = useContext(TripContext);
  const navigate = useNavigate();
  const days: DayOption[] = (tripCtx?.days ?? []).map((d) => ({
    id: d.id,
    dayNum: d.dayNum,
    label: d.title ? `Day ${d.dayNum} · ${d.title}` : (d.label ?? `Day ${d.dayNum}`),
  }));
  const handleNavigateDay = useCallback((dayNum: number) => {
    if (!tripId) return;
    navigate(`${routes.tripsSelected(tripId)}&day=${dayNum}`);
  }, [navigate, tripId]);
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

  // v2.34.44 PR44 follow-up: 拔 autosave-on-blur。改為 stage to ref map → 完成 button batch flush。
  // User feedback「行程筆記沒有 auto save 應該是點完成後才存檔」。
  const pendingRef = useRef<Map<number, Record<string, unknown>>>(new Map());

  const handleStageField = useCallback((lodgingId: number, field: keyof TripLodging, value: string | number | null | number[]) => {
    const lodging = items.find((l) => l.id === lodgingId);
    if (!lodging) return;
    // dirty check 仍 keep — 避免 stage 無變化的 field
    if (Array.isArray(value) && Array.isArray(lodging[field])) {
      const prev = lodging[field] as number[];
      if (prev.length === value.length && prev.every((v, i) => v === value[i])) return;
    } else if (lodging[field] === value) return;
    const map = pendingRef.current.get(lodgingId) ?? {};
    map[field as string] = value;
    pendingRef.current.set(lodgingId, map);
  }, [items]);

  const handleCompleteEdit = useCallback(async (lodgingId: number) => {
    const pending = pendingRef.current.get(lodgingId);
    setEditingId(null); // 立即 close edit 給 snappy UX；PATCH 在 background
    if (!pending || Object.keys(pending).length === 0) return;
    const lodging = items.find((l) => l.id === lodgingId);
    if (!lodging) return;
    setError(null);
    try {
      const snakeBody: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(pending)) {
        const sk = k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
        snakeBody[sk] = v;
      }
      snakeBody.expectedVersion = lodging.version;
      const updated = await apiFetch<TripLodging>(`/trips/${tripId}/notes/lodgings/${lodgingId}`, {
        method: 'PATCH',
        body: JSON.stringify(snakeBody),
      });
      onChange(items.map((l) => (l.id === lodgingId ? updated : l)));
      pendingRef.current.delete(lodgingId);
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
                  days={days}
                  onEdit={() => setEditingId(lodging.id)}
                  onCloseEdit={() => void handleCompleteEdit(lodging.id)}
                  onSaveField={(field, value) => handleStageField(lodging.id, field, value)}
                  onDelete={() => setPendingDeleteId(lodging.id)}
                  onNavigateDay={handleNavigateDay}
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
