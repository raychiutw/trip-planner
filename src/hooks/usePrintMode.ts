import { useState, useCallback, useEffect, useRef } from 'react';

interface PrintModeOptions {
  setPrintAppearance: (active: boolean) => void;
}

/** Temporary print presentation; the theme module retains the user's preference. */
export function usePrintMode({ setPrintAppearance }: PrintModeOptions) {
  const [isPrintMode, setIsPrintMode] = useState(false);
  const printing = useRef(false);
  const prevTheme = useRef<string | null>(null);

  const setPrinting = useCallback((active: boolean) => {
    if (printing.current === active) return;
    printing.current = active;
    const body = document.body;
    if (active) {
      prevTheme.current = Array.from(body.classList).find(c => c.startsWith('theme-') && c !== 'theme-print') ?? null;
      if (prevTheme.current) body.classList.remove(prevTheme.current);
    } else if (prevTheme.current) {
      body.classList.add(prevTheme.current);
      prevTheme.current = null;
    }
    body.classList.toggle('theme-print', active);
    body.classList.toggle('print-mode', active);
    setPrintAppearance(active);
    setIsPrintMode(active);
  }, [setPrintAppearance]);

  const togglePrint = useCallback(() => setPrinting(!printing.current), [setPrinting]);
  useEffect(() => {
    const before = () => setPrinting(true);
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
      setPrinting(false);
    };
  }, [setPrinting]);

  return { isPrintMode, togglePrint };
}
