/**
 * TpMap — Google Maps JS map component (v2.23.0 google-maps-migration).
 *
 * Replaces Leaflet+OSM with Google Maps Platform. Same prop surface as
 * Leaflet version — caller pages/imports unchanged.
 *
 * One component serves both entry points:
 *   - mode='detail'   → single focus pin, 280px tall
 *   - mode='overview' → all pins + polyline (no clustering)
 *
 * Numbered accent-color pin (matches rail dot). Polylines fetch via
 * /api/route proxy (Google Routes). On any Google failure → 503 from
 * server (no Haversine fallback per P11/T13); useRoute returns null.
 *
 *  pins[] ─┬─► google.maps.marker.AdvancedMarkerElement (content div) ─► map
 *          └─► useRoute(a,b) per segment ─► google.maps.Polyline ─► map
 *
 * v2.31.75: 從 google.maps.Marker (deprecated 2024-02) 遷移到
 * AdvancedMarkerElement。Symbol path 改用 inline HTMLDivElement + CSS。
 */

import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useGoogleMap } from '../../hooks/useGoogleMap';
import { useRoute } from '../../hooks/useRoute';
import { useMapMarkers } from '../../hooks/useMapMarkers';
import { useMapViewport } from '../../hooks/useMapViewport';
import { useMapSegments } from '../../hooks/useMapSegments';
import { dayColor } from '../../lib/dayPalette';
import {
  markerStyle,
  markerContent,
  segmentStyle,
  buildSegments,
  type MarkerStyle,
  type SegmentPair,
} from '../../lib/mapHelpers';
import type { MapPin, Coord } from '../../lib/mapTypes';
import MapSkeleton from './MapSkeleton';
import PageErrorState from '../shared/PageErrorState';

// Re-export for callers that still import from TpMap (backward compat)
export { markerStyle, markerContent, buildSegments };
export type { MarkerStyle, SegmentPair };

/** Module-level constant styles — avoid recreating object literals each render. */
const MAP_OVERLAY_STYLE = { position: 'absolute', inset: 0 } as const;

/* ===== Props ===== */

export type TpMapMode = 'detail' | 'overview';

export interface TpMapProps {
  pins: MapPin[];
  mode: TpMapMode;
  /** In overview mode, focused pin gets the accent-active state. In detail mode, this is the single pin to show. */
  focusId?: number;
  /** Draw polylines between consecutive pins (default true in overview, false in detail) */
  routes?: boolean;
  /** Fill parent container instead of using mode-default fixed heights (for fullscreen pages like /map) */
  fillParent?: boolean;
  onMarkerClick?: (pinId: number) => void;
  dark?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** When provided, draw polyline segments PER DAY using dayColor(N). Cross-day segments NOT drawn. */
  pinsByDay?: Map<number, MapPin[]>;
  /** Apply dayColor(dayNum) to flat polylines (single-day mode). Ignored when pinsByDay is set. */
  dayNum?: number;
  /** Imperative soft pan — panTo this coord. zoom optional：給就 flyTo(lat/lng, zoom)，
   *  沒給就 panTo（不變 zoom）。v2.31.87：TimelineRail 點 stop 展開 → zoom=15，
   *  收合 → zoom=11（trip overview level）。 */
  panToCoord?: { lat: number; lng: number; zoom?: number };
  /** When true, fitBounds runs once on mount then preserves user drag/pan. */
  fitOnce?: boolean;
  /** Imperative google.maps.Map handle for parent — used by /map page MapFabs / 全覽 / 我的位置.
   *  Called once on mount and on cleanup with null. */
  onMapReady?: (map: google.maps.Map | null) => void;
  /** Override Google zoom control position (default 'TOP_LEFT'). */
  zoomControlPosition?: 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT';
}

/* ===== Inline styles (scoped to this component) ===== */

const SCOPED_STYLES = `
.tp-map-container {
  width: 100%;
  border-radius: var(--radius-md, 8px);
  overflow: hidden;
  border: 1px solid var(--color-border, #EBEBEB);
  position: relative;
}
.tp-map-container[data-mode="detail"] { height: 280px; }
.tp-map-container[data-mode="overview"] { height: 420px; }
.tp-map-container[data-fill-parent="true"] {
  height: 100%;
  min-height: 0;
  border-radius: 0;
}
`;

/* ===== Single polyline component (per segment, lazy via useRoute) ===== */

interface SegmentProps {
  map: google.maps.Map | null;
  from: Coord;
  to: Coord;
  isActive: boolean;
  /** If provided, polyline uses dayPolylineStyle(dayNum) for color + dashArray (color-blind aid). */
  dayNum?: number;
}

