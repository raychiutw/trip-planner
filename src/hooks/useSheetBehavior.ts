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
}

interface UseSheetBehaviorResult {
  /** Attach to the panel/sheet element. */
  panelRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to the backdrop element. */
  backdropRef: React.RefObject<HTMLDivElement | null>;
  /** onKeyDown handler for the panel — implements focus trap. */
  handlePanelKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * Shared sheet/overlay behaviors extracted from InfoSheet and QuickPanel:
 *
 * 1. `.container` class toggle (`sheet-open`) when open
 * 2. Body scroll lock (iOS Safari safe, via useBodyScrollLock)
 * 3. Focus management on open/close
 * 4. Escape key handler
 * 5. Focus trap on Tab key
 * 6. Backdrop scroll prevention (wheel + touchmove, passive: false)
 */
export function useSheetBehavior(
  isOpen: boolean,
  onClose: () => void,
  options: UseSheetBehaviorOptions = {},
): UseSheetBehaviorResult {
  const { restorePreviousFocus = false, triggerRef, onEscape, preventAllBackdropScroll = false } = options;

  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  /* 1. Container class toggle */
  useEffect(() => {
    document.querySelector('.container')?.classList.toggle('sheet-open', isOpen);
    return () => {
      document.querySelector('.container')?.classList.remove('sheet-open');
    };
  }, [isOpen]);

  /* 2. Body scroll lock */
  useBodyScrollLock(isOpen);

  /* 3. Focus management on open/close */
  useEffect(() => {
    if (isOpen) {
      if (restorePreviousFocus) {
        previousFocusRef.current = document.activeElement;
      }
      requestAnimationFrame(() => {
        panelRef.current?.focus();
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
  }, [isOpen, restorePreviousFocus, triggerRef]);

  /* 4. Escape key handler */
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape?.();
        onClose();
        if (!restorePreviousFocus && triggerRef?.current) {
          triggerRef.current.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onEscape, restorePreviousFocus, triggerRef]);

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
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
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
