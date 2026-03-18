import { useState, useCallback, useEffect } from 'react';
import { lsSet, lsGet } from '../lib/localStorage';

export type ColorMode = 'light' | 'auto' | 'dark';

/** Resolve whether dark class should be applied for a given color mode. */
function resolveDark(mode: ColorMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  // auto → follow system
  return (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/** Read saved color mode from localStorage (supports legacy `dark` key). */
function readColorMode(): ColorMode {
  const saved = lsGet<string>('color-mode');
  if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
  // Legacy key
  const oldDark = lsGet<string>('dark');
  if (oldDark === '1') return 'dark';
  if (oldDark === '0') return 'light';
  return 'auto';
}

/**
 * Hook to manage dark mode state.
 *
 * Supports three-way color mode (light / auto / dark).
 * Applies `body.dark` class and updates `<meta name="theme-color">`.
 */
export function useDarkMode() {
  const [colorMode, setColorModeState] = useState<ColorMode>(readColorMode);
  const [isDark, setIsDark] = useState(() => resolveDark(readColorMode()));

  /* --- Apply dark class whenever isDark changes --- */
  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', isDark ? '#7D4A36' : '#C4704F');
    }
  }, [isDark]);

  /** Set color mode (persists to localStorage). */
  const setColorMode = useCallback((mode: ColorMode) => {
    lsSet('color-mode', mode);
    setColorModeState(mode);
    setIsDark(resolveDark(mode));
  }, []);

  /** Toggle dark on/off (legacy — sets color-mode to dark/light). */
  const toggleDark = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      const mode = next ? 'dark' : 'light';
      lsSet('color-mode', mode);
      setColorModeState(mode);
      return next;
    });
  }, []);

  return { isDark, setIsDark, colorMode, setColorMode, toggleDark };
}
