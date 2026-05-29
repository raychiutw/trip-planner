/**
 * EmergencySection — 緊急聯絡 section CRUD UI (v2.34.x 行程筆記 PR8)
 *
 * kind enum: personal / embassy / police / medical / insurance / hotel / other
 *
 * Display: kind icon + name + AI 建議 chip + phone tel: button (large tap target)
 * Edit: 6 fields (name / relationship / phone / email / kind / ai_generated readonly)
 */
import { useCallback, useState } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Icon from '../shared/Icon';
import AlertPanel from '../shared/AlertPanel';
import ConfirmModal from '../shared/ConfirmModal';
import { apiFetch } from '../../lib/apiClient';

export type EmergencyKind = 'personal' | 'embassy' | 'police' | 'medical' | 'insurance' | 'hotel' | 'other';

export interface TripEmergencyContact {
  id: number;
  sortOrder: number;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  kind: EmergencyKind;
  aiGenerated: number;
  version: number;
}

interface EmergencySectionProps {
  tripId: string;
  items: TripEmergencyContact[];
  onChange: (next: TripEmergencyContact[]) => void;
}

const KIND_LABEL: Record<EmergencyKind, string> = {
  personal: '親友',
  embassy: '駐外館處',
  police: '警察',
  medical: '醫療',
  insurance: '保險',
  hotel: '飯店',
  other: '其他',
};
const KIND_KEYS = Object.keys(KIND_LABEL) as EmergencyKind[];

const SCOPED_STYLES = `
.tp-notes-emergency-rows { display: flex; flex-direction: column; gap: 0; }
.tp-notes-emergency-row {
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  display: grid; grid-template-columns: 24px 36px 1fr auto; gap: 12px;
  align-items: center;
  background: transparent;
  transition: background 150ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.tp-notes-emergency-row:last-child { border-bottom: none; }
.tp-notes-emergency-row:hover { background: var(--color-background); }
.tp-notes-emergency-row.is-dragging { background: var(--color-tertiary); opacity: 0.7; }
.tp-notes-emergency-grip {
  width: 24px; height: 24px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--color-line-strong);
  cursor: grab; opacity: 0;
  transition: opacity 150ms;
  background: transparent; border: none; padding: 0;
}
.tp-notes-emergency-row:hover .tp-notes-emergency-grip,
.tp-notes-emergency-row:focus-within .tp-notes-emergency-grip { opacity: 1; }
.tp-notes-emergency-grip:active { cursor: grabbing; }
.tp-notes-emergency-grip .svg-icon { width: 14px; height: 14px; }

.tp-notes-emergency-kind-icon {
  width: 36px; height: 36px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--radius-md);
  background: var(--color-tertiary);
  color: var(--color-foreground);
  flex-shrink: 0;
}
.tp-notes-emergency-kind-icon.is-urgent { background: var(--color-priority-high-bg); color: var(--color-destructive); }
.tp-notes-emergency-kind-icon.is-embassy { background: var(--color-accent-subtle); color: var(--color-accent-deep); }
.tp-notes-emergency-kind-icon.is-hotel { background: rgba(6, 167, 125, 0.12); color: var(--color-success); }
.tp-notes-emergency-kind-icon .svg-icon { width: 18px; height: 18px; }

.tp-notes-emergency-body { min-width: 0; }
.tp-notes-emergency-name-row {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
}
.tp-notes-emergency-name { font-size: var(--font-size-subheadline); font-weight: 600; }
.tp-notes-emergency-ai-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  font-size: var(--font-size-caption2); font-weight: 600;
}
.tp-notes-emergency-ai-chip .svg-icon { width: 10px; height: 10px; }
.tp-notes-emergency-detail { font-size: var(--font-size-footnote); color: var(--color-muted); margin-top: 2px; }

.tp-notes-emergency-phone-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  font-size: var(--font-size-footnote); font-weight: 700;
  font-variant-numeric: tabular-nums;
  min-height: 36px;
  white-space: nowrap;
  text-decoration: none;
  transition: background 150ms;
}
.tp-notes-emergency-phone-btn:hover { background: var(--color-accent-bg); }
.tp-notes-emergency-phone-btn.is-urgent {
  background: var(--color-priority-high-bg);
  color: var(--color-destructive);
}
.tp-notes-emergency-phone-btn.is-urgent:hover { filter: brightness(0.95); }
.tp-notes-emergency-phone-btn .svg-icon { width: 14px; height: 14px; }

.tp-notes-emergency-row.is-editing {
  background: var(--color-background);
  box-shadow: 0 0 0 2px var(--color-accent);
  border-radius: var(--radius-md);
  margin: 6px 8px;
  padding: 12px;
  /* v2.34.42 prod audit: 編輯模式 single col，actions 改 form 底下 .tp-btn */
  grid-template-columns: 1fr;
}
.tp-notes-emergency-edit-actions {
  display: flex; justify-content: flex-end; gap: 8px;
  margin-top: 12px;
}
.tp-notes-emergency-edit-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
  grid-column: 1;
}
.tp-notes-emergency-edit-grid input,
.tp-notes-emergency-edit-grid select {
  width: 100%; padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-background);
  font-size: var(--font-size-subheadline);
  outline: none;
}
.tp-notes-emergency-edit-grid input:focus,
.tp-notes-emergency-edit-grid select:focus { border-color: var(--color-accent); }
.tp-notes-emergency-edit-full { grid-column: 1 / -1; }
.tp-notes-emergency-edit-label {
  font-size: var(--font-size-caption); font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase; letter-spacing: 0.04em;
  margin-bottom: 4px;
}

.tp-notes-emergency-actions {
  display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;
}
.tp-notes-emergency-icon-btn {
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--color-muted);
  background: transparent; border: none;
  cursor: pointer;
  transition: background 150ms, color 150ms;
}
.tp-notes-emergency-icon-btn:hover { background: var(--color-accent-subtle); color: var(--color-accent-deep); }
.tp-notes-emergency-icon-btn.is-danger:hover { background: var(--color-priority-high-bg); color: var(--color-destructive); }
.tp-notes-emergency-icon-btn .svg-icon { width: 14px; height: 14px; }
`;

