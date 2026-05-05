/**
 * ConflictModal — 同 day 同時段衝突解決 dialog (v2.21.0 MF2)
 *
 * 用於 AddPoiFavoriteToTripPage 提交時 server 回 409。Server contract:
 *   { error: 'CONFLICT', conflictWith: { entryId, time, title, dayNum } }
 *
 * 三選 action：
 *   - 取消（取消這次加入，回頁面）
 *   - 取代既有（DELETE 衝突 entry → INSERT 新景點）
 *   - 改插入到後面（position=after, anchor=conflict.entryId）
 *
 * Visual spec 對齊 ConfirmModal pattern (DESIGN.md L383-491)，但 alertdialog
 * 標題色用 warning（不是 destructive，因為「取代」 才 destructive，整個 modal
 * 不是）。
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const SCOPED_STYLES = `
.tp-conflict-backdrop {
  position: fixed; inset: 0;
  z-index: 1100;
  background: rgba(20, 14, 9, 0.42);
  display: grid; place-items: center;
  padding: 20px;
  animation: tp-conflict-backdrop-in 150ms var(--transition-timing-function-apple);
}
@keyframes tp-conflict-backdrop-in { from { opacity: 0; } to { opacity: 1; } }

.tp-conflict-modal {
  width: min(440px, 100%);
  border-radius: var(--radius-xl);
  background: var(--color-background);
  color: var(--color-foreground);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border);
  padding: 20px;
  animation: tp-conflict-modal-in 200ms var(--transition-timing-function-apple);
}
@keyframes tp-conflict-modal-in {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.tp-conflict-title {
  margin: 0 0 8px;
  font-size: var(--font-size-title3);
  font-weight: 700;
  color: var(--color-foreground);
}
.tp-conflict-message {
  margin: 0 0 12px;
  font-size: var(--font-size-callout);
  line-height: 1.55;
  color: var(--color-muted);
}
.tp-conflict-summary {
  margin: 0 0 20px;
  padding: 12px 14px;
  background: var(--color-secondary);
  border-left: 3px solid var(--color-warning, #c88500);
  border-radius: var(--radius-md);
  font-size: var(--font-size-footnote);
  color: var(--color-foreground);
}
.tp-conflict-summary strong { color: var(--color-foreground); font-weight: 700; }

.tp-conflict-actions {
  display: flex; flex-direction: column; gap: 8px;
}
.tp-conflict-btn {
  width: 100%;
  min-height: var(--spacing-tap-min);
  border-radius: var(--radius-full);
  font: inherit;
  font-weight: 700;
  font-size: var(--font-size-footnote);
  cursor: pointer;
  border: 1px solid;
  transition: background 120ms, border-color 120ms;
}
.tp-conflict-btn-replace {
  background: var(--color-priority-high-dot, #c0392b);
  color: #fff;
  border-color: var(--color-priority-high-dot, #c0392b);
}
.tp-conflict-btn-replace:hover { filter: brightness(0.92); }
.tp-conflict-btn-replace:focus-visible { outline: 2px solid var(--color-priority-high-dot, #c0392b); outline-offset: 2px; }

.tp-conflict-btn-after {
  background: var(--color-accent);
  color: var(--color-accent-foreground, #fff);
  border-color: var(--color-accent);
}
.tp-conflict-btn-after:hover { filter: brightness(0.92); }
.tp-conflict-btn-after:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }

.tp-conflict-btn-cancel {
  background: var(--color-secondary);
  color: var(--color-foreground);
  border-color: var(--color-border);
}
.tp-conflict-btn-cancel:hover { background: var(--color-tertiary); border-color: var(--color-line-strong); }
.tp-conflict-btn-cancel:focus-visible { outline: 2px solid var(--color-foreground); outline-offset: 2px; }

.tp-conflict-btn:disabled { opacity: 0.6; cursor: not-allowed; }
`;

export interface ConflictWith {
  entryId: number;
  time: string | null;
  title: string;
  dayNum?: number;
}

export interface ConflictModalProps {
  open: boolean;
  conflictWith: ConflictWith | null;
  busy?: boolean;
  onCancel: () => void;
  /** v2.22.0 4-field schema 不支援 replace；caller 不傳 → 隱藏 button */
  onReplace?: () => void;
  /** v2.22.0 4-field schema 不支援 push-after；caller 不傳 → 隱藏 button */
  onPushAfter?: () => void;
}

export default function ConflictModal({
  open,
  conflictWith,
  busy = false,
  onCancel,
  onReplace,
  onPushAfter,
}: ConflictModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open || !conflictWith) return null;
  if (typeof document === 'undefined') return null;

  const dayLabel = conflictWith.dayNum ? `Day ${conflictWith.dayNum}` : '同天';
  const timeLabel = conflictWith.time ? ` · ${conflictWith.time}` : '';

  return createPortal(
    <>
      <style>{SCOPED_STYLES}</style>
      <div
        className="tp-conflict-backdrop"
        role="presentation"
        onClick={onCancel}
        data-testid="conflict-modal-backdrop"
      >
        <div
          className="tp-conflict-modal"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="tp-conflict-title"
          aria-describedby="tp-conflict-message"
          onClick={(e) => e.stopPropagation()}
          data-testid="conflict-modal"
        >
          <h2 className="tp-conflict-title" id="tp-conflict-title">該時段已有景點</h2>
          <p className="tp-conflict-message" id="tp-conflict-message">
            這個時段已經安排了景點。要怎麼處理？
          </p>
          <div className="tp-conflict-summary" data-testid="conflict-modal-summary">
            <strong>{dayLabel}{timeLabel}</strong>
            <br />
            {conflictWith.title}
          </div>
          <div className="tp-conflict-actions">
            {onPushAfter && (
              <button
                type="button"
                className="tp-conflict-btn tp-conflict-btn-after"
                onClick={onPushAfter}
                disabled={busy}
                data-testid="conflict-modal-after"
              >
                {busy ? '處理中…' : '改插入到後面'}
              </button>
            )}
            {onReplace && (
              <button
                type="button"
                className="tp-conflict-btn tp-conflict-btn-replace"
                onClick={onReplace}
                disabled={busy}
                data-testid="conflict-modal-replace"
              >
                {busy ? '處理中…' : '取代既有'}
              </button>
            )}
            <button
              ref={cancelRef}
              type="button"
              className="tp-conflict-btn tp-conflict-btn-cancel"
              onClick={onCancel}
              disabled={busy}
              data-testid="conflict-modal-cancel"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
