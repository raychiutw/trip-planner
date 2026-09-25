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
import { apiFetch, apiFetchRaw } from '../lib/apiClient';
import { isValidCoord, type Coord } from '../lib/locationPicker';

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
  cancelResolution: () => void;
  resolving: boolean;
  resolveError: string | null;
  /** Resolves the selected Google address; omitting the ID retries the last pick. */
  resolveLocation: (placeId?: string) => Promise<Coord | null>;
}

// v2.33.40 round 4.5: LRU cap on cache — SPA-lifetime Map 無界限長期 typing
// session 後變幾百個 entry。Map insertion order = LRU；新寫入時若滿，evict 最舊。
const CACHE_LRU_MAX = 50;
const cache = new Map<string, PlacePrediction[]>();

function cacheGet(key: string): PlacePrediction[] | undefined {
  const value = cache.get(key);
  if (value !== undefined) {
    // Touch — re-insert moves to "newest" position in Map iteration order
    cache.delete(key);
    cache.set(key, value);
  }
  return value;
}

function cacheSet(key: string, value: PlacePrediction[]): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  if (cache.size > CACHE_LRU_MAX) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
}

export const __internal = {
  clearCache: () => cache.clear(),
  cacheSize: () => cache.size,
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
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const resolveRef = useRef<AbortController | null>(null);
  const lastPlaceRef = useRef<string | null>(null);

  const sessionTokenRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      resolveRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // v2.33.39 round 4: feature-detect crypto.randomUUID — Safari < 15.4 +
  // 部分 embedded browser 沒有；缺席時 fallback 用 time + random（session token
  // 只需 per-pick 唯一，非 cryptographic id）。
  function generateSessionToken(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
  }

  function ensureSessionToken(): string {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = generateSessionToken();
    }
    return sessionTokenRef.current;
  }

  function rotateSessionToken(): void {
    sessionTokenRef.current = null;
  }

  const setQuery = useCallback(
    (next: string) => {
      resolveRef.current?.abort();
      lastPlaceRef.current = null;
      setResolving(false); setResolveError(null);
      setQueryState(next);
      setPredictions([]);
      setError(null);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();

      if (!next || next.trim().length < minLength) {
        setPredictions([]);
        setLoading(false);
        return;
      }

      const cached = cacheGet(cacheKey(next.trim(), regionCode));
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
            if (!mountedRef.current || ctrl.signal.aborted) return;
            const list = Array.isArray(json.predictions) ? json.predictions : [];
            cacheSet(cacheKey(q, region), list);
            setPredictions(list);
            setLoading(false);
          })
          .catch((err: unknown) => {
            if (!mountedRef.current || ctrl.signal.aborted) return;
            if (err instanceof DOMException && err.name === 'AbortError') return;
            setError(err instanceof Error ? err : new Error(String(err)));
            setLoading(false);
          });
      }, debounceMs);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ensureSessionToken 只讀寫 sessionTokenRef（ref，無 reactive 依賴）；列入會讓 setQuery 每 render 重建、破壞 debounce。
    [debounceMs, minLength, regionCode],
  );

  const pickSuggestion = useCallback((_placeId: string): string | null => {
    const closingToken = sessionTokenRef.current;
    rotateSessionToken();
    setPredictions([]);
    setLoading(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    return closingToken;
  }, []);

  const cancelResolution = useCallback(() => {
    resolveRef.current?.abort(); lastPlaceRef.current = null;
    setResolving(false); setResolveError(null);
    pickSuggestion('');
  }, [pickSuggestion]);

  const resolveLocation = useCallback(async (placeId?: string): Promise<Coord | null> => {
    const id = placeId ?? lastPlaceRef.current;
    if (!id) return null;
    resolveRef.current?.abort();
    const controller = new AbortController();
    resolveRef.current = controller;
    lastPlaceRef.current = id;
    const sessionToken = pickSuggestion(id);
    setResolving(true); setResolveError(null);
    try {
      const query = new URLSearchParams({ placeId: id });
      if (sessionToken) query.set('sessionToken', sessionToken);
      const response = await apiFetchRaw(`/places/resolve?${query}`, { signal: controller.signal });
      if (!response.ok) throw new Error('Address unavailable');
      const coord = await response.json();
      if (!isValidCoord(coord)) throw new Error('Invalid coordinates');
      if (!mountedRef.current || controller.signal.aborted) return null;
      return { lat: coord.lat, lng: coord.lng };
    } catch {
      if (mountedRef.current && !controller.signal.aborted) setResolveError('無法確認地址位置，請重試或在地圖上選擇位置。');
      return null;
    } finally {
      if (mountedRef.current && !controller.signal.aborted) setResolving(false);
    }
  }, [pickSuggestion]);

  const reset = useCallback(() => {
    resolveRef.current?.abort(); lastPlaceRef.current = null;
    setResolving(false); setResolveError(null);
    rotateSessionToken();
    setQueryState('');
    setPredictions([]);
    setError(null);
    setLoading(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  return { query, setQuery, predictions, loading, error, pickSuggestion, reset, cancelResolution, resolving, resolveError, resolveLocation };
}
