/**
 * TripCardMenu — kebab「...」 menu overlay for TripsListPage trip cards.
 *
 * V2-P7 PR-Q：每張 trip card 右上角有 ... 按鈕，點開顯示「共編 / 刪除」 兩
 * 個選項。共編走 navigate('/trips?selected={id}&sheet=collab')；刪除呼叫
 * handler 由 host 處理 confirm + DELETE + 從 list 移除。
 *
 * 為何不直接 mount 在 card button 內：button-in-button 違反 a11y。改放在
 * card 同層 sibling，position: absolute overlay 上去。click 用 stopPropagation
 * 避免穿透到 card click（不會誤把 trip 開起來）。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../shared/Icon';

const SCOPED_STYLES = `
.tp-card-menu-trigger {
  position: absolute; top: 8px; right: 8px;
  width: 32px; height: 32px;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--color-border);
  color: var(--color-foreground);
  display: grid; place-items: center;
  cursor: pointer;
  z-index: 2;
  font: inherit;
  padding: 0;
  box-shadow: var(--shadow-sm);
  transition: background 120ms, border-color 120ms;
}
.tp-card-menu-trigger:hover {
  background: var(--color-background);
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.tp-card-menu-trigger:focus-visible {
  outline: 2px solid var(--color-accent); outline-offset: 2px;
}
.tp-card-menu-trigger .svg-icon { width: 18px; height: 18px; }

.tp-card-menu-dropdown {
  position: fixed;
  min-width: 160px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 4px;
  z-index: var(--z-modal, 60);
  display: flex; flex-direction: column;
  gap: 1px;
}
.tp-card-menu-item {
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
.tp-card-menu-item:hover { background: var(--color-hover); }
.tp-card-menu-item.is-destructive { color: var(--color-destructive); }
.tp-card-menu-item.is-destructive:hover { background: var(--color-destructive-bg); }
.tp-card-menu-item .svg-icon { width: 16px; height: 16px; flex-shrink: 0; }
`;

export interface TripCardMenuProps {
  tripId: string;
  /** 用戶選「共編」 — host 通常 navigate 到該 trip + sheet=collab。 */
  onCollab: (tripId: string) => void;
  /** 用戶選「刪除」 — host 應該 confirm + DELETE + 從 list 移除。 */
  onDelete: (tripId: string) => void;
  /** 預設關掉 menu 後 host 不需要做事。 */
  onClose?: () => void;
}

const MENU_WIDTH = 160;
const VIEWPORT_MARGIN = 8;

export default function TripCardMenu({ tripId, onCollab, onDelete, onClose }: TripCardMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  useLayoutEffect(() => {
    if (!open) return;
    function recompute() {
      const btn = triggerRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const vw = window.innerWidth;
      let left = r.right - MENU_WIDTH;
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

  function handleTrigger(e: React.MouseEvent) {
    // 阻止 click 穿透到 card button（不要意外開 trip）
    e.preventDefault();
    e.stopPropagation();
    setOpen((v) => !v);
  }

  function handleCollab(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onCollab(tripId);
    close();
  }

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onDelete(tripId);
    close();
  }

  const dropdown = open && pos ? createPortal((
    <div
      ref={menuRef}
      role="menu"
      className="tp-card-menu-dropdown"
      style={{ top: pos.top, left: pos.left }}
      data-testid={`trip-card-menu-${tripId}`}
    >
      <button
        type="button"
        role="menuitem"
        className="tp-card-menu-item"
        onClick={handleCollab}
        data-testid={`trip-card-menu-collab-${tripId}`}
      >
        <Icon name="group" />
        <span>共編設定</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="tp-card-menu-item is-destructive"
        onClick={handleDelete}
        data-testid={`trip-card-menu-delete-${tripId}`}
      >
        <Icon name="x-circle" />
        <span>刪除行程</span>
      </button>
    </div>
  ), document.body) : null;

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <button
        ref={triggerRef}
        type="button"
        className="tp-card-menu-trigger"
        onClick={handleTrigger}
        aria-label="行程選項"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={`trip-card-menu-trigger-${tripId}`}
      >
        <Icon name="more-vert" />
      </button>
      {dropdown}
    </>
  );
}
