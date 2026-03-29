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
// Single Toast Item
// ---------------------------------------------------------------------------

const TYPE_STYLES: Record<ToastType, string> = {
  error: 'bg-(--color-destructive-bg) text-(--color-destructive)',
  success: 'bg-(--color-success-bg) text-(--color-success)',
  info: 'bg-(--color-glass-toast) text-foreground',
  offline: 'bg-(--color-glass-toast) text-warning',
  online: 'bg-(--color-glass-toast) text-success',
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
        'flex items-center gap-2 px-5 py-3',
        'rounded-lg backdrop-blur-xl',
        'shadow-(--shadow-toast)',
        'text-subheadline font-semibold whitespace-nowrap',
        'max-w-[400px] w-full sm:w-auto',
        TYPE_STYLES[toast.type],
        exiting ? 'animate-toast-slide-up opacity-0' : 'animate-toast-slide-down',
      ].join(' ')}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="flex items-center shrink-0" aria-hidden="true">
        <ToastIcon type={toast.type} />
      </span>
      <span className="truncate">{toast.message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ToastIcon({ type }: { type: ToastType }) {
  if (type === 'error') return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
  if (type === 'success' || type === 'online') return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M6.5 10.5 L9 13 L14 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (type === 'offline') return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 7.5a10 10 0 0 1 14 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M5.5 10.5a6.5 6.5 0 0 1 9 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M8 13.5a3 3 0 0 1 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="10" cy="16" r="1.2" fill="currentColor"/>
      <line x1="2" y1="18" x2="18" y2="2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
  // info
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M10 9v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="10" cy="6.5" r="1" fill="currentColor"/>
    </svg>
  );
}
