/**
 * useMapMarkers — manage AdvancedMarkerElement lifecycle + focus diff-update.
 *
 * v2.33.57 round 11: extracted from `src/components/trip/OceanMap.tsx`
 * line 220-297 as part of the 4-module split. Effects + ref ownership
 * preserved exactly to maintain v2.31.75 diff-update semantics.
 *
 * Behaviour invariants (mirror original):
 *   - markersRef built once per (map, visiblePins, onMarkerClick, pinIdToDayColor)
 *   - prevFocusRef tracks last focus state to compute affected marker set
 *   - Cleanup removes all listeners + clears AdvancedMarkerElement.map
 */
import { useEffect, useRef } from 'react';
import { markerStyle, markerContent } from '../lib/mapHelpers';
import type { MapPin } from '../lib/mapTypes';

export interface UseMapMarkersParams {
  map: google.maps.Map | null;
  visiblePins: MapPin[];
  visiblePinsById: Map<number, MapPin>;
  pinIndexById: Map<number, number>;
  focusId?: number;
  focusedIdx: number;
  isPastPin: (pinId: number) => boolean;
  pinIdToDayColor: Map<number, string>;
  onMarkerClick?: (pinId: number) => void;
}

export function useMapMarkers(params: UseMapMarkersParams): void {
  const {
    map,
    visiblePins,
    visiblePinsById,
    pinIndexById,
    focusId,
    focusedIdx,
    isPastPin,
    pinIdToDayColor,
    onMarkerClick,
  } = params;

  // v2.31.75: google.maps.Marker (deprecated) → AdvancedMarkerElement。
  const markersRef = useRef<Map<number, google.maps.marker.AdvancedMarkerElement>>(new Map());

  /* --- Markers: create once per pin-set, diff-update on focus change --- */
  useEffect(() => {
    if (!map) return;
    const markers = new Map<number, google.maps.marker.AdvancedMarkerElement>();
    const listeners: google.maps.MapsEventListener[] = [];
    for (const pin of visiblePins) {
      const style = markerStyle(pin, false, false, pinIdToDayColor.get(pin.id));
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: pin.lat, lng: pin.lng },
        map,
        content: markerContent(style),
        title: `第 ${pin.index} 站：${pin.title}`,
        // gmpClickable 預設 false；onMarkerClick 才需要點擊
        gmpClickable: onMarkerClick !== undefined,
      });
      if (onMarkerClick) {
        // AdvancedMarkerElement: 'gmp-click' event (vs 舊 Marker 的 'click')
        listeners.push(marker.addListener('gmp-click', () => onMarkerClick(pin.id)));
      }
      markers.set(pin.id, marker);
    }
    markersRef.current = markers;
    return () => {
      for (const l of listeners) l.remove();
      // AdvancedMarkerElement: 設 map=null 從 map 移除
      for (const m of markers.values()) m.map = null;
      if (markersRef.current === markers) markersRef.current = new Map();
    };
  }, [map, visiblePins, onMarkerClick, pinIdToDayColor]);

  // Diff-based focus update.
  const prevFocusRef = useRef<{
    focusId?: number;
    focusedIdx: number;
    markers: Map<number, google.maps.marker.AdvancedMarkerElement> | null;
  }>({ focusedIdx: -1, markers: null });

  useEffect(() => {
    const markers = markersRef.current;
    const prev = prevFocusRef.current;
    const rebuilt = prev.markers !== markers;

    const affected = new Set<number>();
    if (rebuilt) {
      for (const pin of visiblePins) affected.add(pin.id);
    } else {
      if (prev.focusId !== undefined) affected.add(prev.focusId);
      if (focusId !== undefined) affected.add(focusId);
      const prevIdx = prev.focusedIdx;
      const currIdx = focusedIdx;
      if (prevIdx !== currIdx) {
        const lo = Math.max(0, Math.min(prevIdx, currIdx));
        const hi = Math.max(prevIdx, currIdx);
        if (hi >= 0) {
          for (const pin of visiblePins) {
            const idx = pinIndexById.get(pin.id) ?? -1;
            if (idx >= lo && idx <= hi) affected.add(pin.id);
          }
        }
      }
    }

    for (const pinId of affected) {
      const marker = markers.get(pinId);
      const pin = visiblePinsById.get(pinId);
      if (!marker || !pin) continue;
      const isFocused = pinId === focusId;
      const style = markerStyle(pin, isFocused, isPastPin(pinId), pinIdToDayColor.get(pinId));
      // AdvancedMarkerElement: 整個 content node 換掉（diff-update via DOM replace）
      marker.content = markerContent(style);
      marker.zIndex = isFocused ? 1000 : null;
    }

    prevFocusRef.current = { focusId, focusedIdx, markers };
  }, [map, onMarkerClick, visiblePins, visiblePinsById, focusId, focusedIdx, pinIndexById, isPastPin, pinIdToDayColor]);
}
