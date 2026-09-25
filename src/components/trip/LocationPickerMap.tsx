/**
 * LocationPickerMap — picker-mode Google Maps with fixed-center marker.
 *
 * v2.31.94 custom-stop-location-picker.
 *
 * UX pattern:
 *   - Marker = CSS overlay `<div>` pinned to map container center (NOT
 *     AdvancedMarkerElement, which would move with the map and defeat the
 *     pick-by-pan interaction)
 *   - Explicit drag/arrow gesture → `idle` publishes map.getCenter(); initial
 *     idle and programmatic camera movements never select a coordinate.
 *   - Keyboard a11y: arrow keys nudge map via panBy with step ~10 m at current zoom
 *   - Container focused with tabIndex; aria-live updates on coord change
 *
 * Distinct from TpMap by intent: TpMap renders read-only trip markers via
 * AdvancedMarkerElement + polylines. This component owns picker-mode concerns
 * (one marker that doesn't move, plus center-extraction).
 */
import { useEffect, useRef, useState } from 'react';
import { useGoogleMap } from '../../hooks/useGoogleMap';
import {
  computeArrowKeyStepPixels,
  isValidCoord,
  type Coord,
} from '../../lib/locationPicker';

export interface LocationPickerMapProps {
  initialCenter: Coord;
  initialZoom?: number;
  /** null while an explicit map gesture is selecting a new position. */
  onCoordChange: (coord: Coord | null) => void;
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
  const [currentCoord, setCurrentCoord] = useState<Coord | null>(null);
  const userPicking = useRef(false);

  // Wire idle listener once map is ready
  useEffect(() => {
    if (!map) return;
    const drag = map.addListener('dragstart', () => { userPicking.current = true; setCurrentCoord(null); onCoordChange(null); });
    const listener = map.addListener('idle', () => {
      if (!userPicking.current) return;
      userPicking.current = false;
      const c = map.getCenter();
      if (!c) return;
      const next: Coord = { lat: c.lat(), lng: c.lng() };
      if (!isValidCoord(next)) return;
      setCurrentCoord(next);
      onCoordChange(next);
    });
    return () => { listener.remove(); drag.remove(); };
  }, [map, onCoordChange]);

  // Imperative flyTo from typeahead pick
  useEffect(() => {
    userPicking.current = false;
    if (!flyToSignal) { setCurrentCoord(null); return; }
    if (!isValidCoord(flyToSignal.coord)) return;
    userPicking.current = false;
    setCurrentCoord(flyToSignal.coord);
    flyTo(flyToSignal.coord, flyToSignal.zoom ?? initialZoom);
  }, [flyToSignal, flyTo, initialZoom]);

  // Arrow-key keyboard a11y
  function handleKeyDown(ev: React.KeyboardEvent<HTMLDivElement>) {
    if (!map || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
    userPicking.current = true;
    onCoordChange(null);
    const zoom = map.getZoom() ?? initialZoom;
    const lat = map.getCenter()?.lat() ?? initialCenter.lat;
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
        地圖暫時無法使用。可在上方選擇 Google 地址候選來設定位置；若地址也無法確認，請保留內容稍後重試。
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
        aria-label={`拖曳或使用方向鍵選擇景點位置，${currentCoord ? `緯度 ${currentCoord.lat.toFixed(4)}，經度 ${currentCoord.lng.toFixed(4)}` : '尚未選擇位置'}`}
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
        {currentCoord ? `緯度 ${currentCoord.lat.toFixed(4)}，經度 ${currentCoord.lng.toFixed(4)}` : '尚未選擇位置'}
      </div>
    </div>
  );
}
