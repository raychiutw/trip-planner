import { useEffect } from 'react';

/*
 * Module-level ref-count so simultaneously-locked sheets share ONE lock.
 *
 * The naive per-instance version corrupts scroll position when sheets nest: an
 * inner sheet reads `window.scrollY` off an already-`position:fixed` body (so it
 * saves 0), clobbers the outer sheet's `top: -Npx`, and on close restores/scrolls
 * to the wrong place while the outer sheet is still open. Counting locks fixes it —
 * the FIRST lock captures scrollY and fixes the body, the LAST restores.
 */
let lockCount = 0;
let savedScrollY = 0;

/**
 * Locks body scroll when `isOpen` is true (iOS Safari safe), ref-counted across
 * all callers. Uses `position: fixed` + negative `top` offset, which is the only
 * reliable technique on iOS Safari to prevent background scroll under a modal/sheet.
 *
 * Pure side-effect hook — returns nothing.
 */
export function useBodyScrollLock(isOpen: boolean): void {
  useEffect(() => {
    if (!isOpen) return;
    if (lockCount === 0) {
      savedScrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.width = '100%';
    }
    lockCount += 1;
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [isOpen]);
}
