import { useState, useCallback, useEffect } from 'react';
import { lsSet, lsGet } from '../lib/localStorage';

export type ColorMode = 'light' | 'auto' | 'dark';

/** Ocean theme color values (light / dark) — for <meta name="theme-color">. */
const OCEAN_COLORS = { light: '#0077B6', dark: '#0D1B2A' } as const;

/** Resolve whether dark class should be applied for a given color mode. */
function resolveDark(mode: ColorMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
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
  const oldDark = lsGet<string>('dark');
  if (oldDark === '1') return 'dark';
  if (oldDark === '0') return 'light';
  return 'auto';
}

/** Update <meta name="theme-color"> content. */
function updateMetaThemeColor(dark: boolean) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', dark ? OCEAN_COLORS.dark : OCEAN_COLORS.light);
  }
}

/**
 * Hook to manage light/dark mode state.
 *
 * Supports three-way color mode (light / auto / dark).
 * Applies `body.dark` class and updates `<meta name="theme-color">`.
 */
export function useDarkMode() {
  const [colorMode, setColorModeState] = useState<ColorMode>(readColorMode);
  const [isDark, setIsDark] = useState(() => resolveDark(readColorMode()));

  useEffect(() => {
    updateMetaThemeColor(isDark);
  }, [isDark]);

  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    if (colorMode !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [colorMode]);

  const setColorMode = useCallback((mode: ColorMode) => {
    lsSet('color-mode', mode);
    setColorModeState(mode);
    setIsDark(resolveDark(mode));
  }, []);

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
