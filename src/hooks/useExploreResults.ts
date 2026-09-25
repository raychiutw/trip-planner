import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { regionToApiParam } from '../lib/maps/region';
import { isValidCoord } from '../lib/locationPicker';
import type { PoiSearchResult } from '../types/poi';

/** Google Text Search supports three pages; keep tokens with their submitted query. */
const MAX_SEARCH_PAGES = 3;
export interface ExploreResults {
  query: string;
  region: string;
  results: PoiSearchResult[];
  nextPageToken: string | null;
  pagesLoaded: number;
}
export interface ExploreVisit {
  query: string;
  region: string;
  category: string;
  results: ExploreResults;
  scrollTop: number;
}
const initial: ExploreResults = { query: '東京', region: '全部地區', results: [], nextPageToken: null, pagesLoaded: 0 };

export function useExploreResults(restored?: ExploreResults) {
  const [snapshot, setSnapshot] = useState(restored ?? initial);
  const currentSnapshot = useRef(snapshot);
  const [searching, setSearching] = useState(!restored);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const flight = useRef<AbortController | null>(null);
  const active = useRef(true);

  const request = useCallback(async (scope: ExploreResults, append: boolean) => {
    if (!active.current) return;
    flight.current?.abort();
    const controller = new AbortController();
    flight.current = controller;
    if (append) { setLoadingMore(true); setMoreError(null); }
    else { currentSnapshot.current = scope; setSnapshot(scope); setSearching(true); setLoadingMore(false); setError(null); setMoreError(null); }
    try {
      const params = new URLSearchParams({ q: scope.query, limit: '20' });
      const region = regionToApiParam(scope.region);
      if (region) params.set('region', region);
      if (append && scope.nextPageToken) params.set('pageToken', scope.nextPageToken);
      const body = await apiFetch<{ results: PoiSearchResult[]; nextPageToken?: string | null }>(`/poi-search?${params}`, { signal: controller.signal });
      if (controller.signal.aborted || flight.current !== controller) return;
      if (!body || !Array.isArray(body.results) || body.results.some((p) => !p || typeof p.place_id !== 'string'
        || !p.place_id || typeof p.name !== 'string' || !isValidCoord(p)
        || (p.category != null && typeof p.category !== 'string')
        || (p.address != null && typeof p.address !== 'string')
        || (p.rating != null && (typeof p.rating !== 'number' || !Number.isFinite(p.rating))))
        || (body.nextPageToken != null && typeof body.nextPageToken !== 'string')) throw new Error('Invalid search response');
      const unique = new Map((append ? scope.results : []).map((p) => [p.place_id, p]));
      for (const poi of body.results) if (!unique.has(poi.place_id)) unique.set(poi.place_id, poi);
      const updated = { ...scope, results: [...unique.values()], pagesLoaded: append ? scope.pagesLoaded + 1 : 1,
        nextPageToken: body.nextPageToken && body.nextPageToken !== scope.nextPageToken ? body.nextPageToken : null };
      currentSnapshot.current = updated;
      setSnapshot(updated);
    } catch {
      if (controller.signal.aborted || flight.current !== controller) return;
      if (append) setMoreError('載入更多失敗，已保留目前結果');
      else setError('搜尋失敗，請重試');
    } finally {
      if (flight.current === controller) { flight.current = null; setSearching(false); setLoadingMore(false); }
    }
  }, []);
  const search = useCallback((query: string, region: string) => request({ ...initial, query, region }, false), [request]);
  useEffect(() => {
    active.current = true;
    if (!restored) void search(initial.query, initial.region);
    return () => { active.current = false; flight.current?.abort(); flight.current = null; };
    // The restored snapshot belongs to this mounted visit, not subsequent renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  const canLoadMore = !!snapshot.nextPageToken && snapshot.pagesLoaded < MAX_SEARCH_PAGES;
  const loadMore = useCallback((automatic = false) => {
    if (currentSnapshot.current !== snapshot || flight.current || !snapshot.nextPageToken || snapshot.pagesLoaded >= MAX_SEARCH_PAGES || (automatic && moreError)) return;
    return request(snapshot, true);
  }, [snapshot, moreError, request]);
  return { snapshot, searching, loadingMore, error, moreError, canLoadMore, search, loadMore,
    retry: () => search(snapshot.query, snapshot.region) };
}
