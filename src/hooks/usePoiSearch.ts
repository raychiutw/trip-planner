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
   * Optional caller-side response normaliser. API may return either a bare
   * array or `{ results: [...] }` wrapper, with snake_case vs camelCase row
   * shapes. Default: cast as `PoiSearchResult[]` (assumes API returns canonical shape).
   */
  normalise?: (raw: unknown) => PoiSearchResult[];
}

interface UsePoiSearchResult {
  results: PoiSearchResult[];
  searching: boolean;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  retry: () => void;
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
 *   - `normalise` 透過 ref 引用，callers 不必 useCallback 也不會
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
}: UsePoiSearchOptions): UsePoiSearchResult {
  const [attempt, setAttempt] = useState(0);
  const trimmed = query.trim();
  const active = enabled && trimmed.length >= 2;
  const key = JSON.stringify([active, trimmed, region, limit, attempt]);
  const scope = useMemo(() => ({key}), [key]);
  type Snapshot = { scope: object | null; results: PoiSearchResult[]; status: UsePoiSearchResult['status']; error: string | null };
  const [snapshot, setSnapshot] = useState<Snapshot>({scope: null, results: [], status: 'idle', error: null});
  const normaliseRef = useRef(normalise);
  normaliseRef.current = normalise;
  const retry = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    if (!active) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      const fail = (kind: 'http-error' | 'network-error') => {
        if (ctrl.signal.aborted) return;
        setSnapshot({scope, results: [], status: 'error', error: kind === 'http-error' ? '搜尋失敗，請稍後再試' : '網路連線失敗'});
      };
      try {
        const regionParam = region ? `&region=${encodeURIComponent(region)}` : '';
        const response = await apiFetchRaw(`/poi-search?q=${encodeURIComponent(trimmed)}&limit=${limit}${regionParam}`, {signal: ctrl.signal});
        if (ctrl.signal.aborted) return;
        if (!response.ok) { fail('http-error'); return; }
        const raw = await response.json() as unknown;
        if (ctrl.signal.aborted) return;
        const rows = normaliseRef.current ? normaliseRef.current(raw) : raw;
        setSnapshot({scope, results: Array.isArray(rows) ? rows.filter(isValidPoi) : [], status: 'success', error: null});
      } catch { fail('network-error'); }
    }, debounceMs);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [active, scope, trimmed, region, limit, debounceMs]);

  // A result belongs to its exact query, region and attempt. Never expose the
  // previous scope during the render before effect cleanup, or while disabled.
  const current = !active ? {results: [], status: 'idle' as const, error: null}
    : snapshot.scope === scope ? snapshot : {results: [], status: 'loading' as const, error: null};
  return { results: current.results, status: current.status, error: current.error, searching: current.status === 'loading', retry };
}
