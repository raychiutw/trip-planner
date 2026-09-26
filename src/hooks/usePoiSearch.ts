import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PoiSearchResult } from '../types/poi';
// v2.33.39 round 4: 改走 apiFetchRaw，與 sibling hook (useTrip / useChatPagination)
// 一致。bare fetch 會繞過 reportFetchResult → useOnlineStatus offline-toast 失效。
import { apiFetchRaw } from '../lib/apiClient';

interface UsePoiSearchOptions {
  /** Disable the hook entirely (e.g. when not on search tab). Default: true (enabled). */
  enabled?: boolean;
  /** Search query — empty / <2 chars triggers no fetch and clears results. */
  query: string;
  /**
   * ISO 3166-1 alpha-2 country code (JP / TW / KR) forwarded to Google Places
   * `regionCode`. Without it, Google falls back to caller-IP geolocation —
   * Taiwan IP searching for Tokyo POIs returns Taipei results.
   */
  region?: string;
  /** Result count cap. Default: 20. */
  limit?: number;
  /** Debounce window in ms. Default: 300. */
  debounceMs?: number;
  /**
   * Optional normaliser for callers with a different POI row shape.
   * Default accepts the POI search API's `{ results: [...] }` and bare arrays.
   */
  normalise?: (raw: unknown) => PoiSearchResult[];
  /** Legacy callback for callers migrating in T05; current errors are also returned in state. */
  onError?: (kind: 'http-error' | 'network-error', err?: unknown) => void;
}

interface UsePoiSearchResult {
  /** Current query/region result. Never contains a previous search's rows or error. */
  state: {
    status: 'idle' | 'loading' | 'success' | 'error';
    results: PoiSearchResult[];
    error: 'http-error' | 'network-error' | null;
  };
  retry: () => void;
  /** Transitional fields for AddStopPage/ChangePoiPage until T05. */
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
 *   - Schema guard：drop rows missing place_id/name/lat/lng，避免 malformed
 *     POI 進入 React state 造成 key collision / lat/lng undefined runtime crash
 */
export function usePoiSearch({
  enabled = true,
  query,
  region,
  limit = 20,
  debounceMs = 300,
  normalise,
  onError,
}: UsePoiSearchOptions): UsePoiSearchResult {
  const [result, setResult] = useState<{
    key: object;
    status: 'loading' | 'success' | 'error';
    results: PoiSearchResult[];
    error: 'http-error' | 'network-error' | null;
  } | null>(null);
  const [generation, setGeneration] = useState(0);
  const retry = useCallback(() => setGeneration((value) => value + 1), []);
  const trimmed = query.trim();
  // Each change is a new search, including A → B → A and disable → enable.
  const key = useMemo(() => ({ enabled, trimmed, region, limit, generation }), [enabled, trimmed, region, limit, generation]);
  const currentKeyRef = useRef(key);
  currentKeyRef.current = key;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Stable ref for callbacks — drop from effect deps so caller-side
  // inline arrows don't re-trigger the effect on every parent render.
  const normaliseRef = useRef(normalise);
  const onErrorRef = useRef(onError);
  useEffect(() => { normaliseRef.current = normalise; }, [normalise]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    if (!enabled || trimmed.length < 2) return;
    setResult({ key, status: 'loading', results: [], error: null });
    debounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const regionParam = region ? `&region=${encodeURIComponent(region)}` : '';
        const resp = await apiFetchRaw(
          `/poi-search?q=${encodeURIComponent(trimmed)}&limit=${limit}${regionParam}`,
          { signal: ctrl.signal },
        );
        if (!resp.ok) {
          if (currentKeyRef.current === key && !ctrl.signal.aborted) {
            onErrorRef.current?.('http-error');
            setResult({ key, status: 'error', results: [], error: 'http-error' });
          }
          return;
        }
        const raw = await resp.json() as unknown;
        const normalised = normaliseRef.current
          ? normaliseRef.current(raw)
          : Array.isArray(raw) ? raw : (raw as { results?: unknown } | null)?.results;
        const rows = Array.isArray(normalised) ? normalised.filter(isValidPoi) : [];
        if (currentKeyRef.current === key && !ctrl.signal.aborted) {
          setResult({ key, status: 'success', results: rows, error: null });
        }
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        if (currentKeyRef.current === key && !ctrl.signal.aborted) {
          onErrorRef.current?.('network-error', err);
          setResult({ key, status: 'error', results: [], error: 'network-error' });
        }
      }
    }, debounceMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [enabled, trimmed, region, limit, debounceMs, key]);

  const state = !enabled || trimmed.length < 2
    ? { status: 'idle' as const, results: [], error: null }
    : result?.key === key
      ? { status: result.status, results: result.results, error: result.error }
      : { status: 'loading' as const, results: [], error: null };
  return { state, retry, results: state.results, searching: state.status === 'loading' };
}
