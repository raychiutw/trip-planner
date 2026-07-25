import { useRef, useEffect, useCallback } from 'react';
import { useBodyScrollLock } from './useBodyScrollLock';
import { FOCUSABLE_SELECTOR as FOCUSABLE } from '../lib/constants';

interface UseSheetBehaviorOptions {
  /**
   * 明確要求「還原到開啟前聚焦的元素」（InfoSheet pattern）。
   *
   * ⚠ #1160 起這個 flag **不再是還原行為的開關**，只是「明確指定用這條路」。
   * 沒傳 flag 也沒傳 `triggerRef` 時，引擎預設就會還原到開啟當下的
   * `document.activeElement` —— 見下方 focus management 的說明。
   */
  restorePreviousFocus?: boolean;
  /**
   * 觸發按鈕的 ref —— 關閉時聚焦它（QuickPanel pattern），優先於預設的
   * 「還原 activeElement」。有些觸發元件關閉後會重繪，指名 ref 比記快照可靠。
   */
  triggerRef?: React.RefObject<HTMLElement | null>;
  /** Extra callback to run when Escape is pressed (before setIsOpen(false)). */
  onEscape?: () => void;
  /**
   * When true, prevents ALL scroll on the backdrop (wheel + touchmove), not just
   * self-targeted events. QuickPanel needs this; InfoSheet only blocks self-targeted.
   * Default: false (InfoSheet behavior).
   */
  preventAllBackdropScroll?: boolean;
  /**
   * Focus this element on open instead of the panel container — e.g. a confirm
   * button (ConfirmSheet a11y: keyboard user hits Enter immediately). Default: panel.
   */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * When false, Escape must NOT dismiss — e.g. a form mid-submit ("busy" lock, so a
   * stray Escape can't look like a cancel while the request is in flight). Default true.
   */
  canDismiss?: boolean;
  /**
   * When true (default), lock body scroll while open — modal bottom sheet / centered
   * dialog. Set false for a NON-modal surface (desktop right-column operation panel)
   * so the covered content stays scrollable and interactive.
   */
  modal?: boolean;
}

interface UseSheetBehaviorResult {
  /** Attach to the panel/sheet element. */
  panelRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to the backdrop element. */
  backdropRef: React.RefObject<HTMLDivElement | null>;
  /** onKeyDown handler for the panel — implements focus trap. */
  handlePanelKeyDown: (e: React.KeyboardEvent) => void;
}

/*
 * Module-level open-sheet registry — one shared stack across all instances so that
 * only the TOP-most sheet responds to Escape (F12): a nested confirm closes itself,
 * not the whole stack, on one Escape press. (Body scroll-lock is ref-counted inside
 * useBodyScrollLock; nested-modal z-index is handled by portal DOM order.)
 */
const openSheets: symbol[] = [];
function registerSheet(id: symbol) {
  if (!openSheets.includes(id)) openSheets.push(id);
}
function unregisterSheet(id: symbol) {
  const i = openSheets.indexOf(id);
  if (i !== -1) openSheets.splice(i, 1);
}
function isTopSheet(id: symbol): boolean {
  return openSheets.length > 0 && openSheets[openSheets.length - 1] === id;
}

/**
 * 是否有任何 engine sheet/modal 開啟中（ConfirmModal / InfoSheet / AiConsent 等只在開啟時
 * 註冊）。給 OperationShell 桌機 Escape 判斷「內層有 modal 開著就別關整個 panel」——比掃 DOM
 * 找 role=dialog 可靠：InfoSheet 等元件即使關閉也常駐 DOM，registry 只記真正開啟的。
 */
export function isAnySheetOpen(): boolean {
  return openSheets.length > 0;
}

/**
 * Shared sheet/overlay behavior engine — the single source for bottom sheets, centered
 * modals, content sheets, and (non-modal) operation panels:
 *
 * 1. Top-most-sheet registry (for nested Escape)
 * 2. Body scroll lock (iOS Safari safe, ref-counted) — only when `modal`
 * 3. Focus management on open/close (optionally to `initialFocusRef`)
 * 4. Escape (top-most only, IME-safe, honors `canDismiss`)
 * 5. Focus trap on Tab key
 * 6. Backdrop scroll prevention (wheel + touchmove, passive: false)
 */
export function useSheetBehavior(
  isOpen: boolean,
  onClose: () => void,
  options: UseSheetBehaviorOptions = {},
): UseSheetBehaviorResult {
  const {
    restorePreviousFocus = false,
    triggerRef,
    onEscape,
    preventAllBackdropScroll = false,
    initialFocusRef,
    canDismiss = true,
    modal = true,
  } = options;

  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const idRef = useRef<symbol>(Symbol('sheet'));

  /* 1. Open-sheet registry (top-most tracking for nested Escape) */
  useEffect(() => {
    const id = idRef.current;
    if (isOpen) registerSheet(id);
    else unregisterSheet(id);
    return () => unregisterSheet(id);
  }, [isOpen]);

  /* 2. Body scroll lock — modal surfaces only (non-modal desktop panel stays unlocked) */
  useBodyScrollLock(isOpen && modal);

  /* 3. Focus management on open/close
   *
   * #1160：焦點還原改成**預設行為**，不再要求呼叫方明確開啟。
   *
   * 原本 `previousFocusRef` 只在 `restorePreviousFocus === true` 時才記，關閉時的
   * 三種情況只處理兩種 —— 兩者都沒傳就**什麼都不做**，鍵盤使用者被丟回文件頂端、
   * 要重新 Tab 一遍才能回到原位。而三個共用對話框（ConfirmModal / InputModal /
   * ConflictModal，共 26 處 JSX 使用）都只傳 `initialFocusRef`，全部落在那一格。
   *
   * 改引擎預設值一次修好全部呼叫點，比逐一改 26 個呼叫點的變更面小得多。
   * **既有兩條明確路徑的行為完全不變** —— 新邏輯只補「兩者都沒傳」的 fallback：
   *   restorePreviousFocus  → 還原 activeElement 快照（不變）
   *   triggerRef            → 聚焦指定的觸發元素（不變，優先於快照）
   *   兩者都沒傳            → **改為**還原 activeElement 快照（原本什麼都不做）
   *
   * 快照改為無條件記錄：成本是一次 `document.activeElement` 讀取，而只在需要時才用。
   */
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      requestAnimationFrame(() => {
        (initialFocusRef?.current ?? panelRef.current)?.focus();
      });
    } else {
      // triggerRef 明確指名時優先（它比快照可靠：有些觸發元件關閉後會重繪）。
      if (!restorePreviousFocus && triggerRef?.current) {
        triggerRef.current.focus();
      } else if (previousFocusRef.current instanceof HTMLElement) {
        // `instanceof HTMLElement` 同時擋掉三種情況：null（沒開過）、非 HTML 元素、
        // 以及**已從 DOM 移除的元素**（刪除流程關閉對話框時，觸發它的那一列常一起消失
        // —— 對 detached 元素呼叫 focus() 不會 throw，但會把焦點掉到 body，
        // 與什麼都不做同樣糟；isConnected 檢查讓它安靜跳過，由瀏覽器保留當前焦點）。
        if (previousFocusRef.current.isConnected) {
          previousFocusRef.current.focus();
        }
      }
      previousFocusRef.current = null;
    }
  }, [isOpen, restorePreviousFocus, triggerRef, initialFocusRef]);

  /* 4. Escape — top-most sheet only, skip IME composition, honor canDismiss (busy lock) */
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (e.isComposing) return; // IME 組字中的 Escape 交給輸入法取消 composition，不關 sheet
      if (!isTopSheet(idRef.current)) return; // 巢狀時只有最上層回應
      if (!canDismiss) return; // busy（送出中）鎖住
      e.preventDefault();
      onEscape?.();
      onClose();
      if (!restorePreviousFocus && triggerRef?.current) {
        triggerRef.current.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onEscape, restorePreviousFocus, triggerRef, canDismiss]);

  /* 5. Focus trap on Tab key */
  const handlePanelKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (first && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
    } else {
      if (last && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }, []);

  /* 6. Backdrop scroll prevention (native listeners, passive: false) */
  useEffect(() => {
    if (!isOpen) return;
    const backdrop = backdropRef.current;
    if (!backdrop) return;
    const prevent = (e: Event) => {
      if (preventAllBackdropScroll || e.target === backdrop) e.preventDefault();
    };
    backdrop.addEventListener('wheel', prevent, { passive: false });
    backdrop.addEventListener('touchmove', prevent, { passive: false });
    return () => {
      backdrop.removeEventListener('wheel', prevent);
      backdrop.removeEventListener('touchmove', prevent);
    };
  }, [isOpen, preventAllBackdropScroll]);

  return { panelRef, backdropRef, handlePanelKeyDown };
}
