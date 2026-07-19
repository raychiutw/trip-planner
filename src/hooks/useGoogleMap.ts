/**
 * useGoogleMap — manage a Google Maps JS instance tied to a container ref.
 *
 * v2.23.0 google-maps-migration: replaces useLeafletMap (deleted in same PR).
 *
 * 載入策略：@googlemaps/js-api-loader 確保 google.maps 全域唯一 instance（多 component
 * 同 page 不重複載 ~300-500KB bundle）。Loader is singleton；多 hook call 共用同 promise。
 *
 * Bundle 載入期間 caller 改 render <MapSkeleton>（TpMap 自己也會在 map=null 期間
 * 渲染 skeleton）。
 *
 * Auth：browser key 從 import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY 取（HTTP referrer
 * restriction = trip-planner-dby.pages.dev set on Google Cloud Console）。
 *
 *  ┌─────────── mount ───────────┐
 *  │ Loader.importLibrary('maps')│
 *  │ → new google.maps.Map(el)   │
 *  │ expose map via setState     │
 *  └──────────────┬──────────────┘
 *                 │
 *         unmount │
 *                 ▼
 *         null state + (Google Maps 無 .remove())
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

declare global {
  interface Window {
    /** Google Maps 官方全域 callback：API key / referer 授權失敗時呼叫（見 useGoogleMap effect）。 */
    gm_authFailure?: () => void;
  }
}

export interface UseGoogleMapOptions {
  /** Default center [lat, lng]. */
  center?: { lat: number; lng: number };
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  /** Whether to render Google's default zoom control. */
  zoomControl?: boolean;
  /** ControlPosition string from google.maps.ControlPosition enum. Default 'TOP_LEFT'. */
  zoomControlPosition?: 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT';
  /** Initial mapTypeId. Default 'roadmap'. MapFabs may swap at runtime. */
  mapTypeId?: 'roadmap' | 'satellite' | 'hybrid';
  /** Disable Google's default UI chrome (POI labels, fullscreen button etc.) */
  disableDefaultUI?: boolean;
}

export interface UseGoogleMap {
  containerRef: React.RefObject<HTMLDivElement | null>;
  map: google.maps.Map | null;
  loadError: Error | null;
  /** Pan with reduced-motion awareness (no animated transition when reduced). */
  flyTo: (latLng: { lat: number; lng: number }, zoom?: number) => void;
  /** Fit bounds around the given latlngs. */
  fitBounds: (latlngs: Array<{ lat: number; lng: number }>, paddingPx?: number) => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let initialized = false;
function ensureLoaderInit(apiKey: string): void {
  if (initialized) return;
  setOptions({
    key: apiKey,
    v: 'weekly',
    libraries: ['maps', 'marker'],
    language: 'zh-TW',
  });
  initialized = true;
}

export function useGoogleMap(opts: UseGoogleMapOptions = {}): UseGoogleMap {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);

  const {
    center = { lat: 26.2124, lng: 127.6792 },
    zoom = 13, // owner 2026-07-19：預設 zoom 13（原 12；marker 點擊才 16）
    minZoom = 3,
    maxZoom = 19,
    zoomControl = false,
    zoomControlPosition = 'TOP_LEFT',
    mapTypeId = 'roadmap',
    disableDefaultUI = true,
  } = opts;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    // auth 失敗 flag：gate 下方 .then 的 setMap（避免 gm_authFailure 先於 promise
    // resolve 時，仍在授權失敗的 map 上建 instance → marker/segment 在壞 map 上 render）。
    let authFailed = false;

