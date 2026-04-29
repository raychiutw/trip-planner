import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import Icon from '../shared/Icon';

/* ===== Menu item config ===== */

type MenuAction = 'sheet' | 'download';

interface MenuItem {
  key: string;
  icon: string;
  label: string;
  action: MenuAction;
  /** If true, disable when offline (write actions only). */
  requiresOnline?: boolean;
  /** Visual group — divider before first item of a new group. */
  group?: string;
}

/** Items that don't have a topbar home — overflow menu hosts them. */
export const OVERFLOW_ITEMS: MenuItem[] = [
  /* Trip content (Item 8: today-route/suggestions/flights now desktop entry points) */
  { key: 'today-route', icon: 'route',        label: '今日路線', action: 'sheet', group: 'trip' },
  { key: 'suggestions', icon: 'lightbulb',    label: 'AI 建議',  action: 'sheet', group: 'trip' },
  { key: 'flights',     icon: 'plane',        label: '航班',     action: 'sheet', group: 'trip' },
  /* Info sheets */
  { key: 'checklist',   icon: 'check-circle', label: '出發清單', action: 'sheet', group: 'info' },
  { key: 'backup',      icon: 'backup',       label: '雨天備案', action: 'sheet', group: 'info' },
  /* Settings */
  { key: 'collab',      icon: 'group',        label: '共編設定', action: 'sheet', requiresOnline: true, group: 'settings' },
  { key: 'trip-select', icon: 'swap-horiz',   label: '切換行程', action: 'sheet', requiresOnline: true, group: 'settings' },
  { key: 'appearance',  icon: 'palette',      label: '外觀設定', action: 'sheet', group: 'settings' },
  /* Downloads */
  { key: 'download-pdf',  icon: 'download',   label: '匯出 PDF',      action: 'download', group: 'export' },
  { key: 'download-md',   icon: 'doc',        label: '匯出 Markdown', action: 'download', group: 'export' },
  { key: 'download-json', icon: 'code',       label: '匯出 JSON',     action: 'download', group: 'export' },
  { key: 'download-csv',  icon: 'table',      label: '匯出 CSV',      action: 'download', group: 'export' },
];

const MENU_WIDTH = 200;
const VIEWPORT_MARGIN = 8;

/* ===== Props ===== */

interface OverflowMenuProps {
  onSheet: (key: string) => void;
  onDownload: (format: string) => void;
  isOnline?: boolean;
}

/* ===== Component ===== */

export default function OverflowMenu({ onSheet, onDownload, isOnline = true }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  /* --- Compute fixed-position coords whenever menu opens / window resizes --- */
  useLayoutEffect(() => {
    if (!open) return;
    function recompute() {
      const btn = triggerRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const vw = window.innerWidth;
      // Prefer right-aligned with button. Clamp so menu stays in viewport.
      const right = vw - r.right;
      let left = vw - MENU_WIDTH - right;
      if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
      if (left + MENU_WIDTH > vw - VIEWPORT_MARGIN) left = vw - MENU_WIDTH - VIEWPORT_MARGIN;
      setPos({ top: r.bottom + 6, left });
    }
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [open]);

  /* --- Escape + click-outside --- */
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

  const handleItem = useCallback((item: MenuItem) => {
    if (!isOnline && item.requiresOnline) return;
    if (item.action === 'sheet') onSheet(item.key);
    else if (item.action === 'download') onDownload(item.key.replace('download-', ''));
    close();
  }, [onSheet, onDownload, isOnline, close]);

  const menu = open && pos ? createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="ocean-overflow-menu"
      aria-label="更多功能"
      style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
    >
      {OVERFLOW_ITEMS.map((item, i) => {
        const disabled = !isOnline && !!item.requiresOnline;
        const prev = OVERFLOW_ITEMS[i - 1];
        const needsDivider = prev && prev.group !== item.group;
        return (
          <div key={item.key} style={{ display: 'contents' }}>
            {needsDivider && <div className="ocean-overflow-divider" role="separator" />}
            <button
              type="button"
              role="menuitem"
              className={clsx('ocean-overflow-item', disabled && 'is-disabled')}
              disabled={disabled}
              onClick={() => handleItem(item)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="tp-titlebar-icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="更多功能"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="more-vert" />
      </button>
      {menu}
    </>
  );
}
