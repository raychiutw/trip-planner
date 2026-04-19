import type { ColorMode } from '../hooks/useDarkMode';

/** Color mode options for the appearance settings UI. */
export const COLOR_MODE_OPTIONS: { key: ColorMode; label: string; desc: string }[] = [
  { key: 'light', label: '淺色', desc: 'Light' },
  { key: 'auto', label: '自動', desc: 'Auto' },
  { key: 'dark', label: '深色', desc: 'Dark' },
];
