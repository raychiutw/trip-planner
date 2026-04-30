/**
 * InputModal — single-line text input dialog (取代 window.prompt)
 *
 * 對齊 ConfirmModal 結構：
 *   - V2 Terracotta tokens（accent 確認 / ghost 取消）
 *   - Escape + click backdrop dismiss
 *   - Enter 直接 submit, Auto-focus input on open
 *   - Empty 自動禁用 confirm（除非 allowEmpty 顯式打開）
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const SCOPED_STYLES = `
.tp-input-backdrop {
  position: fixed; inset: 0;
  z-index: 1100;
  background: rgba(20, 14, 9, 0.42);
  display: grid; place-items: center;
  padding: 20px;
  animation: tp-input-backdrop-in 150ms var(--transition-timing-function-apple);
}
@keyframes tp-input-backdrop-in { from { opacity: 0; } to { opacity: 1; } }

.tp-input-modal {
  width: min(420px, 100%);
  border-radius: var(--radius-xl);
  background: var(--color-background);
  color: var(--color-foreground);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border);
  padding: 20px;
  animation: tp-input-modal-in 200ms var(--transition-timing-function-apple);
}
@keyframes tp-input-modal-in {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.tp-input-title {
  margin: 0 0 8px;
  font-size: var(--font-size-title3);
  font-weight: 700;
  color: var(--color-foreground);
}
.tp-input-message {
  margin: 0 0 16px;
  font-size: var(--font-size-callout);
  color: var(--color-muted);
  line-height: 1.4;
}
.tp-input-field {
  width: 100%;
  font: inherit;
  font-size: var(--font-size-body);
  padding: 10px 12px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  margin-bottom: 20px;
  box-sizing: border-box;
}
.tp-input-field:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-bg);
}

.tp-input-actions {
  display: flex; gap: 8px; justify-content: flex-end;
}
.tp-input-btn {
  font: inherit;
  font-size: var(--font-size-callout);
  font-weight: 600;
  padding: 10px 18px;
  border-radius: var(--radius-full);
  cursor: pointer;
  min-height: 44px;
  transition: filter 120ms;
}
.tp-input-btn-cancel {
  background: var(--color-secondary);
  color: var(--color-foreground);
  border: 1px solid var(--color-border);
}
.tp-input-btn-cancel:hover { background: var(--color-hover); }
.tp-input-btn-confirm {
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  border: 1px solid var(--color-accent);
}
.tp-input-btn-confirm:hover { filter: brightness(0.92); }
.tp-input-btn-confirm:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
.tp-input-btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
`;

export interface InputModalProps {
  open: boolean;
  /** Modal 標題（短句） */
  title: string;
  /** 描述（optional） */
  message?: string;
  /** Input placeholder */
  placeholder?: string;
  /** 預設值 */
  defaultValue?: string;
  /** 確認 button label，預設「確認」 */
  confirmLabel?: string;
  /** 取消 button label，預設「取消」 */
  cancelLabel?: string;
  /** 允許空字串提交（預設 false — 空時禁用確認 button） */
  allowEmpty?: boolean;
  /** 點 confirm 觸發，傳 trim 後的 value */
  onConfirm: (value: string) => void;
  /** 點 cancel / Escape / backdrop 觸發 */
  onCancel: () => void;
}

export default function InputModal({
  open,
  title,
  message,
  placeholder,
  defaultValue = '',
  confirmLabel = '確認',
  cancelLabel = '取消',
  allowEmpty = false,
  onConfirm,
  onCancel,
}: InputModalProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset value to defaultValue whenever modal re-opens
  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  useEffect(() => {
    if (!open) return;
    // Auto-focus + select on open
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onCancel]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const trimmed = value.trim();
  const canConfirm = allowEmpty || trimmed.length > 0;

  function submit() {
    if (!canConfirm) return;
    onConfirm(trimmed);
  }

  return createPortal(
    <>
      <style>{SCOPED_STYLES}</style>
      <div
        className="tp-input-backdrop"
        role="presentation"
        onClick={onCancel}
        data-testid="input-modal-backdrop"
      >
        <div
          className="tp-input-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tp-input-title"
          onClick={(e) => e.stopPropagation()}
          data-testid="input-modal"
        >
          <h2 className="tp-input-title" id="tp-input-title">{title}</h2>
          {message && <p className="tp-input-message">{message}</p>}
          <input
            ref={inputRef}
            type="text"
            className="tp-input-field"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            data-testid="input-modal-field"
          />
          <div className="tp-input-actions">
            <button
              type="button"
              className="tp-input-btn tp-input-btn-cancel"
              onClick={onCancel}
              data-testid="input-modal-cancel"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className="tp-input-btn tp-input-btn-confirm"
              onClick={submit}
              disabled={!canConfirm}
              data-testid="input-modal-confirm"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
