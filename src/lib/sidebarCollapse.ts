import { useSyncExternalStore } from 'react';
import { MQ_BELOW_SIDEBAR_AUTO_COLLAPSE } from './breakpoints';

/**
 * 狀態寫法與 hooks/useMyTrips.ts 一致（模組層變數＋手刻 subscribe/emit＋useSyncExternalStore）：
 * 專案沒有其他共用 store 慣例，且這份狀態要在 React 之外（matchMedia 監聽）就開始追蹤。
 *
 * 桌機側欄整欄隱藏（#1708，原型 #1704 變體 A）。
 * - 寬視窗：手動偏好 `pref` 存 localStorage，跨頁、跨 session 保留。
 * - 窄視窗（<1200px）：預設收合；手動展開只是暫時的 `narrowOpen`（推開內容），不寫入偏好，
 *   跨過門檻就重設 —— 自動行為因此永遠不會覆寫手動偏好。
 */
const KEY = 'tp-sidebar-collapsed';
const QUERY = MQ_BELOW_SIDEBAR_AUTO_COLLAPSE;

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