function kindIconName(kind: EmergencyKind): string {
  switch (kind) {
    case 'embassy': return 'home';
    case 'police': return 'info';
    case 'medical': return 'phone';
    case 'insurance': return 'check-square';
    case 'hotel': return 'home';
    case 'personal': return 'phone';
    default: return 'phone';
  }
}

function isUrgentKind(kind: EmergencyKind): boolean {
  return kind === 'police' || kind === 'medical';
}

interface SortableRowProps {
  contact: TripEmergencyContact;
  isEditing: boolean;
  onEdit: () => void;
  onCloseEdit: () => void;
  onSaveField: (field: keyof TripEmergencyContact, value: string) => void;
  onDelete: () => void;
}

function SortableEmergencyRow({ contact, isEditing, onEdit, onCloseEdit, onSaveField, onDelete }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: contact.id,
    disabled: isEditing,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className="tp-notes-emergency-row is-editing" data-testid={`emergency-row-${contact.id}`}>
        <div className="tp-notes-emergency-edit-grid">
          <div className="tp-notes-emergency-edit-full">
            <div className="tp-notes-emergency-edit-label">名稱</div>
            <input
              type="text"
              defaultValue={contact.name}
              onBlur={(e) => onSaveField('name', e.target.value)}
              placeholder="例：駐那霸臺北經濟文化辦事處"
              data-testid={`emergency-input-name-${contact.id}`}
            />
          </div>
          <div>
            <div className="tp-notes-emergency-edit-label">類型</div>
            <select
              defaultValue={contact.kind}
              onChange={(e) => onSaveField('kind', e.target.value)}
              onBlur={(e) => onSaveField('kind', e.target.value)}
              data-testid={`emergency-input-kind-${contact.id}`}
            >
              {KIND_KEYS.map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="tp-notes-emergency-edit-label">關係 / 用途</div>
            <input
              type="text"
              defaultValue={contact.relationship}
              onBlur={(e) => onSaveField('relationship', e.target.value)}
              placeholder="例：報案 / 失竊 / 家屬"
            />
          </div>
          <div>
            <div className="tp-notes-emergency-edit-label">電話</div>
            <input
              type="tel"
              defaultValue={contact.phone}
              onBlur={(e) => onSaveField('phone', e.target.value)}
              placeholder="例：+81988628603"
              data-testid={`emergency-input-phone-${contact.id}`}
            />
          </div>
          <div className="tp-notes-emergency-edit-full">
            <div className="tp-notes-emergency-edit-label">Email</div>
            <input
              type="email"
              defaultValue={contact.email}
              onBlur={(e) => onSaveField('email', e.target.value)}
              placeholder="可選"
            />
          </div>
        </div>
        <div className="tp-notes-emergency-edit-actions">
          <button type="button" className="tp-btn tp-btn-destructive" onClick={onDelete} data-testid={`emergency-delete-${contact.id}`}>
            刪除
          </button>
          <button type="button" className="tp-btn tp-btn-primary" onClick={onCloseEdit} data-testid={`emergency-close-edit-${contact.id}`}>
            完成
          </button>
        </div>
      </div>
    );
  }

  const phoneHref = contact.phone ? `tel:${contact.phone.replace(/\s/g, '')}` : '';
  const iconClass = isUrgentKind(contact.kind) ? 'is-urgent' :
    contact.kind === 'embassy' ? 'is-embassy' :
    contact.kind === 'hotel' ? 'is-hotel' : '';

  return (
    <div ref={setNodeRef} style={style} className={`tp-notes-emergency-row${isDragging ? ' is-dragging' : ''}`} data-testid={`emergency-row-${contact.id}`}>
      <button type="button" className="tp-notes-emergency-grip" aria-label={`拖移：${contact.name}`} {...attributes} {...listeners}>
        <Icon name="grip" />
      </button>
      <div className={`tp-notes-emergency-kind-icon ${iconClass}`}>
        <Icon name={kindIconName(contact.kind)} />
      </div>
      <div className="tp-notes-emergency-body" onClick={onEdit} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onEdit()}>
        <div className="tp-notes-emergency-name-row">
          <span className="tp-notes-emergency-name">{contact.name || '（未命名聯絡人）'}</span>
          {contact.aiGenerated === 1 && (
            <span className="tp-notes-emergency-ai-chip">
              <Icon name="sparkle" />
              AI
            </span>
          )}
        </div>
        <div className="tp-notes-emergency-detail">
          {KIND_LABEL[contact.kind]}
          {contact.relationship && ` · ${contact.relationship}`}
        </div>
      </div>
      {phoneHref ? (
        <a className={`tp-notes-emergency-phone-btn${isUrgentKind(contact.kind) ? ' is-urgent' : ''}`} href={phoneHref}>
          <Icon name="phone" />
          {contact.phone}
        </a>
      ) : (
        <div className="tp-notes-emergency-actions">
          <button type="button" className="tp-notes-emergency-icon-btn" onClick={onEdit} aria-label={`編輯：${contact.name}`} title="編輯" data-testid={`emergency-edit-${contact.id}`}>
            <Icon name="edit" />
          </button>
          <button type="button" className="tp-notes-emergency-icon-btn is-danger" onClick={onDelete} aria-label={`刪除：${contact.name}`} title="刪除" data-testid={`emergency-delete-${contact.id}`}>
            <Icon name="trash" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function EmergencySection({ tripId, items, onChange }: EmergencySectionProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAdd = useCallback(async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const created = await apiFetch<TripEmergencyContact>(`/trips/${tripId}/notes/emergency`, { method: 'POST', body: JSON.stringify({}) });
      onChange([...items, created]);
      setEditingId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增失敗');
    } finally {
      setBusy(false);
    }
  }, [tripId, items, onChange, busy]);

  const handleSaveField = useCallback(async (contactId: number, field: keyof TripEmergencyContact, value: string) => {
    const contact = items.find((c) => c.id === contactId);
    if (!contact) return;
    if (contact[field] === value) return;
    setError(null);
    try {
      const snake = field.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
      const updated = await apiFetch<TripEmergencyContact>(`/trips/${tripId}/notes/emergency/${contactId}`, {
        method: 'PATCH',
        body: JSON.stringify({ [snake]: value, expectedVersion: contact.version }),
      });
      onChange(items.map((c) => (c.id === contactId ? updated : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗');
    }
  }, [tripId, items, onChange]);

  const handleDelete = useCallback(async (contactId: number) => {
    setError(null);
    try {
      await apiFetch(`/trips/${tripId}/notes/emergency/${contactId}`, { method: 'DELETE' });
      onChange(items.filter((c) => c.id !== contactId));
      setPendingDeleteId(null);
      if (editingId === contactId) setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除失敗');
    }
  }, [tripId, items, onChange, editingId]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((c) => c.id === active.id);
    const newIndex = items.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    onChange(reordered);
    try {
      await apiFetch(`/trips/${tripId}/notes/emergency/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ items: reordered.map((c, i) => ({ id: c.id, sortOrder: i })) }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '排序失敗');
      onChange(items);
    }
  }, [tripId, items, onChange]);

  const pendingDeleteContact = pendingDeleteId !== null ? items.find((c) => c.id === pendingDeleteId) : null;

  return (
    <div className="tp-notes-emergency-section" data-testid="emergency-section">
      <style>{SCOPED_STYLES}</style>
      {error && (
        <div style={{ padding: '0 16px' }}>
          <AlertPanel variant="error" title="緊急聯絡操作失敗" message={`${error}。你的編輯內容還在，請點重試。`} actionLabel="重試" onAction={() => setError(null)} />
        </div>
      )}

      {items.length > 0 && (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="tp-notes-emergency-rows">
              {items.map((contact) => (
                <SortableEmergencyRow
                  key={contact.id}
                  contact={contact}
                  isEditing={editingId === contact.id}
                  onEdit={() => setEditingId(contact.id)}
                  onCloseEdit={() => setEditingId(null)}
                  onSaveField={(field, value) => void handleSaveField(contact.id, field, value)}
                  onDelete={() => setPendingDeleteId(contact.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button type="button" className="tp-notes-add-row-btn" onClick={() => void handleAdd()} disabled={busy} data-testid="emergency-add-btn">
        <Icon name="plus" />
        加聯絡人
      </button>

      <ConfirmModal
        open={pendingDeleteContact !== null}
        title="刪除聯絡人？"
        message={pendingDeleteContact ? `「${pendingDeleteContact.name || '未命名聯絡人'}」將被刪除，此操作無法復原。` : ''}
        confirmLabel="刪除"
        cancelLabel="取消"
        onConfirm={() => pendingDeleteContact && void handleDelete(pendingDeleteContact.id)}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
