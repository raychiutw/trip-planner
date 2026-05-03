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
 *   - Silent on errors (caller can wrap in try/catch if needed via `normalise`)
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
          onError?.('http-error');
          if (abortRef.current === ctrl) setResults([]);
          return;
        }
        const raw = await resp.json() as unknown;
        const rows = normalise ? normalise(raw) : (raw as PoiSearchResult[]);
        if (abortRef.current === ctrl) setResults(rows);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        onError?.('network-error', err);
        if (abortRef.current === ctrl) setResults([]);
      } finally {
        if (abortRef.current === ctrl) setSearching(false);
      }
    }, debounceMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [enabled, query, limit, debounceMs, normalise, onError]);

  return { results, searching };
}
