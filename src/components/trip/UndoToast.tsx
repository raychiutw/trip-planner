/**
 * UndoToast — drag 完成後 5 秒 revert 視窗。
 *
 * Spec: openspec/changes/ideas-drag-to-itinerary/specs/drag-to-promote/spec.md
 *   "Undo toast 於 drag 完成後 5 秒內可 revert"。
 *
 * 設計：
 *   - 接 `open=true` → 啟動 `durationMs` 倒數，到時 `onTimeout`
 *   - 5 秒內點「undo」→ `onUndo` 並關閉 toast
 *   - 重新觸發 (open false → true) → 倒數 reset
 *   - 父層管狀態，toast 純視覺 + timer
 */
import { useEffect, useRef } from 'react';

const SCOPED_STYLES = `
.tp-undo-toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 1100;
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-full);
  background: var(--color-foreground);
  color: var(--color-background);
  box-shadow: var(--shadow-lg);
  font-size: var(--font-size-callout);
  font-weight: 600;
  max-width: min(420px, calc(100vw - 32px));
}
.tp-undo-toast button {
  font: inherit; font-weight: 800;
  padding: 6px 12px;
  border-radius: var(--radius-full);
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  cursor: pointer;
  min-height: var(--spacing-tap-min);
}
.tp-undo-toast button:hover {
  filter: brightness(0.95);
}
@media (prefers-reduced-motion: no-preference) {
  .tp-undo-toast {
    animation: tp-undo-toast-in 200ms var(--transition-timing-function-apple, ease-out);
  }
  @keyframes tp-undo-toast-in {
    from { opacity: 0; transform: translate(-50%, 12px); }
    to   { opacity: 1; transform: translate(-50%, 0); }
  }
}
`;

export interface UndoToastProps {
  open: boolean;
  message: string;
  durationMs?: number;
  onUndo: () => void;
  onTimeout: () => void;
  /** stable key — change to reset countdown for a new event */
  resetKey?: number | string;
}

const DEFAULT_DURATION_MS = 5000;

export default function UndoToast({
  open,
  message,
  durationMs = DEFAULT_DURATION_MS,
  onUndo,
  onTimeout,
  resetKey,
}: UndoToastProps) {
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => onTimeoutRef.current(), durationMs);
    return () => clearTimeout(timer);
  }, [open, durationMs, resetKey]);

  if (!open) return null;
  return (
    <div className="tp-undo-toast" role="status" aria-live="polite" data-testid="undo-toast">
      <style>{SCOPED_STYLES}</style>
      <span>{message}</span>
      <button type="button" onClick={onUndo} data-testid="undo-toast-action">undo</button>
    </div>
  );
}
