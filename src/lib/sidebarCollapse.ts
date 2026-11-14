import { useSyncExternalStore } from 'react';

/**
 * 桌機側欄整欄隱藏（#1708，原型 #1704 變體 A）。
 * - 寬視窗：手動偏好 `pref` 存 localStorage，跨頁、跨 session 保留。
 * - 窄視窗（<1200px）：預設收合；手動展開只是暫時的 `narrowOpen`（推開內容），不寫入偏好，
 *   跨過門檻就重設 —— 自動行為因此永遠不會覆寫手動偏好。
 */
const KEY = 'tp-sidebar-collapsed';
const QUERY = '(max-width: 1199.98px)';

const mql = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null;

function readPref(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

let pref = readPref();
let narrow = mql?.matches ?? false;
let narrowOpen = false;
let snapshot = compute();
const subs = new Set<() => void>();

function compute() { return narrow ? !narrowOpen : pref; }
function emit() {
  const next = compute();
  if (next !== snapshot) { snapshot = next; subs.forEach((f) => f()); }
}

mql?.addEventListener('change', (e) => { narrow = e.matches; narrowOpen = false; emit(); });

export function toggleSidebar(): void {
  if (narrow) narrowOpen = !narrowOpen;
  else {
    pref = !pref;
    try { localStorage.setItem(KEY, pref ? '1' : '0'); } catch { /* 無痕模式等：本次 session 仍有效 */ }
  }
  emit();
}

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => snapshot, () => false);
}
