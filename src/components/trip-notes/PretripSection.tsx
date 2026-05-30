/**
 * PretripSection — 行前須知 section CRUD UI (v2.34.x 行程筆記 PR8)
 *
 * Display: title + content markdown + AI 建議 chip (if ai_generated=1)
 * Edit: 3 fields (section / title / content textarea)
 *
 * ai_generated=1 row 顯「AI 建議」chip + 不可手動改 ai_source（PR9+ AI gen 寫入）
 */
import { useCallback, useState } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Icon from '../shared/Icon';
import AlertPanel from '../shared/AlertPanel';
import ConfirmModal from '../shared/ConfirmModal';
import { apiFetch } from '../../lib/apiClient';

export interface TripPretripNote {
  id: number;
  sortOrder: number;
  section: string;
  title: string;
  content: string;
  aiGenerated: number;
  aiSource: string | null;
  version: number;
}

interface PretripSectionProps {
  tripId: string;
  items: TripPretripNote[];
  onChange: (next: TripPretripNote[]) => void;
}

const SCOPED_STYLES = `
.tp-notes-pretrip-rows { display: flex; flex-direction: column; gap: 0; }
.tp-notes-pretrip-row {
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  display: grid; grid-template-columns: 24px 1fr auto; gap: 12px;
  background: transparent;
  transition: background 150ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.tp-notes-pretrip-row:last-child { border-bottom: none; }
.tp-notes-pretrip-row:hover { background: var(--color-background); }
.tp-notes-pretrip-row.is-dragging { background: var(--color-tertiary); opacity: 0.7; }
.tp-notes-pretrip-grip {
  width: 24px; height: 24px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--color-line-strong);
  cursor: grab; opacity: 0;
  transition: opacity 150ms;
  background: transparent; border: none; padding: 0;
  margin-top: 6px;
}
.tp-notes-pretrip-row:hover .tp-notes-pretrip-grip,
.tp-notes-pretrip-row:focus-within .tp-notes-pretrip-grip { opacity: 1; }
.tp-notes-pretrip-grip:active { cursor: grabbing; }
.tp-notes-pretrip-grip .svg-icon { width: 14px; height: 14px; }
.tp-notes-pretrip-body { min-width: 0; }

.tp-notes-pretrip-title-row {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
}
.tp-notes-pretrip-title { font-size: var(--font-size-subheadline); font-weight: 600; }
.tp-notes-pretrip-ai-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  font-size: var(--font-size-caption2); font-weight: 600;
  white-space: nowrap;
}
.tp-notes-pretrip-ai-chip .svg-icon { width: 10px; height: 10px; }
.tp-notes-pretrip-content {
  margin-top: 4px;
  font-size: var(--font-size-footnote); color: var(--color-muted);
  white-space: pre-wrap; word-break: break-word;
}
.tp-notes-pretrip-section-chip {
  display: inline-block;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: var(--color-tertiary);
  color: var(--color-muted);
  font-size: var(--font-size-eyebrow); font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-right: 6px;
}

.tp-notes-pretrip-row.is-editing {
  background: var(--color-background);
  box-shadow: 0 0 0 2px var(--color-accent);
  border-radius: var(--radius-md);
  margin: 6px 8px;
  padding: 12px;
  border: 1px solid transparent;
  /* v2.34.42 prod audit: 編輯模式拔右側 actions 欄，改 form 底下 .tp-btn 文字 button */
  grid-template-columns: 24px 1fr;
}
/* v2.34.42: edit-mode footer text buttons (取代右側 icon-only) — 對齊 DESIGN.md L534 取消 ghost / 確認 destructive */
.tp-notes-pretrip-edit-actions {
  display: flex; justify-content: flex-end; gap: 8px;
  margin-top: 12px;
}
.tp-notes-pretrip-edit-grid {
  display: grid; grid-template-columns: 1fr; gap: 12px;
}
.tp-notes-pretrip-edit-full { grid-column: 1 / -1; }
.tp-notes-pretrip-edit-content { min-height: 96px; }
.tp-notes-pretrip-edit-label {
  font-size: var(--font-size-caption); font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase; letter-spacing: 0.04em;
  margin-bottom: 4px;
}

.tp-notes-pretrip-actions {
  display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;
}
.tp-notes-pretrip-icon-btn {
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--color-muted);
  background: transparent; border: none;
  cursor: pointer;
  transition: opacity 150ms, color 150ms;
}
/* v2.34.44 PR44 user feedback: ghost style — 拔 bg hover，只 opacity + 變色 */
.tp-notes-pretrip-icon-btn { opacity: 0.7; }
.tp-notes-pretrip-icon-btn:hover { opacity: 1; color: var(--color-accent-deep); }
.tp-notes-pretrip-icon-btn.is-danger:hover { opacity: 1; color: var(--color-destructive); }
.tp-notes-pretrip-icon-btn .svg-icon { width: 16px; height: 16px; }
`;

