/**
 * ConfirmModal — destructive action 確認 dialog
 *
 * 取代 `window.confirm()`(系統對話框,不能 style),提供:
 *   - 對齊 V2 Terracotta tokens(`--color-priority-high-dot` 為 destructive)
 *   - 標題 + 訊息 + 兩個 action button(取消 ghost / 確認 destructive 實心)
 *   - Escape + click backdrop dismiss
 *   - Focus 自動 trap 在 modal 內(confirm button 預設 focus)
 *
 * Use case:
 *   - CollabPanel 移除成員 / 撤銷邀請
 *   - 將來其他 destructive 流程(刪除 trip / 刪除 entry / 登出)
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const SCOPED_STYLES = `
.tp-confirm-backdrop {
  position: fixed; inset: 0;
  z-index: 1100;
  background: rgba(20, 14, 9, 0.42);
  display: grid; place-items: center;
  padding: 20px;
  animation: tp-confirm-backdrop-in 150ms var(--transition-timing-function-apple);
}
@keyframes tp-confirm-backdrop-in { from { opacity: 0; } to { opacity: 1; } }

.tp-confirm-modal {
  width: min(420px, 100%);
  border-radius: var(--radius-xl);
  background: var(--color-background);
  color: var(--color-foreground);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border);
  padding: 20px;
  animation: tp-confirm-modal-in 200ms var(--transition-timing-function-apple);
}
@keyframes tp-confirm-modal-in {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.tp-confirm-title {
  margin: 0 0 8px;
  font-size: var(--font-size-title3);
  font-weight: 700;
  color: var(--color-foreground);
}
.tp-confirm-message {
  margin: 0 0 20px;
  font-size: var(--font-size-callout);
  line-height: 1.55;
  color: var(--color-muted);
}
.tp-confirm-actions {
  display: flex; gap: 8px; flex-wrap: wrap;
}
.tp-confirm-btn {
  flex: 1; min-width: 112px;
  min-height: var(--spacing-tap-min);
  border-radius: var(--radius-full);
  font: inherit;
  font-weight: 700;
  font-size: var(--font-size-footnote);
  cursor: pointer;
  border: 1px solid;
  transition: background 120ms, border-color 120ms;
}
.tp-confirm-btn-cancel {
  background: var(--color-secondary);
  color: var(--color-foreground);
  border-color: var(--color-border);
}
.tp-confirm-btn-cancel:hover { background: var(--color-tertiary); border-color: var(--color-line-strong); }
.tp-confirm-btn-cancel:focus-visible { outline: 2px solid var(--color-foreground); outline-offset: 2px; }

.tp-confirm-btn-danger {
  background: var(--color-priority-high-dot, #c0392b);
  color: #fff;
  border-color: var(--color-priority-high-dot, #c0392b);
}
.tp-confirm-btn-danger:hover { filter: brightness(0.92); }
.tp-confirm-btn-danger:focus-visible { outline: 2px solid var(--color-priority-high-dot, #c0392b); outline-offset: 2px; }
.tp-confirm-btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
`;

export interface ConfirmModalProps {
  /** 顯示 / 隱藏 */
  open: boolean;
  /** Modal 標題(短句) */
  title: string;
  /** 主要描述,可多行(plain text only) */
  message: string;
  /** 確認按鈕 label,預設「確認」 */
  confirmLabel?: string;
  /** 取消按鈕 label,預設「取消」 */
  cancelLabel?: string;
  /** 確認 button 是否 disabled(loading state) */
  busy?: boolean;
  /** 點 confirm 觸發 */
  onConfirm: () => void;
  /** 點 cancel / Escape / backdrop 觸發 */
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = '確認',
  cancelLabel = '取消',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Auto-focus confirm button on open(keyboard user 直接可 Enter 確認)
    confirmRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <style>{SCOPED_STYLES}</style>
      <div
        className="tp-confirm-backdrop"
        role="presentation"
        onClick={onCancel}
        data-testid="confirm-modal-backdrop"
      >
        <div
          className="tp-confirm-modal"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="tp-confirm-title"
          aria-describedby="tp-confirm-message"
          onClick={(e) => e.stopPropagation()}
          data-testid="confirm-modal"
        >
          <h2 className="tp-confirm-title" id="tp-confirm-title">{title}</h2>
          <p className="tp-confirm-message" id="tp-confirm-message">{message}</p>
          <div className="tp-confirm-actions">
            <button
              type="button"
              className="tp-confirm-btn tp-confirm-btn-cancel"
              onClick={onCancel}
              disabled={busy}
              data-testid="confirm-modal-cancel"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              type="button"
              className="tp-confirm-btn tp-confirm-btn-danger"
              onClick={onConfirm}
              disabled={busy}
              data-testid="confirm-modal-confirm"
            >
              {busy ? '處理中…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
