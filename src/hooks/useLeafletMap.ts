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
const OSM_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const CARTO_ATTR = OSM_ATTR + ' &copy; <a href="https://carto.com/attributions">CARTO</a>';

export interface UseLeafletMapOptions {
  center?: L.LatLngExpression;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  zoomControl?: boolean;
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

  const { center = [26.2124, 127.6792], zoom = 11, minZoom = 3, maxZoom = 19, zoomControl = false, dark = false } = opts;

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
      zoomControl,
      attributionControl: true,
    });

    L.tileLayer(dark ? OSM_DARK : OSM_LIGHT, {
      attribution: dark ? CARTO_ATTR : OSM_ATTR,
      subdomains: dark ? 'abcd' : 'abc',
      maxZoom,
    }).addTo(instance);

    setMap(instance);

    return () => {
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
    L.tileLayer(dark ? OSM_DARK : OSM_LIGHT, {
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
