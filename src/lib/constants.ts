/** Expand indicator character used in collapsible sections. */
export const ARROW_EXPAND = '＋';

/** Collapse indicator character used in collapsible sections. */
export const ARROW_COLLAPSE = '－';

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

/** Base URL for external navigation links (Google Maps app via web URL scheme). Not a Maps Platform API. */
export const EXTERNAL_NAVIGATION_URL_BASE = 'https://www.google.com/maps/search/';

/** Known destination timezone mapping (by tripId prefix). */
export const TRIP_TIMEZONE: Record<string, string> = {
  okinawa: 'Asia/Tokyo',
  kyoto: 'Asia/Tokyo',
  busan: 'Asia/Seoul',
  banqiao: 'Asia/Taipei',
};

/** Get today's date (YYYY-MM-DD) in the trip's destination timezone. */
export function getLocalToday(tripId: string | null): string {
  let tz: string | undefined;
  if (tripId) {
    const prefix = tripId.split('-')[0] ?? '';
    tz = TRIP_TIMEZONE[prefix];
  }
  if (tz) {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(new Date());
  }
  // Fallback: user's local date
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

