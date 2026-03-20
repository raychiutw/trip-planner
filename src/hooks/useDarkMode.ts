import { useState, useCallback, useEffect } from 'react';
import { lsSet, lsGet } from '../lib/localStorage';

export type ColorMode = 'light' | 'auto' | 'dark';
export type ColorTheme = 'sun' | 'sky' | 'zen' | 'forest' | 'sakura' | 'ocean';

const THEME_CLASSES = ['theme-sun', 'theme-sky', 'theme-zen', 'theme-forest', 'theme-sakura', 'theme-ocean'] as const;

/** Theme-color values per theme × mode (light / dark). */
const THEME_COLORS: Record<ColorTheme, { light: string; dark: string }> = {
  sun:    { light: '#F47B5E', dark: '#3D2A20' },
  sky:    { light: '#2870A0', dark: '#1E3040' },
  zen:    { light: '#9A6B50', dark: '#342820' },
  forest: { light: '#4A8C5C', dark: '#243D2A' },
  sakura: { light: '#D4708A', dark: '#3D2028' },
  ocean:  { light: '#1A6B8A', dark: '#1E3442' },
};

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

/** Read saved color theme from localStorage. */
function readColorTheme(): ColorTheme {
  const saved = lsGet<string>('colorTheme');
  if (saved === 'sun' || saved === 'sky' || saved === 'zen' || saved === 'forest' || saved === 'sakura' || saved === 'ocean') return saved;
  return 'sun';
}

/** Apply theme class to body (removes other theme classes first). */
function applyThemeClass(theme: ColorTheme) {
  THEME_CLASSES.forEach((cls) => document.body.classList.remove(cls));
  document.body.classList.add(`theme-${theme}`);
}

/** Update <meta name="theme-color"> content. */
function updateMetaThemeColor(theme: ColorTheme, dark: boolean) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', THEME_COLORS[theme][dark ? 'dark' : 'light']);
  }
}

/**
 * Hook to manage dark mode and color theme state.
 *
 * Supports three-way color mode (light / auto / dark)
 * and three color themes (sun / sky / zen).
 * Applies `body.theme-*` and `body.dark` classes and updates `<meta name="theme-color">`.
 */
export function useDarkMode() {
  const [colorMode, setColorModeState] = useState<ColorMode>(readColorMode);
  const [isDark, setIsDark] = useState(() => resolveDark(readColorMode()));
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(readColorTheme);

  /* --- Apply theme class whenever colorTheme changes --- */
  useEffect(() => {
    applyThemeClass(colorTheme);
    updateMetaThemeColor(colorTheme, isDark);
  }, [colorTheme, isDark]);

  /* --- Apply dark class whenever isDark changes --- */
  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [isDark]);

  /** Set color mode (persists to localStorage). */
  const setColorMode = useCallback((mode: ColorMode) => {
    lsSet('color-mode', mode);
    setColorModeState(mode);
    setIsDark(resolveDark(mode));
  }, []);

  /** Set color theme (persists to localStorage). */
  const setTheme = useCallback((theme: ColorTheme) => {
    lsSet('colorTheme', theme);
    setColorThemeState(theme);
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

  return { isDark, setIsDark, colorMode, setColorMode, toggleDark, colorTheme, setTheme };
}
