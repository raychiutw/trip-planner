/**
 * trip-url.ts — per-trip sheet URL driver.
 *
 * Sheet state lives in `?sheet=itinerary|ideas|map|chat` so the tab is deep-linkable,
 * browser back/forward works, and sharing a URL lands on the right pane.
 *
 * Invalid `?sheet=` values degrade to `null` (fallback = closed) so URL injection
 * or stale links can't throw.
 */

import type { NavigateFunction } from 'react-router-dom';

export const SHEET_TABS = ['itinerary', 'ideas', 'map', 'chat'] as const;
export type SheetTab = typeof SHEET_TABS[number];

const SHEET_TAB_SET = new Set<string>(SHEET_TABS);

/** Read `?sheet=` from a search string, URLSearchParams, or full URL. */
export function parseSheetParam(
  input: string | URLSearchParams,
): SheetTab | null {
  const params = typeof input === 'string' ? new URLSearchParams(input.startsWith('?') ? input.slice(1) : input) : input;
  const raw = params.get('sheet');
  if (!raw) return null;
  return SHEET_TAB_SET.has(raw) ? (raw as SheetTab) : null;
}

/** Push tab to URL via `replace` so tab-switching doesn't bloat history. */
export function setSheetParam(
  navigate: NavigateFunction,
  pathname: string,
  search: string,
  tab: SheetTab,
): void {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.set('sheet', tab);
  const query = params.toString();
  navigate(query ? `${pathname}?${query}` : pathname, { replace: true });
}

/** Remove `?sheet=` via `replace`. Preserves other params. */
export function closeSheet(
  navigate: NavigateFunction,
  pathname: string,
  search: string,
): void {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.delete('sheet');
  const query = params.toString();
  navigate(query ? `${pathname}?${query}` : pathname, { replace: true });
}
