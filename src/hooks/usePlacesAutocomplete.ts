/**
 * usePlacesAutocomplete — typeahead hook for AddStopPage 自訂 tab + AddCustomStopPage.
 *
 * v2.31.94 custom-stop-location-picker.
 *
 * Pattern:
 *   - 300ms debounce → POST /api/places/autocomplete
 *   - Session token (crypto.randomUUID) rotates on pickSuggestion / reset / clear
 *     per Google Places billing semantics (one autocomplete session = one billable
 *     interaction ending in either Place Details lookup or abandonment)
 *   - In-memory cache (per region) to skip duplicate fetches for same query
 *   - AbortController cancels in-flight when query changes
 *   - Unmount cleanup avoids setState-after-unmount warnings
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/apiClient';

export interface PlacePrediction {
  placeId: string;
  primaryText: string;
  secondaryText: string;
}

export interface UsePlacesAutocompleteOptions {
  regionCode?: string;
  /** Minimum query length before fetching. Default 2. */
  minLength?: number;
  /** Debounce window in ms. Default 300. */
  debounceMs?: number;
}

export interface UsePlacesAutocompleteResult {
  query: string;
  setQuery: (q: string) => void;
  predictions: PlacePrediction[];
  loading: boolean;
  error: Error | null;
  /**
   * Call when user picks a suggestion — clears predictions and rotates the
   * session token. Returns the closing token so the caller can pass it to
   * `/places/resolve?sessionToken=...` (one billable Google session per pick).
   */
  pickSuggestion: (placeId: string) => string | null;
  /** Full reset (query + predictions + session). */
  reset: () => void;
}

const cache = new Map<string, PlacePrediction[]>();

export const __internal = {
  clearCache: () => cache.clear(),
};

function cacheKey(q: string, region: string | undefined): string {
  return `${region ?? ''}::${q}`;
}

export function usePlacesAutocomplete(
  opts: UsePlacesAutocompleteOptions = {},
): UsePlacesAutocompleteResult {
  const { regionCode, minLength = 2, debounceMs = 300 } = opts;

  const [query, setQueryState] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sessionTokenRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  function ensureSessionToken(): string {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = crypto.randomUUID();
    }
    return sessionTokenRef.current;
  }

  function rotateSessionToken(): void {
    sessionTokenRef.current = null;
  }

  const setQuery = useCallback(
    (next: string) => {
      setQueryState(next);
      setError(null);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();

      if (!next || next.trim().length < minLength) {
        setPredictions([]);
        setLoading(false);
        return;
      }

      const cached = cache.get(cacheKey(next.trim(), regionCode));
      if (cached) {
        setPredictions(cached);
        setLoading(false);
        return;
      }

      setLoading(true);
      const sessionToken = ensureSessionToken();
      const region = regionCode;
      const q = next.trim();

      debounceRef.current = setTimeout(() => {
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const body: Record<string, unknown> = { q, sessionToken };
        if (region) body.regionCode = region;

        apiFetch<{ predictions: PlacePrediction[] }>('/places/autocomplete', {
          method: 'POST',
          body: JSON.stringify(body),
          signal: ctrl.signal,
        })
          .then((json) => {
            if (!mountedRef.current) return;
            const list = Array.isArray(json.predictions) ? json.predictions : [];
            cache.set(cacheKey(q, region), list);
            setPredictions(list);
            setLoading(false);
          })
          .catch((err: unknown) => {
            if (!mountedRef.current) return;
            if (err instanceof DOMException && err.name === 'AbortError') return;
            setError(err instanceof Error ? err : new Error(String(err)));
            setLoading(false);
          });
      }, debounceMs);
    },
    [debounceMs, minLength, regionCode],
  );

  const pickSuggestion = useCallback((_placeId: string): string | null => {
    const closingToken = sessionTokenRef.current;
    rotateSessionToken();
    setPredictions([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    return closingToken;
  }, []);

  const reset = useCallback(() => {
    rotateSessionToken();
    setQueryState('');
    setPredictions([]);
    setError(null);
    setLoading(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  return { query, setQuery, predictions, loading, error, pickSuggestion, reset };
}
