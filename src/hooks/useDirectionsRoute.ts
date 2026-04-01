/**
 * useDirectionsRoute — Google Maps Directions API 路線 hook
 *
 * 從 DirectionsService 取得景點間的實際道路路線：
 * - 所有 pins 合併為一次 Directions 請求（origin + waypoints + destination）
 * - 快取結果（ref Map，key = pins 座標 hash）
 * - enabled=false 時不發請求（地圖收合時使用）
 * - API 失敗時回傳 null（不 fallback 直線）
 * - 使用 @googlemaps/js-api-loader 的 importLibrary 按需載入 routes library
 */

import { useState, useEffect, useRef } from 'react';
import { importLibrary } from '@googlemaps/js-api-loader';
import type { MapPin } from './useMapData';

/* ===== Types ===== */

export interface DirectionsRouteResult {
  /** 完整路線 path（所有 leg 的 step.path 合併），null = 載入中或失敗 */
  routePath: google.maps.LatLngLiteral[] | null;
  /** 每段 leg 的路徑中點（用於 travel label 定位），legMidpoints[i] 對應 sorted pins[i] → pins[i+1] */
  legMidpoints: google.maps.LatLngLiteral[];
  /** 是否正在載入 */
  loading: boolean;
}

/* ===== 共用排序 ===== */

export function sortPinsByOrder(pins: MapPin[]): MapPin[] {
  return [...pins].sort((a, b) => a.sortOrder - b.sortOrder);
}

/* ===== Cache key：以排序後的座標建立唯一識別 ===== */

export function buildCacheKey(pins: MapPin[]): string {
  return sortPinsByOrder(pins)
    .map(p => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)
    .join('|');
}

/* ===== Cache 大小上限 ===== */

const MAX_CACHE_SIZE = 20;

/* ===== 常數：避免 useState/setState 因新 [] 觸發不必要 re-render ===== */

const EMPTY_MIDPOINTS: google.maps.LatLngLiteral[] = [];

/* ===== Hook ===== */

export function useDirectionsRoute(
  pins: MapPin[],
  enabled: boolean,
): DirectionsRouteResult {
  const [routePath, setRoutePath] = useState<google.maps.LatLngLiteral[] | null>(null);
  const [legMidpoints, setLegMidpoints] = useState(EMPTY_MIDPOINTS);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef(new Map<string, { path: google.maps.LatLngLiteral[]; midpoints: google.maps.LatLngLiteral[] }>());
  const serviceRef = useRef<google.maps.DirectionsService | null>(null);
  const routesLoadedRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const sorted = sortPinsByOrder(pins);

    if (!enabled || sorted.length < 2) {
      setRoutePath(null);
      setLegMidpoints(EMPTY_MIDPOINTS);
      setLoading(false);
      return;
    }

    const key = buildCacheKey(pins);
    const cached = cacheRef.current.get(key);
    if (cached) {
      setRoutePath(cached.path);
      setLegMidpoints(cached.midpoints);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function fetchRoute() {
      /* routes library 只載入一次，後續 reuse promise */
      if (!routesLoadedRef.current) {
        routesLoadedRef.current = importLibrary('routes').then(() => {});
      }
      try {
        await routesLoadedRef.current;
      } catch {
        routesLoadedRef.current = null;
        if (!cancelled) {
          setRoutePath(null);
          setLegMidpoints(EMPTY_MIDPOINTS);
          setLoading(false);
        }
        return;
      }

      if (cancelled) return;

      if (!serviceRef.current) {
        serviceRef.current = new google.maps.DirectionsService();
      }

      const origin = { lat: sorted[0].lat, lng: sorted[0].lng };
      const destination = { lat: sorted[sorted.length - 1].lat, lng: sorted[sorted.length - 1].lng };
      /* Google Directions API 限制 25 waypoints；超過則截斷 */
      const intermediates = sorted.slice(1, -1);
      const waypoints: google.maps.DirectionsWaypoint[] = intermediates.slice(0, 25).map(p => ({
        location: new google.maps.LatLng(p.lat, p.lng),
        stopover: true,
      }));

      try {
        const result = await serviceRef.current.route({
          origin,
          destination,
          waypoints,
          travelMode: google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false,
        });

        if (cancelled) return;
        if (!result.routes?.[0]?.legs) {
          setRoutePath(null);
          setLegMidpoints(EMPTY_MIDPOINTS);
          setLoading(false);
          return;
        }

        const path: google.maps.LatLngLiteral[] = [];
        const midpoints: google.maps.LatLngLiteral[] = [];

        for (const leg of result.routes[0].legs) {
          const legStart = path.length;
          for (const step of leg.steps) {
            for (const point of step.path) {
              path.push({ lat: point.lat(), lng: point.lng() });
            }
          }
          const legEnd = path.length;
          const midIdx = Math.floor((legStart + legEnd) / 2);
          if (midIdx < path.length) {
            midpoints.push(path[midIdx]);
          }
        }

        /* LRU-style eviction：超過上限刪除最舊的 entry */
        if (cacheRef.current.size >= MAX_CACHE_SIZE) {
          const oldest = cacheRef.current.keys().next().value;
          if (oldest !== undefined) cacheRef.current.delete(oldest);
        }
        cacheRef.current.set(key, { path, midpoints });
        setRoutePath(path);
        setLegMidpoints(midpoints);
      } catch (err) {
        if (!cancelled) {
          console.warn('[useDirectionsRoute] Directions API failed:', err);
          setRoutePath(null);
          setLegMidpoints(EMPTY_MIDPOINTS);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRoute();

    return () => { cancelled = true; };
  }, [pins, enabled]);

  return { routePath, legMidpoints, loading };
}
