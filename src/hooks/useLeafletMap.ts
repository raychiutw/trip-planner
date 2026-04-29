/**
 * useLeafletMap — manage a Leaflet map instance tied to a container ref
 *
 * Handles:
 *  - Strict Mode idempotency: never double-init (checks container._leaflet_id)
 *  - Cleanup: calls map.remove() on unmount / container change
 *  - Tile layer with light/dark OSM providers + 2 subdomain rotation
 *  - Reduced-motion: disables flyTo, uses setView
 *
 *  ┌─────────── mount ───────────┐
 *  │ container ref → L.map()     │
 *  │ add tile layer              │
 *  │ expose map via ref          │
 *  └──────────────┬──────────────┘
 *                 │
 *         unmount │
 *                 ▼
 *         map.remove() + ref.current = null
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const OSM_LIGHT = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
// Dark UI 配 Carto Positron light tile：深色 tile 跟 dark chrome 對比不夠，
// markers / polylines / labels 不易看清；改 light_all 給 dark UI 一張 muted
// 淺色底圖，accent 紅色 polyline + day-color marker 在淺底圖上對比強。
const OSM_DARK_UI = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const CARTO_ATTR = OSM_ATTR + ' &copy; <a href="https://carto.com/attributions">CARTO</a>';

export interface UseLeafletMapOptions {
  center?: L.LatLngExpression;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  zoomControl?: boolean;
  /** Position of Leaflet's built-in zoom control. Default 'topleft' (Leaflet 預設)。
   *  /map 用 'bottomright' 對齊 mockup 並避開左上 trip switcher。 */
  zoomControlPosition?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  dark?: boolean;
}

export interface UseLeafletMap {
  /** ref to attach to the map container div */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** underlying Leaflet map instance (null until mounted) */
  map: L.Map | null;
  /** pan with reduced-motion awareness */
  flyTo: (latlng: L.LatLngExpression, zoom?: number) => void;
  /** fit bounds around the given latlngs */
  fitBounds: (latlngs: L.LatLngExpression[], padding?: number) => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useLeafletMap(opts: UseLeafletMapOptions = {}): UseLeafletMap {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);

  const { center = [26.2124, 127.6792], zoom = 11, minZoom = 3, maxZoom = 19, zoomControl = false, zoomControlPosition = 'topleft', dark = false } = opts;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Strict Mode double-invoke guard — Leaflet tags containers with `_leaflet_id`.
    // If the container already has a map, Leaflet throws "Map container is already initialized".
    if ((el as unknown as { _leaflet_id?: number })._leaflet_id) {
      return;
    }

    const instance = L.map(el, {
      center,
      zoom,
      minZoom,
      maxZoom,
      // 自己加 zoom control 才有 position 控制，預設 L.map 一律放 topleft。
      zoomControl: false,
      attributionControl: true,
      /* 2026-04-29:explicit 啟用 mobile 手勢操作(user 反饋「手機地圖增加手勢
       * 操作」)。Leaflet 1.7+ default 全 enabled + 移除 `tap`(modern browsers
       * 原生 handle),這裡顯式宣告對齊 user 預期。 */
      dragging: true,           // one-finger pan
      touchZoom: true,          // two-finger pinch zoom
      doubleClickZoom: true,    // double-tap zoom
      scrollWheelZoom: true,    // desktop mouse wheel
      bounceAtZoomLimits: true, // 縮放邊界 bounce 視覺回饋
    });
    if (zoomControl) {
      L.control.zoom({ position: zoomControlPosition }).addTo(instance);
    }

    L.tileLayer(dark ? OSM_DARK_UI : OSM_LIGHT, {
      attribution: dark ? CARTO_ATTR : OSM_ATTR,
      subdomains: dark ? 'abcd' : 'abc',
      maxZoom,
    }).addTo(instance);

    setMap(instance);

    return () => {
      // Stop any in-flight pan/zoom animation before teardown.
      // Without this, a queued _onZoomTransitionEnd setTimeout can fire
      // after map.remove() clears panes, throwing "_leaflet_pos" TypeError
      // (seen on iOS Chrome when navigating away mid-animation).
      instance.stop();
      instance.remove();
      setMap(null);
    };
    // only init once per mount; caller can change theme via `dark` by unmounting
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap tile layer when `dark` changes without tearing the map down.
  useEffect(() => {
    if (!map) return;
    const tiles: L.TileLayer[] = [];
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) tiles.push(layer);
    });
    tiles.forEach((t) => map.removeLayer(t));
    L.tileLayer(dark ? OSM_DARK_UI : OSM_LIGHT, {
      attribution: dark ? CARTO_ATTR : OSM_ATTR,
      subdomains: dark ? 'abcd' : 'abc',
      maxZoom,
    }).addTo(map);
  }, [map, dark, maxZoom]);

  const flyTo = (latlng: L.LatLngExpression, zoomLevel?: number) => {
    if (!map) return;
    map.stop(); // cancel in-flight animation to avoid pile-up
    if (prefersReducedMotion()) {
      map.setView(latlng, zoomLevel ?? map.getZoom());
    } else {
      map.flyTo(latlng, zoomLevel ?? map.getZoom(), { duration: 0.4 });
    }
  };

  const fitBounds = (latlngs: L.LatLngExpression[], padding = 40) => {
    if (!map || latlngs.length === 0) return;
    if (latlngs.length === 1) {
      const only = latlngs[0];
      if (only) {
        const z = map.getZoom();
        map.setView(only, Number.isFinite(z) ? Math.max(z, 14) : 14);
      }
      return;
    }
    const bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [padding, padding] });
  };

  return { containerRef, map, flyTo, fitBounds };
}
