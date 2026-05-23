import { useState, useEffect, useCallback, useRef } from 'react';
// v2.33.54 round 10: state machine + helpers 拆到 src/lib/toastBus
// 解 lib→components reverse import（tripExport.ts 以前從這檔 import showToast）。
// 仍 re-export 既有公開 API 維持 backward compat (17 個 caller 不動)。
import {
  ToastType,
  ToastItem,
  showToast,
  dismissToast,
  resetToasts,
  showErrorToast,
  subscribeToasts,
  getToasts,
} from '../../lib/toastBus';

export type { ToastType, ToastItem };
export { showToast, dismissToast, resetToasts, showErrorToast };

// ---------------------------------------------------------------------------
// Toast Container（render 所有 toast）
// ---------------------------------------------------------------------------

export default function ToastContainer() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    return subscribeToasts(() => forceUpdate((n) => n + 1));
  }, []);

  return (
    <div className="fixed top-toast-top left-0 right-0 z-250 flex flex-col items-center gap-2 pointer-events-none px-4">
      {getToasts().map((toast) => (
        <ToastBubble key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single Toast Item — v2.31.38: V1 redesign aligned with terracotta-preview-v2.html
// `.tp-status-toast` pattern (white card + colored dot + colored border).
// ---------------------------------------------------------------------------

const TYPE_CLASS: Record<ToastType, string> = {
  error: 'tp-toast tp-toast--error',
  success: 'tp-toast tp-toast--success',
  info: 'tp-toast tp-toast--info',
  offline: 'tp-toast tp-toast--warning',
  online: 'tp-toast tp-toast--success',
};

function ToastBubble({ toast }: { toast: ToastItem }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => dismissToast(toast.id), 300);
  }, [toast.id]);

  useEffect(() => {
    const duration = toast.duration ?? 3000;
    timerRef.current = setTimeout(dismiss, duration);
    return () => clearTimeout(timerRef.current);
  }, [toast.duration, dismiss]);

  return (
    <div
      className={[
        TYPE_CLASS[toast.type],
        exiting ? 'animate-toast-slide-up opacity-0' : 'animate-toast-slide-down',
      ].join(' ')}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="truncate">{toast.message}</span>
    </div>
  );
}
