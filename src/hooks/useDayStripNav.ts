import { useRef, useEffect, type KeyboardEvent as ReactKeyboardEvent } from 'react';

/**
 * useDayStripNav — 水平 day-tab strip 的鍵盤 + active-tab 置中共用邏輯（HIG W9）。
 *
 * 行程明細（`DayNav`）與地圖（`MapPage`）兩處 day strip 要有一致的 a11y：
 *   1. active tab 切換時水平捲入置中（首次 mount 用 instant，避免跟中欄 `#dayN`
 *      anchor 的垂直 smooth scroll 同時 fight，iOS Safari 會 snap-back）
 *   2. ArrowLeft/Right roving：在 tab 之間移焦並切換（鍵盤 user 可水平走 day）
 *
 * 抽成 hook 讓兩處共用、行為不漂移 —— 原本只有 DayNav 有這套，MapPage 的
 * `.tp-map-day-tabs` 缺置中與鍵盤。key 泛型：DayNav 用 `dayNum`(number)，
 * MapPage 用 `'overview' | number`（兩者皆 primitive，useEffect dep 比對成立）。
 *
 * 「滑動只瀏覽、點擊才切」為天然行為（tab 是 button，捲 strip 不觸發 onPick）。
 */
export interface UseDayStripNavOptions<K> {
  /** 依序的 tab keys（roving 用此順序） */
  keys: K[];
  /** 目前 selected key */
  activeKey: K;
  /** 切換 callback */
  onPick: (key: K) => void;
  /** key → data-testid，用於置中定位與 roving 後移焦 */
  testId: (key: K) => string;
}

export function useDayStripNav<K>({ keys, activeKey, onPick, testId }: UseDayStripNavOptions<K>) {
  const navRef = useRef<HTMLElement>(null);
  // First-mount guard：初次 render 用 instant scroll，subsequent 才 smooth。
  const firstMountRef = useRef(true);
  // 最新的 keys/onPick/testId 放 ref，讓置中 effect 只依賴 activeKey（不因
  // caller 每 render 傳新 inline arrow 而重跑）。
  const latest = useRef({ keys, onPick, testId });
  latest.current = { keys, onPick, testId };

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const btn = nav.querySelector<HTMLElement>(`[data-testid="${latest.current.testId(activeKey)}"]`);
    if (!btn) return;
    const left = btn.offsetLeft - nav.offsetWidth / 2 + btn.offsetWidth / 2;
    // jsdom / 舊瀏覽器可能沒有 Element.scrollTo —— 有才捲，別讓置中把整頁弄崩。
    if (typeof nav.scrollTo === 'function') {
      nav.scrollTo({
        left: Math.max(0, left),
        behavior: firstMountRef.current ? 'auto' : 'smooth',
      });
    }
    firstMountRef.current = false;
  }, [activeKey]);

  function handleKeyDown(e: ReactKeyboardEvent<HTMLElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const { keys, onPick, testId } = latest.current;
    const idx = keys.indexOf(activeKey);
    if (idx < 0) return;
    const nextIdx = e.key === 'ArrowLeft'
      ? Math.max(0, idx - 1)
      : Math.min(keys.length - 1, idx + 1);
    if (nextIdx === idx) return;
    e.preventDefault();
    const nextKey = keys[nextIdx]!;
    onPick(nextKey);
    // 移焦到新 active button，讓 user 可繼續 arrow。
    requestAnimationFrame(() => {
      const btn = navRef.current?.querySelector<HTMLElement>(`[data-testid="${testId(nextKey)}"]`);
      btn?.focus();
    });
  }

  return { navRef, handleKeyDown };
}