const Segment = memo(function Segment({ map, from, to, isActive, dayNum }: SegmentProps) {
  const route = useRoute(from, to);
  const lineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || !route) return;
    const path = route.polyline.map(([lat, lng]) => ({ lat, lng }));
    const style = segmentStyle(isActive, false, dayNum);
    const line = new google.maps.Polyline({
      path,
      map,
      ...style,
      clickable: false,
    });
    lineRef.current = line;
    return () => {
      line.setMap(null);
      if (lineRef.current === line) lineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, route]);

  // Active/idle style update without rebuilding the polyline
  useEffect(() => {
    const line = lineRef.current;
    if (!line || !route) return;
    const style = segmentStyle(isActive, false, dayNum);
    line.setOptions({
      strokeColor: style.strokeColor,
      strokeOpacity: style.strokeOpacity,
      strokeWeight: style.strokeWeight,
      icons: style.icons,
    });
  }, [isActive, route, dayNum]);

  return null;
});

/* ===== Main component ===== */

const TpMap = memo(function TpMap({
  pins,
  mode,
  focusId,
  routes,
  fillParent = false,
  onMarkerClick,
  dark: _dark = false, // unused with Google Maps（mapTypeId 'roadmap' 顏色固定）
  className,
  style,
  pinsByDay,
  dayNum,
  panToCoord,
  fitOnce = false,
  onMapReady,
  zoomControlPosition,
}: TpMapProps) {
  const showRoutes = routes ?? (mode === 'overview');

  const { containerRef, map, loadError, fitBounds, flyTo } = useGoogleMap({
    zoomControl: mode === 'overview',
    zoomControlPosition,
  });

  // Expose google.maps.Map handle to parent (one-shot when ready, null on cleanup).
  useEffect(() => {
    if (!onMapReady) return;
    onMapReady(map);
    return () => onMapReady(null);
  }, [map, onMapReady]);

  const visiblePins = useMemo(() => {
    if (mode === 'detail' && focusId !== undefined) {
      return pins.filter((p) => p.id === focusId);
    }
    return pins;
  }, [pins, mode, focusId]);

  const pinIndexById = useMemo(() => {
    const m = new Map<number, number>();
    for (let i = 0; i < pins.length; i++) m.set(pins[i]!.id, i);
    return m;
  }, [pins]);

  const focusedIdx = useMemo(() => {
    if (focusId === undefined) return -1;
    return pinIndexById.get(focusId) ?? -1;
  }, [pinIndexById, focusId]);

  const visiblePinsById = useMemo(() => {
    const m = new Map<number, MapPin>();
    for (const p of visiblePins) m.set(p.id, p);
    return m;
  }, [visiblePins]);

  const isPastPin = useCallback(
    (pinId: number) => focusedIdx >= 0 && (pinIndexById.get(pinId) ?? -1) < focusedIdx,
    [focusedIdx, pinIndexById],
  );

  const pinIdToDayColor = useMemo(() => {
    const m = new Map<number, string>();
    if (pinsByDay && pinsByDay.size > 0) {
      for (const [day, dayPins] of pinsByDay) {
        const color = dayColor(day);
        for (const pin of dayPins) m.set(pin.id, color);
      }
    } else if (dayNum !== undefined) {
      const color = dayColor(dayNum);
      for (const pin of pins) m.set(pin.id, color);
    }
    return m;
  }, [pinsByDay, dayNum, pins]);

  /* --- 3 hook composition (order matches original line 220 → 299 → 343) --- */

  useMapMarkers({
    map,
    visiblePins,
    visiblePinsById,
    pinIndexById,
    focusId,
    focusedIdx,
    isPastPin,
    pinIdToDayColor,
    onMarkerClick,
  });

  useMapViewport({
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
  });

  const segments = useMapSegments({
    pins,
    pinsByDay,
    showRoutes,
    focusedIdx,
    pinIndexById,
    dayNum,
  });

  // Loading + error overlay (Google Maps JS bundle ~300-500KB)
  const showSkeleton = !map && !loadError;
  const showError = loadError !== null;

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div
        className={className ? `tp-map-container ${className}` : 'tp-map-container'}
        data-mode={mode}
        data-fill-parent={fillParent ? 'true' : undefined}
        style={style}
      >
        <div
          ref={containerRef}
          style={{ width: '100%', height: '100%', visibility: map ? 'visible' : 'hidden' }}
          role="application"
          aria-label={mode === 'detail' ? '地圖：單點景點' : '地圖：行程景點總覽'}
        />
        {showSkeleton && (
          <div style={MAP_OVERLAY_STYLE}>
            <MapSkeleton />
          </div>
        )}
        {showError && (
          <div style={MAP_OVERLAY_STYLE}>
            <PageErrorState
              title="地圖暫停服務"
              message={
                loadError?.message?.includes('quota') || loadError?.message?.includes('LOCKED')
                  ? '本月 Google 地圖已達配額，月初恢復；行程其他功能不受影響。'
                  : loadError?.message?.includes('授權')
                    ? '此環境未授權載入地圖，地圖暫停服務；行程其他功能正常可用。'
                    : '地圖載入失敗，請稍後再試；行程其他功能不受影響。'
              }
              onRetry={() => window.location.reload()}
              className="tp-page-error"
            />
          </div>
        )}
      </div>
      {segments.map((s) => (
        <Segment key={s.key} map={map} from={s.from} to={s.to} isActive={s.isActive} dayNum={s.dayNum} />
      ))}
    </>
  );
});

export default TpMap;
