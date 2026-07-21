/**
 * TripActionsMenu — 行程動作「⋯」選單（editorial trip 詳情共用）。
 *
 * v2.57.x 抽出：原本只有 TripsListPage 的 embedded 詳情（/trips?selected=X）有這個選單
 * （原名 EmbeddedActionMenu，local function，未 export）。owner 2026-07-21 回報「開了第三欄
 * 面板後第二欄 header 的操作入口消失」——TripStackLayout（/trip/:id/collab 等 3 欄 host）
 * 的中欄 TitleBar 從一開始就沒有接這組 actions（見 TripStackLayout.tsx 註解「不重造
 * switcher/⋯ menu」的 scope cut）。owner 這輪要求補回，抽成共用元件讓 TripsListPage 與
 * TripStackLayout 兩處中欄都能掛。行為/testid 與原 EmbeddedActionMenu 逐一對應，純搬移。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../shared/Icon';
import type { TripPageHandle } from '../../pages/TripPage';

const MENU_WIDTH = 200;
const VIEWPORT_MARGIN = 8;
/** menu 高度估算（首次 open menuRef 尚未量到時用；~6 項 × 44 + divider + padding）。 */
const ESTIMATED_MENU_HEIGHT = 300;
/** 底部保留高度（GlobalBottomNav ~56 + iOS safe-area + margin）— 往下展開不可侵入這區，否則選單被遮。 */
const BOTTOM_SAFE_AREA = 96;

export const TRIP_ACTIONS_MENU_STYLES = `
.tp-embedded-menu {
  position: fixed;
  min-width: 200px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 4px;
  z-index: var(--z-modal, 9000);
  display: flex; flex-direction: column;
  gap: 1px;
}
.tp-embedded-menu-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  border: none; background: transparent;
  font: inherit; font-size: var(--font-size-callout);
  color: var(--color-foreground);
  text-align: left;
  cursor: pointer;
  border-radius: var(--radius-sm);
  min-height: 40px;
}
.tp-embedded-menu-item:hover { background: var(--color-hover); }
.tp-embedded-menu-item:focus-visible {
  outline: 2px solid var(--color-accent); outline-offset: -2px;
}
.tp-embedded-menu-item .svg-icon { width: 16px; height: 16px; flex-shrink: 0; color: var(--color-muted); }
.tp-embedded-menu-divider {
  height: 1px;
  background: var(--color-border);
  margin: 4px 0;
}
.tp-embedded-menu-section-label {
  font-size: var(--font-size-caption2);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-muted);
  padding: 6px 12px 2px;
}
`;

export interface TripActionsMenuProps {
  tripId: string;
  tripPageRef: RefObject<TripPageHandle | null>;
  onEdit: () => void;
  onCollab: () => void;
  onHealthCheck: () => void;
  onNotes?: () => void;
  onPrint?: () => void;
  onShare?: () => void;
}

export default function TripActionsMenu({ tripId, tripPageRef, onEdit, onCollab, onHealthCheck, onNotes, onPrint, onShare }: TripActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open) return;
    let rafId: number | null = null;
    function recompute() {
      const btn = triggerRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = r.right - MENU_WIDTH;
      if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
      if (left + MENU_WIDTH > vw - VIEWPORT_MARGIN) left = vw - MENU_WIDTH - VIEWPORT_MARGIN;
      // dropUp：往下展開若會被底部（bottom nav + safe area）遮 → 改往上展開（trigger 上方）。
      const menuH = menuRef.current?.offsetHeight || ESTIMATED_MENU_HEIGHT;
      const below = r.bottom + 6;
      const dropUp = below + menuH > vh - BOTTOM_SAFE_AREA && r.top - menuH - 6 >= VIEWPORT_MARGIN;
      setPos({ top: dropUp ? r.top - menuH - 6 : below, left });
    }
    function scheduleRecompute() {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        recompute();
      });
    }
    recompute();
    window.addEventListener('resize', scheduleRecompute, { passive: true });
    window.addEventListener('scroll', scheduleRecompute, { capture: true, passive: true });
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', scheduleRecompute);
      window.removeEventListener('scroll', scheduleRecompute, { capture: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    }
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target) && !triggerRef.current?.contains(target)) {
        close();
      }
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open, close]);

  function runAndClose(fn: () => void) {
    return () => { fn(); close(); };
  }

  const dropdown = open && pos ? createPortal((
    <div
      ref={menuRef}
      role="menu"
      className="tp-embedded-menu"
      style={{ top: pos.top, left: pos.left }}
      data-testid={`trip-embedded-menu-${tripId}`}
    >
      <button
        type="button"
        role="menuitem"
        className="tp-embedded-menu-item"
        onClick={runAndClose(onEdit)}
        data-testid={`trip-embedded-menu-edit-${tripId}`}
      >
        <Icon name="edit" />
        <span>編輯行程</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="tp-embedded-menu-item"
        onClick={runAndClose(onCollab)}
      >
        <Icon name="group" />
        <span>共編設定</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="tp-embedded-menu-item"
        onClick={runAndClose(onHealthCheck)}
        data-testid={`trip-embedded-menu-health-${tripId}`}
      >
        <Icon name="sparkle" />
        <span>AI 健檢</span>
      </button>
      {onNotes && (
        <button
          type="button"
          role="menuitem"
          className="tp-embedded-menu-item"
          onClick={runAndClose(onNotes)}
          data-testid={`trip-embedded-menu-notes-${tripId}`}
        >
          <Icon name="file-text" />
          <span>行程筆記</span>
        </button>
      )}
      <div className="tp-embedded-menu-divider" />
      <button
        type="button"
        role="menuitem"
        className="tp-embedded-menu-item"
        onClick={runAndClose(() => (onPrint ? onPrint() : tripPageRef.current?.togglePrint()))}
        data-testid={`trip-embedded-menu-print-${tripId}`}
      >
        <Icon name="printer" />
        <span>列印</span>
      </button>
      {onShare && (
        <button
          type="button"
          role="menuitem"
          className="tp-embedded-menu-item"
          onClick={runAndClose(onShare)}
          data-testid={`trip-embedded-menu-share-${tripId}`}
        >
          <Icon name="copy" />
          <span>分享連結</span>
        </button>
      )}
      <div className="tp-embedded-menu-divider" />
      <span className="tp-embedded-menu-section-label">下載格式</span>
      <button
        type="button"
        role="menuitem"
        className="tp-embedded-menu-item"
        onClick={runAndClose(() => tripPageRef.current?.triggerDownload('pdf'))}
      >
        <Icon name="download" />
        <span>PDF</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="tp-embedded-menu-item"
        onClick={runAndClose(() => tripPageRef.current?.triggerDownload('json'))}
      >
        <Icon name="code" />
        <span>JSON</span>
      </button>
    </div>
  ), document.body) : null;

  return (
    <>
      <style>{TRIP_ACTIONS_MENU_STYLES}</style>
      <button
        ref={triggerRef}
        type="button"
        className="tp-titlebar-action tp-titlebar-action--icon-only"
        onClick={() => setOpen((v) => !v)}
        aria-label="行程動作"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="trips-embedded-menu-trigger"
      >
        <Icon name="ellipsis" />
      </button>
      {dropdown}
    </>
  );
}
