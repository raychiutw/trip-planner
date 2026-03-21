import { useState, useCallback, useEffect, useRef } from 'react';

interface PrintModeOptions {
  isDark: boolean;
  setIsDark: (value: boolean) => void;
}

/**
 * Hook to manage print mode.
 *
 * - Toggles `body.print-mode` + `body.theme-print` classes
 * - Manages `beforeprint` / `afterprint` events
 * - Temporarily disables dark mode and saves/restores the original theme
 */
export function usePrintMode({ isDark, setIsDark }: PrintModeOptions) {
  const [isPrintMode, setIsPrintMode] = useState(false);
  const wasDarkRef = useRef(false);
  const prevThemeRef = useRef<string | null>(null);

  /* Keep ref in sync so handlers always read the latest isDark without re-binding */
  const isDarkRef = useRef(isDark);
  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  /** Save current theme class and switch to theme-print */
  function enterPrintTheme() {
    const body = document.body;
    const currentTheme = Array.from(body.classList).find((c) => c.startsWith('theme-') && c !== 'theme-print');
    prevThemeRef.current = currentTheme || null;
    if (currentTheme) body.classList.remove(currentTheme);
    body.classList.add('theme-print');
  }

  /** Restore previous theme class */
  function exitPrintTheme() {
    const body = document.body;
    body.classList.remove('theme-print');
    if (prevThemeRef.current) body.classList.add(prevThemeRef.current);
  }

  /** Toggle print mode on/off. */
  const togglePrint = useCallback(() => {
    setIsPrintMode((prev) => {
      const entering = !prev;

      if (entering) {
        wasDarkRef.current = isDarkRef.current;
        if (isDarkRef.current) setIsDark(false);
        enterPrintTheme();
        document.body.classList.add('print-mode');
      } else {
        document.body.classList.remove('print-mode');
        exitPrintTheme();
        if (wasDarkRef.current) setIsDark(true);
      }

      return entering;
    });
  }, [setIsDark]);

  /** Listen for native browser print events. */
  useEffect(() => {
    function onBeforePrint() {
      wasDarkRef.current = isDarkRef.current;
      if (isDarkRef.current) setIsDark(false);
      enterPrintTheme();
      document.body.classList.add('print-mode');
      setIsPrintMode(true);
    }

    function onAfterPrint() {
      document.body.classList.remove('print-mode');
      exitPrintTheme();
      if (wasDarkRef.current) setIsDark(true);
      setIsPrintMode(false);
    }

    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [setIsDark]);

  return { isPrintMode, togglePrint };
}
