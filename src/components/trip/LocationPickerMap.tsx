/**
 * LocationPickerMap — picker-mode Google Maps with fixed-center marker.
 *
 * v2.31.94 custom-stop-location-picker.
 *
 * UX pattern:
 *   - Marker = CSS overlay `<div>` pinned to map container center (NOT
 *     AdvancedMarkerElement, which would move with the map and defeat the
 *     pick-by-pan interaction)
 *   - User drags map → `idle` event fires when pan settles → coord = map.getCenter()
 *   - Keyboard a11y: arrow keys nudge map via panBy with step ~10 m at current zoom
 *   - Container focused with tabIndex; aria-live updates on coord change
 *
 * Distinct from OceanMap by intent: OceanMap renders read-only trip markers via
 * AdvancedMarkerElement + polylines. This component owns picker-mode concerns
 * (one marker that doesn't move, plus center-extraction).
 */
import { useEffect, useState } from 'react';
import { useGoogleMap } from '../../hooks/useGoogleMap';
import {
  computeArrowKeyStepPixels,
  isValidCoord,
  type Coord,
} from '../../lib/locationPicker';

export interface LocationPickerMapProps {
  initialCenter: Coord;
  initialZoom?: number;
  onCoordChange: (coord: Coord) => void;
  /** Imperative flyTo handle from parent — used when address typeahead picks a suggestion. */
  flyToSignal?: { coord: Coord; zoom?: number } | null;
  className?: string;
  style?: React.CSSProperties;
}

export function LocationPickerMap(props: LocationPickerMapProps) {
  const { initialCenter, initialZoom = 14, onCoordChange, flyToSignal } = props;
  const { containerRef, map, loadError, flyTo } = useGoogleMap({
    center: initialCenter,
    zoom: initialZoom,
    zoomControl: true,
    zoomControlPosition: 'TOP_RIGHT',
  });
  const [currentCoord, setCurrentCoord] = useState<Coord>(initialCenter);

  // Wire idle listener once map is ready
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('idle', () => {
      const c = map.getCenter();
      if (!c) return;
      const next: Coord = { lat: c.lat(), lng: c.lng() };
      if (!isValidCoord(next)) return;
      setCurrentCoord(next);
      onCoordChange(next);
    });
    return () => listener.remove();
  }, [map, onCoordChange]);

  // Imperative flyTo from typeahead pick
  useEffect(() => {
    if (!flyToSignal) return;
    if (!isValidCoord(flyToSignal.coord)) return;
    flyTo(flyToSignal.coord, flyToSignal.zoom ?? initialZoom);
  }, [flyToSignal, flyTo, initialZoom]);

  // Arrow-key keyboard a11y
  function handleKeyDown(ev: React.KeyboardEvent<HTMLDivElement>) {
    if (!map) return;
    const zoom = map.getZoom() ?? initialZoom;
    const lat = map.getCenter()?.lat() ?? currentCoord.lat;
    const step = computeArrowKeyStepPixels(zoom, lat);
    switch (ev.key) {
      case 'ArrowUp':
        ev.preventDefault();
        map.panBy(0, -step);
        break;
      case 'ArrowDown':
        ev.preventDefault();
        map.panBy(0, step);
        break;
      case 'ArrowLeft':
        ev.preventDefault();
        map.panBy(-step, 0);
        break;
      case 'ArrowRight':
        ev.preventDefault();
        map.panBy(step, 0);
        break;
      default:
        return;
    }
  }

  if (loadError) {
    return (
      <div className="tp-custom-picker-error" role="alert" data-testid="custom-picker-map-error">
        無法載入地圖，請改用搜尋 tab 找景點。
      </div>
    );
  }

  return (
    <div
      className={`tp-custom-picker-wrap ${props.className ?? ''}`}
      style={props.style}
      data-testid="custom-picker-wrap"
    >
      <div
        ref={containerRef}
        className="tp-custom-picker-map"
        tabIndex={0}
        role="application"
        aria-label={`拖曳地圖選擇景點位置，目前選擇 ${currentCoord.lat.toFixed(4)} 北緯 ${currentCoord.lng.toFixed(4)} 東經`}
        onKeyDown={handleKeyDown}
        data-testid="custom-picker-map"
      />
      <div
        className="tp-custom-picker-pin"
        aria-hidden="true"
        data-testid="custom-picker-pin"
      >
        <svg viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M16 1 C8 1 2 7 2 15 c0 10 14 24 14 24 s14-14 14-24 c0-8-6-14-14-14 z"
            fill="var(--color-accent)"
            stroke="var(--color-accent-deep)"
            strokeWidth="1.5"
          />
          <circle cx="16" cy="15" r="5" fill="var(--color-background)" />
        </svg>
      </div>
      <div
        className="tp-custom-picker-coord"
        data-testid="custom-picker-coord"
        aria-live="polite"
      >
        {currentCoord.lat.toFixed(4)}°N {currentCoord.lng.toFixed(4)}°E
      </div>
    </div>
  );
}
