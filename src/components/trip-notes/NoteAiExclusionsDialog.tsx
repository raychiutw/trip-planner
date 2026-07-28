import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSheetBehavior } from '../../hooks/useSheetBehavior';
import { apiFetch } from '../../lib/apiClient';

export type NoteAiDocType = 'lodging-tips' | 'tips' | 'emergency';

interface Exclusion {
  id: number;
  docType: NoteAiDocType;
  semanticKey: string;
  label: string;
  deletedAt: string;
}

interface NoteAiExclusionsDialogProps {
  open: boolean;
  tripId: string;
  docTypes: NoteAiDocType[];
  title: string;
  onClose: () => void;
  onRestored: () => void;
}

const DOC_TYPE_LABELS: Record<NoteAiDocType, string> = {
  'lodging-tips': '住宿建議',
  tips: '一般須知',
  emergency: '緊急聯絡',
};

const STYLES = `
.tp-note-ai-exclusions-backdrop {
  position: fixed; inset: 0; z-index: var(--z-modal, 9000);
  display: grid; place-items: center; padding: 20px;
  background: var(--color-overlay);
}
.tp-note-ai-exclusions-dialog {
  width: min(480px, 100%); max-height: min(680px, calc(100vh - 40px));
  overflow: auto; padding: 20px;
  border: 1px solid var(--color-border); border-radius: var(--radius-lg);
  background: var(--color-background); color: var(--color-foreground);
  box-shadow: var(--shadow-lg);
}
.tp-note-ai-exclusions-head { display: flex; align-items: flex-start; gap: 12px; }
.tp-note-ai-exclusions-title { flex: 1; margin: 0; font-size: var(--font-size-title3); }
.tp-note-ai-exclusions-close {
  width: var(--spacing-tap-min); height: var(--spacing-tap-min);
  border: 0; border-radius: var(--radius-full); background: transparent;
  color: var(--color-muted); cursor: pointer; font-size: 20px;
}
.tp-note-ai-exclusions-close:hover { background: var(--color-secondary); color: var(--color-foreground); }
.tp-note-ai-exclusions-help, .tp-note-ai-exclusions-state {
  margin: 6px 0 14px; color: var(--color-muted);
  font-size: var(--font-size-footnote); line-height: 1.5;
}
.tp-note-ai-exclusions-list { list-style: none; padding: 0; margin: 0; }
.tp-note-ai-exclusions-item {
  display: flex; align-items: center; gap: 12px;
  min-height: var(--spacing-tap-min); padding: 12px 0;
  border-top: 1px solid var(--color-border);
}
.tp-note-ai-exclusions-copy { flex: 1; min-width: 0; }
.tp-note-ai-exclusions-label { font-size: var(--font-size-subheadline); font-weight: 650; }
.tp-note-ai-exclusions-meta { margin-top: 2px; color: var(--color-muted); font-size: var(--font-size-caption); }
.tp-note-ai-exclusions-restore {
  min-height: var(--spacing-tap-min); padding: 8px 14px;
  border: 0; border-radius: var(--radius-full);
  background: var(--color-accent-subtle); color: var(--color-accent-deep);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 700; cursor: pointer;
}
.tp-note-ai-exclusions-restore:disabled { opacity: .55; cursor: wait; }
.tp-note-ai-exclusions-dialog :focus-visible {
  outline: 2px solid var(--color-focus-ring); outline-offset: 2px;
}
`;

function formatDeletedAt(value: string): string {
  const date = new Date(`${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function NoteAiExclusionsDialog({
  open,
  tripId,
  docTypes,
  title,
  onClose,
  onRestored,
}: NoteAiExclusionsDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [items, setItems] = useState<Exclusion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const { panelRef, backdropRef, handlePanelKeyDown } = useSheetBehavior(open, onClose, {
    initialFocusRef: closeRef,
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all(docTypes.map(async (docType) => {
      const response = await apiFetch<{ items: Exclusion[] }>(
        `/trips/${tripId}/notes/${docType}/exclusions`,
      );
      return response.items ?? [];
    })).then((groups) => {
      if (!cancelled) setItems(groups.flat());
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : '載入失敗');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, tripId, docTypes]);

  if (!open || typeof document === 'undefined') return null;

  const restore = async (item: Exclusion) => {
    setRestoringId(item.id);
    setError(null);
    try {
      await apiFetch(
        `/trips/${tripId}/notes/${item.docType}/exclusions/${item.id}`,
        { method: 'DELETE' },
      );
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      onRestored();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '恢復失敗');
    } finally {
      setRestoringId(null);
    }
  };

  return createPortal(
    <>
      <style>{STYLES}</style>
      <div
        ref={backdropRef}
        className="tp-note-ai-exclusions-backdrop"
        role="presentation"
        onClick={onClose}
      >
        <div
          ref={panelRef}
          className="tp-note-ai-exclusions-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tp-note-ai-exclusions-title"
          aria-describedby="tp-note-ai-exclusions-help"
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={handlePanelKeyDown}
        >
          <div className="tp-note-ai-exclusions-head">
            <h2 id="tp-note-ai-exclusions-title" className="tp-note-ai-exclusions-title">{title}</h2>
            <button
              ref={closeRef}
              type="button"
              className="tp-note-ai-exclusions-close"
              aria-label="關閉已排除項目"
              onClick={onClose}
            >
              ×
            </button>
          </div>
          <p id="tp-note-ai-exclusions-help" className="tp-note-ai-exclusions-help">
            恢復後不會立刻加入；下次重新生成時才允許再次出現。
          </p>
          <div role="status" aria-live="polite" aria-atomic="true">
            {loading && <p className="tp-note-ai-exclusions-state">載入中…</p>}
            {error && <p className="tp-note-ai-exclusions-state">無法完成操作：{error}</p>}
            {!loading && !error && items.length === 0 && (
              <p className="tp-note-ai-exclusions-state">目前沒有已排除項目。</p>
            )}
          </div>
          {!loading && items.length > 0 && (
            <ul className="tp-note-ai-exclusions-list">
              {items.map((item) => (
                <li key={`${item.docType}:${item.id}`} className="tp-note-ai-exclusions-item">
                  <div className="tp-note-ai-exclusions-copy">
                    <div className="tp-note-ai-exclusions-label">{item.label}</div>
                    <div className="tp-note-ai-exclusions-meta">
                      {DOC_TYPE_LABELS[item.docType]} · {formatDeletedAt(item.deletedAt)} 刪除
                    </div>
                  </div>
                  <button
                    type="button"
                    className="tp-note-ai-exclusions-restore"
                    aria-label={`恢復「${item.label}」`}
                    disabled={restoringId === item.id}
                    onClick={() => void restore(item)}
                  >
                    {restoringId === item.id ? '恢復中…' : '恢復'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
