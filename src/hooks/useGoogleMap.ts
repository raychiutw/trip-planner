/**
 * useGoogleMap — manage a Google Maps JS instance tied to a container ref.
 *
 * v2.23.0 google-maps-migration: replaces useLeafletMap (deleted in same PR).
 *
 * 載入策略：@googlemaps/js-api-loader 確保 google.maps 全域唯一 instance（多 component
 * 同 page 不重複載 ~300-500KB bundle）。Loader is singleton；多 hook call 共用同 promise。
 *
 * Bundle 載入期間 caller 改 render <MapSkeleton>（OceanMap 自己也會在 map=null 期間
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
import { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

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
    zoom = 11,
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

    const apiKey =
      (import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ?? '';
    if (!apiKey) {
      setLoadError(new Error('VITE_GOOGLE_MAPS_BROWSER_KEY not configured'));
      return;
    }

    ensureLoaderInit(apiKey);
    importLibrary('maps')
      .then((mapsLib) => {
        if (cancelled) return;
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
        });
        setMap(instance);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      cancelled = true;
      // Google Maps JS has no .remove() — element + map ref will be GC'd when
      // container detaches; we only clear React state.
      setMap(null);
    };
    // only init once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flyTo = (latLng: { lat: number; lng: number }, zoomLevel?: number) => {
    if (!map) return;
    if (prefersReducedMotion()) {
      map.setCenter(latLng);
      if (zoomLevel !== undefined) map.setZoom(zoomLevel);
    } else {
      map.panTo(latLng);
      if (zoomLevel !== undefined) map.setZoom(zoomLevel);
    }
  };

  const fitBounds = (
    latlngs: Array<{ lat: number; lng: number }>,
    paddingPx = 40,
  ) => {
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
  };

  return { containerRef, map, loadError, flyTo, fitBounds };
}
