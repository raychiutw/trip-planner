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

// 單例守衛（module-level）：rev2 桌機右欄操作堆疊會同時掛載多個 ToastContainer
// （中欄 <TripPage noShell> 一個 + 右欄操作頁一個），兩者共用同一 toast store →
// 每則 toast 被畫兩次、且兩個 `aria-live` 節點讓螢幕閱讀器重複朗讀。只讓「最早掛載
// 且仍存活」的 instance render；primary 卸載時通知其餘 instance 重算接手。
const toastInstances: symbol[] = [];
const instanceListeners = new Set<() => void>();
function notifyInstances() {
  instanceListeners.forEach((fn) => fn());
}

export default function ToastContainer() {
  const [, forceUpdate] = useState(0);
  const idRef = useRef<symbol | null>(null);
  if (!idRef.current) idRef.current = Symbol('toast-container');

  useEffect(() => {
    const id = idRef.current!;
    const rerender = () => forceUpdate((n) => n + 1);
    toastInstances.push(id);
    instanceListeners.add(rerender);
    notifyInstances(); // 掛載改變 primary 歸屬 → 全部 instance 重算
    const unsubToasts = subscribeToasts(rerender);
    return () => {
      const i = toastInstances.indexOf(id);
      if (i >= 0) toastInstances.splice(i, 1);
      instanceListeners.delete(rerender);
      unsubToasts();
      notifyInstances(); // primary 卸載 → 讓下一個 instance 接手 render
    };
  }, []);

  // 只有 primary（清單第一個存活 instance）render toast，其餘 render null。
  if (toastInstances[0] !== idRef.current) return null;

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
