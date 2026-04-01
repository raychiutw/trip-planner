/** Expand indicator character used in collapsible sections. */
export const ARROW_EXPAND = '＋';

/** Collapse indicator character used in collapsible sections. */
export const ARROW_COLLAPSE = '－';

/** Driving duration threshold (minutes) that triggers a warning. */
export const DRIVING_WARN_MINUTES = 120;

/** Human-readable label shown when the driving warning threshold is exceeded. */
export const DRIVING_WARN_LABEL = '超過 2 小時';

/** Canonical display order for transport types in the driving-stats panel. */
export const TRANSPORT_TYPE_ORDER: readonly string[] = ['car', 'train', 'walking'];

/** Metadata for each transport type used throughout the app. */
export interface TransportTypeInfo {
  /** Localised display label. */
  label: string;
  /** Icon identifier (matches `iconSpan` / Material Symbols key). */
  icon: string;
}

/** Registry of all supported transport types and their display metadata. */
export const TRANSPORT_TYPES: Readonly<Record<string, TransportTypeInfo>> = {
  car: { label: '開車', icon: 'car' },
  train: { label: '電車', icon: 'train' },
  walking: { label: '步行', icon: 'walking' },
};

/**
 * Regex that matches safe CSS colour values:
 * - Hex:  `#rgb`, `#rrggbb`, `#rrggbbaa`
 * - RGB:  `rgb(r, g, b)`
 * - CSS custom property:  `var(--token-name)`
 * - Named colours:  `red`, `blue`, …
 */
export const SAFE_COLOR_RE =
  /^(#[0-9a-fA-F]{3,8}|rgb\(\d+,\s*\d+,\s*\d+\)|var\(--[\w-]+\)|[a-z]+)$/i;

/** Returns the colour string if it passes SAFE_COLOR_RE, otherwise a default. */
export function safeColor(c: string | null | undefined): string {
  return c && SAFE_COLOR_RE.test(c) ? c : 'var(--blue-light)';
}

/** Selectors for focusable elements inside modal/sheet panels. */
export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/** Base URL for Google Maps search links. */
export const GOOGLE_MAPS_URL_BASE = 'https://www.google.com/maps/search/';

