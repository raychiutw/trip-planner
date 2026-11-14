/** ⋯ context menu（#1262 自 TimelineRail 拆出）。樣式在 TimelineRail.styles.ts 的 RAIL_MENU_STYLES。 */
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import Icon from '../shared/Icon';

export type RailMenuItem =
  | { kind: 'sep' }
  | {
      kind: 'item';
      label: string;
      icon: React.ComponentProps<typeof Icon>['name'];
      danger?: boolean;
      onSelect: () => void;
      testid?: string;
    };

/** 輸入框、選單內保留原生行為（複製貼上、文字刪除、Shift+F10 等）；checkbox / radio 不算輸入框。 */
export function isEditableTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement
    && !!t.closest('input:not([type="checkbox"]):not([type="radio"]),textarea,select,[contenteditable="true"],[role="menu"]');
}

/**
 * 右鍵 / Shift+F10 / 選單鍵 / Delete 的共用綁定（#1694、#1695）：所有卡片的選單（RailRowMenu、TripCardMenu）
 * 都走這一支，不各寫一套。`openAt` 收游標座標（鍵盤則為元素左側垂直置中）；`onDeleteKey` 沒傳＝沒有 Delete 行為。
 */
export function useContextMenuTrigger(
  targetRef: React.RefObject<HTMLElement | null> | undefined,
  openAt: (x: number, y: number) => void,
  onDeleteKey?: () => void,
) {
  const openRef = useRef(openAt);
  const deleteRef = useRef(onDeleteKey);
  openRef.current = openAt;
  deleteRef.current = onDeleteKey;
  useEffect(() => {
    const el = targetRef?.current;
    if (!el) return;
    const onCtx = (e: MouseEvent) => {
      // 列內的連結保留瀏覽器原生選單；列本身就是連結（側欄行程列）則照開。
      const link = (e.target as HTMLElement).closest('a[href]');
      if (isEditableTarget(e.target) || (link && link !== el)) return;
      e.preventDefault();
      openRef.current(e.clientX, e.clientY);
    };
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        openRef.current(r.left + 16, r.top + r.height / 2);
      } else if (e.key === 'Delete' && deleteRef.current) {
        e.preventDefault();
        deleteRef.current();
      }
    };
    el.addEventListener('contextmenu', onCtx);
    el.addEventListener('keydown', onKey);
    return () => { el.removeEventListener('contextmenu', onCtx); el.removeEventListener('keydown', onKey); };
  }, [targetRef]);
}

/**
 * ⋯ context menu — rev2 mockup Section 02：把停留卡的動作從「展開明細一排 icon 鈕」
 * 收進單顆 ⋯（Apple 列表語彙，不在列上排 6 顆 icon）。
 * 刻意用原生 Popover API（本 repo 首處；EntryTimeChip 的 popup 是 createPortal + 手寫 open state，
 * 兩者不同機制）：native 免費拿 top-layer（自動逃離 .tp-rail-content 的 overflow:hidden、免 portal /
 * z-index 戰爭）+ light-dismiss（點外面 / Esc 關閉 + 焦點歸還 trigger，免自寫 handler）。top-layer
 * 預設不跟 anchor 走，故開啟時（toggle→open）依 trigger rect 定位。
 */
