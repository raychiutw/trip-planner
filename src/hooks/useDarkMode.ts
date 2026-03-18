import { useState, useCallback, useEffect } from 'react';
import { lsSet, lsGet } from '../lib/localStorage';

/**
 * Hook to manage dark mode state.
 *
 * Mirrors the original `toggleDarkShared()` from shared.js:
 * - Toggles `body.dark` class
 * - Persists the preference in localStorage
 * - Updates the `<meta name="theme-color">` tag
 *
 * Initialises from localStorage (supports legacy `dark` key and newer
 * `color-mode` key with `'light'|'auto'|'dark'`), falling back to
 * system `prefers-color-scheme`.
 */
export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    // Determine initial state (same logic as shared.js IIFE)
    const colorMode = lsGet<string>('color-mode');
    if (colorMode === 'dark') return true;
    if (colorMode === 'light') return false;
    if (colorMode === 'auto') {
      return (
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
      );
    }
    // Legacy key
    const oldDark = lsGet<string>('dark');
    if (oldDark !== null) return oldDark === '1';
    // Default: follow system
    return (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  });

  /* --- Apply dark class on mount and whenever isDark changes --- */
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

  /** Toggle dark mode on/off. */
  const toggleDark = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      lsSet('dark', next ? '1' : '0');
      return next;
    });
  }, []);

  return { isDark, setIsDark, toggleDark };
}