    const apiKey =
      (import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ?? '';
    if (!apiKey) {
      setLoadError(new Error('VITE_GOOGLE_MAPS_BROWSER_KEY not configured'));
      return;
    }

    ensureLoaderInit(apiKey);

    // Google Maps auth 失敗（referer/key 未授權，如 localhost 非授權來源）會呼叫全域
    // window.gm_authFailure，但此時 importLibrary promise 仍會 resolve → 下方 .catch
    // 抓不到。註冊此 callback 才能把 auth 失敗轉成 loadError（→ TpMap 顯「地圖暫停服務」
    // placeholder，而非讓 Google 自畫灰底 "This page can't load Google Maps correctly"
    // overlay / 整頁進 ErrorBoundary）。見 memory local_dev_gmaps_referer_crash。
    const prevAuthFailure = window.gm_authFailure;
    window.gm_authFailure = () => {
      authFailed = true;
      if (!cancelled) {
        setLoadError(new Error('Google Maps 授權失敗（referer / API key 未授權）'));
        // 清掉可能已建立的 map instance → 讓 markers/segments 收到 map=null（不在
        // 授權失敗的 map 上 render，避免 marker.js 整頁 ErrorBoundary 紅屏）。
        setMap(null);
      }
      prevAuthFailure?.();
    };

    // v2.31.76 hotfix #642 follow-up：必須同時 await 'marker' library 才能 setMap，
    // 否則 child component（TpMap / MapFabs）會在 google.maps.marker 尚未注入時
    // 嘗試 new google.maps.marker.AdvancedMarkerElement(...) → TypeError，整個 map
    // 進 ErrorBoundary。v2.31.75 把 google.maps.Marker → AdvancedMarkerElement 但漏
    // 等 marker lib，prod 整個 trip detail page 地圖紅屏。
    Promise.all([importLibrary('maps'), importLibrary('marker')])
      .then(([mapsLib]) => {
        if (cancelled || authFailed) return;
        const instance = new mapsLib.Map(el, {
          center,
          zoom,
          minZoom,
          maxZoom,
          mapTypeId,
          disableDefaultUI,
          zoomControl,
          zoomControlOptions: {
            position: google.maps.ControlPosition[zoomControlPosition],
          },
          gestureHandling: 'greedy', // mobile single-finger pan
          clickableIcons: false,     // disable Google's POI overlay clicks
          // v2.31.75: AdvancedMarkerElement requires a mapId to render.
          // v2.33.39 (round 4 security audit): 改讀 VITE_GOOGLE_MAPS_MAP_ID
          // env var；Google 共享的 'DEMO_MAP_ID' 在 GCP Console 列為可隨時停用，
          // 且為跨 app 共用、無自家 analytics 隔離。env 未設時仍 fallback DEMO_MAP_ID
          // 以維持 dev 開發體驗。
          mapId: (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) ?? 'DEMO_MAP_ID',
        });
        setMap(instance);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      cancelled = true;
      // 還原前一個 gm_authFailure（避免卸載後仍指向本 hook 的閉包）。
      window.gm_authFailure = prevAuthFailure;
      // Google Maps JS has no .remove() — element + map ref will be GC'd when
      // container detaches; we only clear React state.
      setMap(null);
    };
    // only init once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v2.33.39 (round 4): wrap in useCallback with `[map]` dep — 之前每 render
  // 都產新 closure，TpMap fitBounds effect dep 包含 fitBounds 會 re-fire 每
  // 次父 render → 地圖每次 state 變動都重新 fit。
  const flyTo = useCallback(
    (latLng: { lat: number; lng: number }, zoomLevel?: number) => {
      if (!map) return;
      if (prefersReducedMotion()) {
        map.setCenter(latLng);
        if (zoomLevel !== undefined) map.setZoom(zoomLevel);
      } else {
        map.panTo(latLng);
        if (zoomLevel !== undefined) map.setZoom(zoomLevel);
      }
    },
    [map],
  );

  const fitBounds = useCallback(
    (latlngs: Array<{ lat: number; lng: number }>, paddingPx = 40) => {
      if (!map || latlngs.length === 0) return;
      if (latlngs.length === 1) {
        const only = latlngs[0]!;
        map.setCenter(only);
        const z = map.getZoom() ?? 11;
        map.setZoom(Math.max(z, 14));
        return;
      }
      const bounds = new google.maps.LatLngBounds();
      for (const ll of latlngs) bounds.extend(ll);
      map.fitBounds(bounds, paddingPx);
    },
    [map],
  );

  return { containerRef, map, loadError, flyTo, fitBounds };
}
