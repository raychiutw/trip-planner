import { useSyncExternalStore } from 'react';
import { lsSet, lsGet } from '../lib/localStorage';

export type ColorMode = 'light' | 'auto' | 'dark';

/** Theme color values (light / dark) — for <meta name="theme-color">. Mirrors V2 Terracotta `--color-accent`. */
const THEME_COLORS = { light: '#A97A4A', dark: '#1C1C1E' } as const;

/** Resolve whether dark class should be applied for a given color mode. */
function resolveDark(mode: ColorMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
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
    meta.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light);
  }
}

interface ThemeState { colorMode: ColorMode; isDark: boolean; saveFailed: boolean }
let state: ThemeState | undefined;
let printing = false;
const listeners = new Set<() => void>();

function getSnapshot(): ThemeState {
  if (!state) {
    const colorMode = readColorMode();
    state = { colorMode, isDark: resolveDark(colorMode), saveFailed: false };
  }
  return state;
}

function publish(colorMode = getSnapshot().colorMode, saveFailed = getSnapshot().saveFailed) {
  const isDark = !printing && resolveDark(colorMode);
  const previous = getSnapshot();
  document.body.classList.toggle('dark', isDark);
  updateMetaThemeColor(isDark);
  if (previous.colorMode === colorMode && previous.isDark === isDark && previous.saveFailed === saveFailed) return;
  state = { colorMode, isDark, saveFailed };
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // One set of environment listeners regardless of the number of hook consumers.
  if (listeners.size === 1) startListening();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopListening?.();
      stopListening = undefined;
      state = undefined;
      printing = false;
    }
  };
}
let stopListening: (() => void) | undefined;
function startListening() {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  const onSystemChange = () => publish();
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === 'tp-color-mode' || event.key === 'tp-dark') publish(readColorMode(), false);
  };
  media?.addEventListener('change', onSystemChange);
  window.addEventListener('storage', onStorage);
  publish();
  stopListening = () => {
    media?.removeEventListener('change', onSystemChange);
    window.removeEventListener('storage', onStorage);
  };
}

function setColorMode(mode: ColorMode) {
  publish(mode, !lsSet('color-mode', mode));
}

/** Print presentation never changes the saved preference; exit resolves the current environment. */
function setPrintAppearance(active: boolean) {
  printing = active;
  publish();
}

function toggleDark() { setColorMode(getSnapshot().isDark ? 'light' : 'dark'); }

/** Shared preference and resolved appearance for every mounted consumer. */
export function useDarkMode() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  return { ...snapshot, setColorMode, setPrintAppearance, toggleDark };
}
