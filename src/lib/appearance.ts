import type { ColorMode, ColorTheme } from '../hooks/useDarkMode';

/** Color mode options for the appearance settings UI. */
export const COLOR_MODE_OPTIONS: { key: ColorMode; label: string; desc: string }[] = [
  { key: 'light', label: '淺色', desc: 'Light' },
  { key: 'auto', label: '自動', desc: 'Auto' },
  { key: 'dark', label: '深色', desc: 'Dark' },
];

/** Theme accent colors — MUST match @theme / body.theme-* values in shared.css */
export const THEME_ACCENTS: Record<string, { light: string; dark: string }> = {
  sun:    { light: '#E86A4A', dark: '#F4A08A' },
  sky:    { light: '#2870A0', dark: '#7EC0E8' },
  zen:    { light: '#9A6B50', dark: '#D4A88E' },
  forest: { light: '#4A8C5C', dark: '#7EC89A' },
  sakura: { light: '#D4708A', dark: '#F0A0B8' },
  night:  { light: '#6B6B6B', dark: '#A0A0A0' },
};

/** Available color themes for the appearance settings UI. */
export const COLOR_THEMES: { key: ColorTheme; label: string; desc: string }[] = [
  { key: 'sun',    label: '陽光', desc: 'Sunshine' },
  { key: 'sky',    label: '晴空', desc: 'Clear Sky' },
  { key: 'zen',    label: '和風', desc: 'Japanese Zen' },
  { key: 'forest', label: '森林', desc: 'Deep Forest' },
  { key: 'sakura', label: '櫻花', desc: 'Cherry Blossom' },
  { key: 'night',  label: '夜城', desc: 'Night City' },
];
