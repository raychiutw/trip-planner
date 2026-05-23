/**
 * toastBus.ts — leaf-layer pub/sub for global toast notifications.
 *
 * v2.33.54 round 10: extracted from `src/components/shared/Toast.tsx` to break
 * the `lib → components` reverse import (tripExport.ts previously imported
 * `showToast` from a component file).
 *
 * `lib/` is the architectural leaf — no React, no JSX, no component imports.
 * <ToastContainer> in components/shared/Toast.tsx subscribes via the listener
 * registry exported here.
 */

import type { ErrorSeverity } from './errors';

export type ToastType = 'error' | 'success' | 'info' | 'offline' | 'online';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  /** ms — 預設 3000 */
  duration?: number;
}

type Listener = () => void;
let nextId = 1;
let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((fn) => fn());
}

export function getToasts(): readonly ToastItem[] {
  return toasts;
}

export function subscribeToasts(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function showToast(message: string, type: ToastType = 'info', duration = 3000): void {
  toasts = [...toasts, { id: nextId++, message, type, duration }];
  notify();
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

/** @internal — for testing only */
export function resetToasts(): void {
  toasts = [];
  notify();
}

/** 根據錯誤嚴重度顯示 Toast — minor 不跳。 */
export function showErrorToast(message: string, severity: ErrorSeverity): void {
  if (severity === 'minor') return;
  showToast(message, severity === 'background' ? 'info' : 'error');
}
