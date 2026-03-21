import { useEffect, useRef } from 'react';

/**
 * Locks body scroll when `isOpen` is true (iOS Safari safe).
 *
 * Saves the current `window.scrollY` before locking so it can be restored
 * when the lock is released. Uses `position: fixed` + negative `top` offset,
 * which is the only reliable technique on iOS Safari to prevent background
 * content from scrolling under a modal/sheet.
 *
 * Pure side-effect hook — returns nothing.
 */
export function useBodyScrollLock(isOpen: boolean): void {
  const savedScrollY = useRef(0);

  useEffect(() => {
    if (isOpen) {
      savedScrollY.current = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY.current}px`;
      document.body.style.width = '100%';
    } else {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, savedScrollY.current);
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [isOpen]);
}