interface SortableRowProps {
  note: TripPretripNote;
  isEditing: boolean;
  onEdit: () => void;
  onSaveField: (field: keyof TripPretripNote, value: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

function SortablePretripRow({ note, isEditing, onEdit, onSaveField, onDelete, onClose }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
    disabled: isEditing,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className="tp-notes-pretrip-row is-editing" data-testid={`pretrip-row-${note.id}`}>
        <div />
        <div className="tp-notes-pretrip-body">
          <div className="tp-notes-pretrip-edit-grid">
            {/* v2.34.44 PR44 follow-up: 拔「分類」field（user feedback「行前須知 不要分類」）。
              題目自然分類由 title + content 自描述，不再用 section column。
              既有 section value 保留 DB（未 NULL），但 user 無法 edit 也不顯示。 */}
            <div className="tp-notes-pretrip-edit-full">
              <div className="tp-notes-pretrip-edit-label">標題</div>
              <input
                className="tp-input-long"
                type="text"
                defaultValue={note.title}
                onBlur={(e) => onSaveField('title', e.target.value)}
                placeholder="例：貨幣 — 1 TWD ≈ 4.8 JPY"
                data-testid={`pretrip-input-title-${note.id}`}
              />
            </div>
            <textarea
              className="tp-input-long tp-notes-pretrip-edit-full tp-notes-pretrip-edit-content"
              defaultValue={note.content}
              onBlur={(e) => onSaveField('content', e.target.value)}
              placeholder="內容支援 markdown，例：- 機場 ATM 手續費低於市區"
              data-testid={`pretrip-input-content-${note.id}`}
            />
          </div>
          <div className="tp-notes-pretrip-edit-actions">
            <button type="button" className="tp-btn tp-btn-ghost" onClick={onClose} data-testid={`pretrip-close-${note.id}`}>
              關閉
            </button>
            <button type="button" className="tp-btn tp-btn-destructive" onClick={onDelete} data-testid={`pretrip-delete-${note.id}`}>
              刪除
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className={`tp-notes-pretrip-row${isDragging ? ' is-dragging' : ''}`} data-testid={`pretrip-row-${note.id}`}>
      <button type="button" className="tp-notes-pretrip-grip" aria-label={`拖移：${note.title}`} {...attributes} {...listeners}>
        <Icon name="grip" />
      </button>
      <div className="tp-notes-pretrip-body" onClick={onEdit} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onEdit()}>
        <div className="tp-notes-pretrip-title-row">
          {/* v2.34.44 PR44 follow-up: 拔讀模式 section chip（user feedback「不要分類」） */}
          <span className="tp-notes-pretrip-title">{note.title || '（未命名項目）'}</span>
          {note.aiGenerated === 1 && (
            <span className="tp-notes-pretrip-ai-chip">
              <Icon name="sparkle" />
              AI 建議
            </span>
          )}
        </div>
        {note.content && <div className="tp-notes-pretrip-content">{note.content}</div>}
      </div>
      {/* v2.34.44 PR44 user feedback: 拔 edit pencil（row body 點擊已進編輯）+ trash ghost style */}
      <div className="tp-notes-pretrip-actions">
        <button type="button" className="tp-notes-pretrip-icon-btn is-danger" onClick={(e) => { e.stopPropagation(); onDelete(); }} aria-label={`刪除：${note.title}`} title="刪除" data-testid={`pretrip-delete-${note.id}`}>
          <Icon name="trash" />
        </button>
      </div>
    </div>
  );
}

