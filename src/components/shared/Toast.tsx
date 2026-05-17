import { useState, useEffect, useCallback, useRef } from 'react';
import type { ErrorSeverity } from '../../lib/errors';

// ---------------------------------------------------------------------------
// Toast Types
// ---------------------------------------------------------------------------

export type ToastType = 'error' | 'success' | 'info' | 'offline' | 'online';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  duration?: number; // ms, 預設 3000
}

// ---------------------------------------------------------------------------
// Global Toast Store（module-level singleton）
// ---------------------------------------------------------------------------

type Listener = () => void;
let nextId = 1;
let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function notify() { listeners.forEach(fn => fn()); }

export function showToast(message: string, type: ToastType = 'info', duration = 3000) {
  toasts = [...toasts, { id: nextId++, message, type, duration }];
  notify();
}

export function dismissToast(id: number) {
  toasts = toasts.filter(t => t.id !== id);
  notify();
}

/** @internal — for testing only */
export function resetToasts() {
  toasts = [];
  notify();
}

/** 根據錯誤嚴重度顯示 Toast */
export function showErrorToast(message: string, severity: ErrorSeverity) {
  if (severity === 'minor') return; // 輕微錯誤不跳 Toast
  showToast(message, severity === 'background' ? 'info' : 'error');
}

// ---------------------------------------------------------------------------
// Toast Container（render 所有 toast）
// ---------------------------------------------------------------------------

export default function ToastContainer() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate(n => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  return (
    <div className="fixed top-toast-top left-0 right-0 z-250 flex flex-col items-center gap-2 pointer-events-none px-4">
      {toasts.map(toast => (
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
