import { useEffect, useRef, useState } from 'react';
import type { PoiSearchResult } from '../types/poi';

interface UsePoiSearchOptions {
  /** Disable the hook entirely (e.g. when not on search tab). Default: true (enabled). */
  enabled?: boolean;
  /** Search query — empty / <2 chars triggers no fetch and clears results. */
  query: string;
  /** Result count cap. Default: 20. */
  limit?: number;
  /** Debounce window in ms. Default: 300. */
  debounceMs?: number;
  /**
   * Optional caller-side response normaliser. API may return either a bare
   * array or `{ results: [...] }` wrapper, with snake_case vs camelCase row
   * shapes. Default: cast as `PoiSearchResult[]` (assumes API returns canonical shape).
   */
  normalise?: (raw: unknown) => PoiSearchResult[];
  /** Optional error callback. Default: silent. Called for non-OK HTTP + network errors (not AbortError). */
  onError?: (kind: 'http-error' | 'network-error', err?: unknown) => void;
}

interface UsePoiSearchResult {
  results: PoiSearchResult[];
  searching: boolean;
}

/**
 * Schema guard — discard rows missing required fields (place_id + name + lat + lng).
 *
 * v2.23.0 google-maps-migration: osm_id (number) → place_id (string Google canonical id).
 */
function isValidPoi(row: unknown): row is PoiSearchResult {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.place_id === 'string'
    && r.place_id.length > 0
    && typeof r.name === 'string'
    && typeof r.lat === 'number'
    && typeof r.lng === 'number'
  );
}

/**
 * usePoiSearch — debounced + abort-safe POI search hook.
 *
 * Replaces the duplicated ~50-LOC debounce + AbortController + fetch pattern
 * that lived in NewTripPage / EditTripPage / AddStopPage / ExplorePage.
 *
 * Behaviour:
 *   - Debounce 300ms (configurable) on `query` change
 *   - Min query length 2 chars (shorter → empty results, no fetch)
 *   - AbortController per request: rapid typing cancels inflight requests so
 *     the most recent query always wins (no last-write-wins race)
 *   - Cleanup on unmount + on `query`/`enabled`/`limit` change
 *   - `normalise` + `onError` 透過 ref 引用，callers 不必 useCallback 也不會
 *     觸發 effect re-run (PR #459 fix)。
 *   - Schema guard：drop rows missing osm_id/name/lat/lng，避免 malformed
 *     POI 進入 React state 造成 key collision / lat/lng undefined runtime crash
 */
export function usePoiSearch({
  enabled = true,
  query,
  limit = 20,
  debounceMs = 300,
  normalise,
  onError,
}: UsePoiSearchOptions): UsePoiSearchResult {
  const [results, setResults] = useState<PoiSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Stable ref for callbacks — drop from effect deps so caller-side
  // inline arrows don't re-trigger the effect on every parent render.
  const normaliseRef = useRef(normalise);
  const onErrorRef = useRef(onError);
  useEffect(() => { normaliseRef.current = normalise; }, [normalise]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    if (!enabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setSearching(true);
      try {
        const resp = await fetch(
          `/api/poi-search?q=${encodeURIComponent(trimmed)}&limit=${limit}`,
          { signal: ctrl.signal },
        );
        if (!resp.ok) {
          onErrorRef.current?.('http-error');
          if (abortRef.current === ctrl) setResults([]);
          return;
        }
        const raw = await resp.json() as unknown;
        const normalised = normaliseRef.current ? normaliseRef.current(raw) : (raw as PoiSearchResult[]);
        const rows = Array.isArray(normalised) ? normalised.filter(isValidPoi) : [];
        if (abortRef.current === ctrl) setResults(rows);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        onErrorRef.current?.('network-error', err);
        if (abortRef.current === ctrl) setResults([]);
      } finally {
        if (abortRef.current === ctrl) setSearching(false);
      }
    }, debounceMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [enabled, query, limit, debounceMs]);

  return { results, searching };
}