export default function PretripSection({ tripId, items, onChange }: PretripSectionProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAdd = useCallback(async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const created = await apiFetch<TripPretripNote>(`/trips/${tripId}/notes/pretrip`, { method: 'POST', body: JSON.stringify({}) });
      onChange([...items, created]);
      setEditingId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增失敗');
    } finally {
      setBusy(false);
    }
  }, [tripId, items, onChange, busy]);

  // v2.34.46 PR46: 還原 autosave-on-blur — 單一 field PATCH with OCC
  const handleSaveField = useCallback(async (noteId: number, field: keyof TripPretripNote, value: string) => {
    const note = items.find((n) => n.id === noteId);
    if (!note) return;
    if (note[field] === value) return;
    setError(null);
    try {
      const snakeField = (field as string).replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
      const updated = await apiFetch<TripPretripNote>(`/trips/${tripId}/notes/pretrip/${noteId}`, {
        method: 'PATCH',
        body: JSON.stringify({ [snakeField]: value, expectedVersion: note.version }),
      });
      onChange(items.map((n) => (n.id === noteId ? updated : n)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗');
    }
  }, [tripId, items, onChange]);

  const handleDelete = useCallback(async (noteId: number) => {
    setError(null);
    try {
      await apiFetch(`/trips/${tripId}/notes/pretrip/${noteId}`, { method: 'DELETE' });
      onChange(items.filter((n) => n.id !== noteId));
      setPendingDeleteId(null);
      if (editingId === noteId) setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除失敗');
    }
  }, [tripId, items, onChange, editingId]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((n) => n.id === active.id);
    const newIndex = items.findIndex((n) => n.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    onChange(reordered);
    try {
      await apiFetch(`/trips/${tripId}/notes/pretrip/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ items: reordered.map((n, i) => ({ id: n.id, sortOrder: i })) }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '排序失敗');
      onChange(items);
    }
  }, [tripId, items, onChange]);

  const pendingDeleteNote = pendingDeleteId !== null ? items.find((n) => n.id === pendingDeleteId) : null;

  return (
    <div className="tp-notes-pretrip-section" data-testid="pretrip-section">
      <style>{SCOPED_STYLES}</style>
      {error && (
        <div style={{ padding: '0 16px' }}>
          <AlertPanel variant="error" title="行前須知操作失敗" message={`${error}。你的編輯內容還在，請點重試。`} actionLabel="重試" onAction={() => setError(null)} />
        </div>
      )}

      {items.length > 0 && (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((n) => n.id)} strategy={verticalListSortingStrategy}>
            <div className="tp-notes-pretrip-rows">
              {items.map((note) => (
                <SortablePretripRow
                  key={note.id}
                  note={note}
                  isEditing={editingId === note.id}
                  onEdit={() => setEditingId(note.id)}
                  onClose={() => setEditingId(null)}
                  onSaveField={(field, value) => void handleSaveField(note.id, field, value)}
                  onDelete={() => setPendingDeleteId(note.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button type="button" className="tp-notes-add-row-btn" onClick={() => void handleAdd()} disabled={busy} data-testid="pretrip-add-btn">
        <Icon name="plus" />
        加項目
      </button>

      <ConfirmModal
        open={pendingDeleteNote !== null}
        title="刪除項目？"
        message={pendingDeleteNote ? `「${pendingDeleteNote.title || '未命名項目'}」將被刪除，此操作無法復原。` : ''}
        confirmLabel="刪除"
        cancelLabel="取消"
        onConfirm={() => pendingDeleteNote && void handleDelete(pendingDeleteNote.id)}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