export function RailRowMenu({ menuId, label, items, testid, contextTargetRef, onDeleteKey, hideTrigger }: {
  menuId: string;
  label: string;
  items: RailMenuItem[];
  testid?: string;
  /** 給了就讓該元素支援右鍵 / Shift+F10 / 選單鍵從座標開同一個選單（#1694，行程卡、收藏卡等沿用）。 */
  contextTargetRef?: React.RefObject<HTMLElement | null>;
  /** 給了就讓 contextTargetRef 內（非輸入框）按 Delete 呼叫它；沒權限時不要傳（右鍵與 Delete 同一份權限）。 */
  onDeleteKey?: () => void;
  /** 沒有常駐 ⋯（收藏卡）：只靠右鍵 / Shift+F10 開選單。 */
  hideTrigger?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // native popover invoker 不自動反映可被 CSS / AT 讀取的 aria-expanded 屬性 → 手動追蹤開合
  // （讓 SR 念「已展開的選單按鈕」+ 讓 .tp-rail-menu-trigger[aria-expanded="true"] 開啟時保持可見）。
  const [open, setOpen] = useState(false);
  // 右鍵 / 鍵盤開啟時的錨點座標；有值就貼座標，沒有就貼 trigger。
  const pointRef = useRef<{ x: number; y: number } | null>(null);
  const positionMenu = () => {
    const t = triggerRef.current;
    const m = menuRef.current;
    if (!t || !m) return;
    const mh = m.offsetHeight || 300;
    const mw = m.offsetWidth || 216;
    const pt = pointRef.current;
    if (pt) {
      m.style.top = `${Math.max(8, Math.min(pt.y, window.innerHeight - mh - 8))}px`;
      m.style.left = `${Math.max(8, Math.min(pt.x, window.innerWidth - mw - 8))}px`;
      return;
    }
    const r = t.getBoundingClientRect();
    // 下方空間夠 → 貼 trigger 下緣；否則往上翻。右對齊 trigger、夾在 viewport 內。
    const top = window.innerHeight - r.bottom > mh + 12 ? r.bottom + 6 : Math.max(8, r.top - mh - 6);
    const left = Math.max(8, Math.min(r.right - mw, window.innerWidth - mw - 8));
    m.style.top = `${top}px`;
    m.style.left = `${left}px`;
  };
  useContextMenuTrigger(contextTargetRef, (x, y) => {
    pointRef.current = { x, y };
    try { menuRef.current?.showPopover(); } catch { pointRef.current = null; /* 已開 / 不支援 */ }
    positionMenu(); // 同步定位，避免 toggle 事件前閃在 (0,0)
  }, onDeleteKey);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        style={hideTrigger ? { display: 'none' } : undefined}
        className="tp-rail-menu-trigger"
        popoverTarget={menuId}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`更多動作：${label}`}
        onClick={(e) => e.stopPropagation()}
        data-testid={testid}
      >
        <Icon name="ellipsis" />
      </button>
      <div
        ref={menuRef}
        id={menuId}
        popover="auto"
        role="menu"
        className="tp-rail-menu"
        aria-label={`${label} 的動作`}
        onToggle={(e) => {
          const isOpen = e.newState === 'open';
          setOpen(isOpen);
          if (!isOpen) { pointRef.current = null; return; }
          positionMenu();
          // 開啟時焦點移進 menu 首項（鍵盤導航）；native popover 已管 Esc / 點外面關閉 + 焦點歸還 trigger。
          menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
        }}
        onKeyDown={(e) => {
          const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
          if (!items || items.length === 0) return;
          const arr = Array.from(items);
          const cur = arr.indexOf(document.activeElement as HTMLButtonElement);
          if (e.key === 'ArrowDown') { e.preventDefault(); arr[cur < 0 ? 0 : (cur + 1) % arr.length]?.focus(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); arr[cur < 0 ? arr.length - 1 : (cur - 1 + arr.length) % arr.length]?.focus(); }
          else if (e.key === 'Home') { e.preventDefault(); arr[0]?.focus(); }
          else if (e.key === 'End') { e.preventDefault(); arr[arr.length - 1]?.focus(); }
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((it, i) =>
          it.kind === 'sep' ? (
            <div key={`sep-${i}`} className="tp-rail-menu-sep" role="separator" />
          ) : (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className={clsx('tp-rail-menu-item', it.danger && 'is-danger')}
              onClick={() => {
                // 關 popover 再執行動作。try/catch 容忍 jsdom（無原生 Popover API）與「已關閉」狀態。
                try { menuRef.current?.hidePopover(); } catch { /* popover 未開 / 環境不支援 */ }
                it.onSelect();
              }}
              data-testid={it.testid}
            >
              <Icon name={it.icon} />
              <span>{it.label}</span>
            </button>
          ),
        )}
      </div>
    </>
  );
}

// v2.33.28: dedupe — 改 import POI_TYPE_LABELS canonical (poiCategory.ts)。
// hotel canonical = '飯店'（之前本地 '住宿' 屬 drift bug 家族 v2.31.23 root cause）。

// v2.33.45 round 6b: wrap memo — 之前 alternate POI 列表每筆 row 都會在
// RailRow re-render 時跟著 re-render，trips 含 hotel + ~10 alternates 時
// 浪費 render。poi prop 來自 entry.stopPois.filter(sort_order>1)，引用穩定。
