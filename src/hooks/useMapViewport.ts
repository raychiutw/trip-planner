/**
 * useMapViewport — manage map viewport: fit/focus follow, resize, imperative pan.
 *
 * v2.33.57 round 11: extracted from `src/components/trip/TpMap.tsx`
 * line 299-341 as part of the 4-module split. Three effects + fitDoneRef
 * preserved exactly.
 *
 * Behaviour invariants (mirror original):
 *   - detail mode: setCenter + zoom 15 on visiblePins[0]
 *   - focused: flyTo focused pin, zoom 13 if currently < 12 else preserve
 *   - else: fitBounds (once if fitOnce, every change otherwise)
 *   - resize fires 50ms after map/mode change
 *   - panToCoord: flyTo with zoom or panTo without
 */
import { useEffect, useRef } from 'react';
import type { MapPin, Coord } from '../lib/mapTypes';

export interface UseMapViewportParams {
  map: google.maps.Map | null;
  mode: 'detail' | 'overview';
  focusId?: number;
  pins: MapPin[];
  visiblePins: MapPin[];
  pinIndexById: Map<number, number>;
  fitOnce: boolean;
  panToCoord?: { lat: number; lng: number; zoom?: number };
  fitBounds: (latlngs: Coord[]) => void;
  flyTo: (coord: Coord, zoom?: number) => void;
}

export function useMapViewport(params: UseMapViewportParams): void {
  const {
    map,
    mode,
    focusId,
    pins,
    visiblePins,
    pinIndexById,
    fitOnce,
    panToCoord,
    fitBounds,
    flyTo,
  } = params;

  /* --- Viewport fit / focus follow --- */
  const fitDoneRef = useRef(false);
  useEffect(() => {
    if (!map) return;
    if (mode === 'detail' && visiblePins[0]) {
      map.setCenter({ lat: visiblePins[0].lat, lng: visiblePins[0].lng });
      map.setZoom(16); // V3 design.md §7：明確聚焦 POI 用 zoom 16
      return;
    }
    if (focusId !== undefined) {
      const idx = pinIndexById.get(focusId);
      const pin = idx !== undefined ? pins[idx] : undefined;
      if (pin) {
        flyTo({ lat: pin.lat, lng: pin.lng }, 16); // V3 §7：點 marker/POI 卡 → zoom 16
        return;
      }
    }
    if (fitOnce && fitDoneRef.current) return;
    const latlngs = visiblePins.map((p) => ({ lat: p.lat, lng: p.lng }));
    fitBounds(latlngs);
    fitDoneRef.current = true;
  }, [map, mode, focusId, pins, pinIndexById, visiblePins, fitBounds, flyTo, fitOnce]);

  /* --- Resize on container changes (Suspense / mode toggle) --- */
  useEffect(() => {
    if (!map) return;
    const t = setTimeout(() => {
      google.maps.event.trigger(map, 'resize');
    }, 50);
    return () => clearTimeout(t);
  }, [map, mode]);

  /* --- Imperative soft pan --- */
  useEffect(() => {
    if (!map || !panToCoord) return;
    if (typeof panToCoord.zoom === 'number') {
      // v2.31.87：zoom 給就 flyTo (pan + setZoom 同步)，TimelineRail expand/collapse 用。
      flyTo({ lat: panToCoord.lat, lng: panToCoord.lng }, panToCoord.zoom);
    } else {
      map.panTo({ lat: panToCoord.lat, lng: panToCoord.lng });
    }
  }, [map, panToCoord, flyTo]);
}
