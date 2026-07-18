import { useRef, useEffect, useCallback } from 'react';
import { useBodyScrollLock } from './useBodyScrollLock';
import { FOCUSABLE_SELECTOR as FOCUSABLE } from '../lib/constants';

interface UseSheetBehaviorOptions {
  /**
   * Whether to restore focus to the previously focused element on close
   * (InfoSheet pattern). When false, `triggerRef` is focused instead (QuickPanel pattern).
   */
  restorePreviousFocus?: boolean;
  /** Ref to the trigger button — focused on close when restorePreviousFocus is false. */
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

  /* 3. Focus management on open/close */
  useEffect(() => {
    if (isOpen) {
      if (restorePreviousFocus) {
        previousFocusRef.current = document.activeElement;
      }
      requestAnimationFrame(() => {
        (initialFocusRef?.current ?? panelRef.current)?.focus();
      });
    } else {
      if (restorePreviousFocus) {
        if (previousFocusRef.current instanceof HTMLElement) {
          previousFocusRef.current.focus();
        }
        previousFocusRef.current = null;
      } else if (triggerRef?.current) {
        triggerRef.current.focus();
      }
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
