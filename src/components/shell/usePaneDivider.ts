/**
 * 中欄／右欄分隔線（#1710）的拖曳、鍵盤與夾值邏輯，從 AppShell 抽出；AppShell 只組裝。
 * 夾值範圍同時餵給 aria-valuemin／valuemax，輔助科技看到的刻度才等於實際走得到的範圍。
 */
import { useCallback, useLayoutEffect, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';

export const MIN_MAIN_PX = 400;
export const MIN_SHEET_PX = 360;
const KEY_STEP = 2;

/** 中欄＋右欄總寬換算的百分比夾值範圍；量不到寬度（total=0）時退回 0–100。
 *  shortcut: 視窗窄到兩個最小寬放不下時 min > max，以中欄最小寬為準。 */
export function paneBounds(total: number): { min: number; max: number } {
  if (!total) return { min: 0, max: 100 };
  const min = (MIN_MAIN_PX / total) * 100;
  return { min, max: Math.max(100 - (MIN_SHEET_PX / total) * 100, min) };
}

export function usePaneDivider(mainRef: RefObject<HTMLElement | null>, sheetRef: RefObject<HTMLElement | null>) {
  const [mainPct, setMainPct] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [total, setTotal] = useState(0);

  const measure = useCallback(
    () => (mainRef.current?.getBoundingClientRect().width ?? 0) + (sheetRef.current?.getBoundingClientRect().width ?? 0),
    [mainRef, sheetRef],
  );

  // 側欄收合、視窗縮放都會改變兩欄總寬；ResizeObserver 不存在的環境退回 window resize。
  useLayoutEffect(() => {
    const update = () => setTotal(measure());
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const ro = new ResizeObserver(update);
    if (mainRef.current) ro.observe(mainRef.current);
    if (sheetRef.current) ro.observe(sheetRef.current);
    return () => ro.disconnect();
  }, [measure, mainRef, sheetRef]);

  const clampPct = (pct: number) => {
    const t = measure();
    if (!t) return pct;
    const { min, max } = paneBounds(t);
    return Math.min(Math.max(pct, min), max);
  };

  const bounds = paneBounds(total);
  const paneRest = `minmax(${MIN_MAIN_PX}px, ${mainPct}fr) minmax(${MIN_SHEET_PX}px, ${100 - mainPct}fr)`;
  const gridStyle = mainPct === 50 ? undefined : {
    ['--grid-3pane-rest' as string]: paneRest,
    ['--grid-3pane-desktop' as string]: `var(--sidebar-width-desktop) ${paneRest}`,
  };

  const dividerProps = {
    role: 'separator' as const,
    'aria-orientation': 'vertical' as const,
    'aria-label': '調整中欄與右欄寬度',
    'aria-valuemin': Math.round(bounds.min),
    'aria-valuemax': Math.round(bounds.max),
    'aria-valuenow': Math.round(mainPct),
    tabIndex: 0,
    className: 'app-shell-divider',
    'data-testid': 'app-shell-divider',
    'data-dragging': dragging ? 'true' : 'false',
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => { e.currentTarget.setPointerCapture(e.pointerId); setDragging(true); },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (!dragging || !mainRef.current) return;
      const t = measure();
      if (!t) return;
      setMainPct(clampPct(((e.clientX - mainRef.current.getBoundingClientRect().left) / t) * 100));
    },
    onPointerUp: () => setDragging(false),
    onPointerCancel: () => setDragging(false),
    onDoubleClick: () => setMainPct(50),
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      const d = e.key === 'ArrowRight' ? KEY_STEP : e.key === 'ArrowLeft' ? -KEY_STEP : 0;
      if (!d) return;
      e.preventDefault();
      setMainPct(clampPct(mainPct + d));
    },
  };

  return { gridStyle, dividerProps };
}
