import { useState, useCallback, useEffect } from 'react';

/**
 * Hook to manage print mode.
 *
 * - Toggles `body.print-mode` class
 * - Manages `beforeprint` / `afterprint` events
 * - Temporarily disables dark mode when entering print mode
 */
export function usePrintMode() {
  const [isPrintMode, setIsPrintMode] = useState(false);

  /** Toggle print mode on/off. */
  const togglePrint = useCallback(() => {
    setIsPrintMode((prev) => {
      const entering = !prev;

      if (entering) {
        // If dark mode is active, temporarily disable it
        if (document.body.classList.contains('dark')) {
          document.body.dataset.wasDark = '1';
          document.body.classList.remove('dark');
        }
        document.body.classList.add('print-mode');
      } else {
        document.body.classList.remove('print-mode');
        // Restore dark mode if it was active before
        if (document.body.dataset.wasDark === '1') {
          document.body.classList.add('dark');
          delete document.body.dataset.wasDark;
        }
      }

      return entering;
    });
  }, []);

  /** Listen for native browser print events. */
  useEffect(() => {
    function onBeforePrint() {
      if (document.body.classList.contains('dark')) {
        document.body.dataset.wasDark = '1';
        document.body.classList.remove('dark');
      }
      document.body.classList.add('print-mode');
      setIsPrintMode(true);
    }

    function onAfterPrint() {
      document.body.classList.remove('print-mode');
      if (document.body.dataset.wasDark === '1') {
        document.body.classList.add('dark');
        delete document.body.dataset.wasDark;
      }
      setIsPrintMode(false);
    }

    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, []);

  return { isPrintMode, togglePrint };
}
