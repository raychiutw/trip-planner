import { useState, useCallback, useEffect, useRef } from 'react';

interface PrintModeOptions {
  isDark: boolean;
  setIsDark: (value: boolean) => void;
}

/**
 * Hook to manage print mode.
 *
 * - Toggles `body.print-mode` class
 * - Manages `beforeprint` / `afterprint` events
 * - Temporarily disables dark mode when entering print mode by coordinating
 *   through React state (via `setIsDark`) instead of direct DOM manipulation
 */
export function usePrintMode({ isDark, setIsDark }: PrintModeOptions) {
  const [isPrintMode, setIsPrintMode] = useState(false);
  const wasDarkRef = useRef(false);

  /** Toggle print mode on/off. */
  const togglePrint = useCallback(() => {
    setIsPrintMode((prev) => {
      const entering = !prev;

      if (entering) {
        wasDarkRef.current = isDark;
        if (isDark) setIsDark(false);
        document.body.classList.add('print-mode');
      } else {
        document.body.classList.remove('print-mode');
        if (wasDarkRef.current) setIsDark(true);
      }

      return entering;
    });
  }, [isDark, setIsDark]);

  /** Listen for native browser print events. */
  useEffect(() => {
    function onBeforePrint() {
      wasDarkRef.current = isDark;
      if (isDark) setIsDark(false);
      document.body.classList.add('print-mode');
      setIsPrintMode(true);
    }

    function onAfterPrint() {
      document.body.classList.remove('print-mode');
      if (wasDarkRef.current) setIsDark(true);
      setIsPrintMode(false);
    }

    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [isDark, setIsDark]);

  return { isPrintMode, togglePrint };
}
