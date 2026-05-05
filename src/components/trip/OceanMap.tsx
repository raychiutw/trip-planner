/**
 * OceanMap — Google Maps JS map component (v2.23.0 google-maps-migration).
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
 *  pins[] ─┬─► google.maps.Marker (label + icon) ──────► map
 *          └─► useRoute(a,b) per segment ─► google.maps.Polyline ─► map
 */

import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useGoogleMap } from '../../hooks/useGoogleMap';
import { useRoute, type Coord } from '../../hooks/useRoute';
import { dayColor, dayPolylineStyle } from '../../lib/dayPalette';
import type { MapPin } from '../../hooks/useMapData';
import MapSkeleton from './MapSkeleton';
import PageErrorState from '../shared/PageErrorState';

/* ===== Props ===== */

export type OceanMapMode = 'detail' | 'overview';

export interface OceanMapProps {
  pins: MapPin[];
  mode: OceanMapMode;
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
  /** Imperative soft pan — panTo this coord without changing zoom. Used by TripMapRail scroll spy. */
  panToCoord?: { lat: number; lng: number };
  /** When true, fitBounds runs once on mount then preserves user drag/pan. */
  fitOnce?: boolean;
  /** Imperative google.maps.Map handle for parent — used by /map page MapFabs / 全覽 / 我的位置.
   *  Called once on mount and on cleanup with null. */
  onMapReady?: (map: google.maps.Map | null) => void;
  /** Override Google zoom control position (default 'TOP_LEFT'). */
  zoomControlPosition?: 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT';
}

/* ===== Marker icon construction (Google Maps Symbol path + label) ===== */

const ACCENT_COLOR = '#D97848';
const ACCENT_FG = '#FFFFFF';
const IDLE_BG = '#FFFFFF';
const IDLE_BORDER = '#C1C1C1';
const IDLE_FG = '#6A6A6A';
const PAST_BORDER = '#E0E0E0';
const PAST_FG = '#C1C1C1';

/**
 * markerIcon — build google.maps.Marker icon + label options.
 * dayColor 套 idle marker；active 用 accent；past 用 muted。Exported for unit tests.
 */
type MarkerState = 'focused' | 'past' | 'idle';

const STATE_COLORS: Record<MarkerState, { fill: string; stroke: string; text: string }> = {
  focused: { fill: ACCENT_COLOR, stroke: ACCENT_FG, text: ACCENT_FG },
  past:    { fill: IDLE_BG,      stroke: PAST_BORDER, text: PAST_FG },
  idle:    { fill: IDLE_BG,      stroke: IDLE_BORDER, text: IDLE_FG },
};

export function markerIcon(
  pin: MapPin,
  isFocused: boolean,
  isPast: boolean,
  dayCol?: string,
): {
  icon: google.maps.Symbol;
  label: google.maps.MarkerLabel;
  zIndex?: number;
} {
  const state: MarkerState = isFocused ? 'focused' : isPast ? 'past' : 'idle';
  const base = STATE_COLORS[state];
  // dayCol overrides idle stroke + text only — focused/past keep their tokens.
  const stroke = state === 'idle' && dayCol ? dayCol : base.stroke;
  const text = state === 'idle' && dayCol ? dayCol : base.text;

  return {
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: isFocused ? 18 : 14,
      fillColor: base.fill,
      fillOpacity: 1,
      strokeColor: stroke,
      strokeWeight: isFocused ? 2 : 1.5,
    },
    label: {
      text: String(pin.index),
      color: text,
      fontSize: isFocused ? '13px' : '12px',
      fontWeight: '700',
      fontFamily: 'Inter, sans-serif',
    },
    zIndex: isFocused ? 1000 : undefined,
  };
}

/* ===== Inline styles (scoped to this component) ===== */

const SCOPED_STYLES = `
.ocean-map-container {
  width: 100%;
  border-radius: var(--radius-md, 8px);
  overflow: hidden;
  border: 1px solid var(--color-border, #EBEBEB);
  position: relative;
}
.ocean-map-container[data-mode="detail"] { height: 280px; }
.ocean-map-container[data-mode="overview"] { height: 420px; }
.ocean-map-container[data-fill-parent="true"] {
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

interface PolylineStyle {
  strokeColor: string;
  strokeOpacity: number;
  strokeWeight: number;
  /** Set to dashed when approx fallback OR even-day (color-blind aid). */
  icons?: google.maps.IconSequence[];
}

/**
 * Build Google Polyline style options matching prior Leaflet style logic.
 * dashArray '6,6' → use IconSequence with line dash icon (Google's idiom).
 */
function segmentStyle(isActive: boolean, approx: boolean, dayNum?: number): PolylineStyle {
  let color: string;
  let weight: number;
  let dashed: boolean;

  if (dayNum !== undefined) {
    const palette = dayPolylineStyle(dayNum);
    color = palette.color;
    weight = isActive ? 4 : palette.weight;
    dashed = approx || palette.dashArray !== undefined;
  } else {
    color = isActive ? ACCENT_COLOR : '#C8B89F';
    weight = isActive ? 4 : 3;
    dashed = approx;
  }

  const style: PolylineStyle = {
    strokeColor: color,
    strokeOpacity: dashed ? 0 : (isActive ? 0.85 : 0.6),
    strokeWeight: weight,
  };

  if (dashed) {
    style.icons = [
      {
        icon: {
          path: 'M 0,-1 0,1',
          strokeOpacity: isActive ? 0.85 : 0.6,
          scale: weight,
        },
        offset: '0',
        repeat: '12px',
      },
    ];
  }

  return style;
}

const Segment = memo(function Segment({ map, from, to, isActive, dayNum }: SegmentProps) {
  const route = useRoute(from, to);
  const lineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || !route) return;
    const path = route.polyline.map(([lat, lng]) => ({ lat, lng }));
    const style = segmentStyle(isActive, route.approx === true, dayNum);
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
    const style = segmentStyle(isActive, route.approx === true, dayNum);
    line.setOptions({
      strokeColor: style.strokeColor,
      strokeOpacity: style.strokeOpacity,
      strokeWeight: style.strokeWeight,
      icons: style.icons,
    });
  }, [isActive, route, dayNum]);

  return null;
});

/* ===== Pure segment-pair builder (exported for unit tests) ===== */

export interface SegmentPair {
  from: Coord;
  to: Coord;
  isActive: boolean;
  key: string;
  dayNum?: number;
}

export function buildSegments(params: {
  pins: MapPin[];
  pinsByDay?: Map<number, MapPin[]>;
  focusedIdx: number;
  pinIndexById: Map<number, number>;
  dayNum?: number;
}): SegmentPair[] {
  const { pins, pinsByDay, focusedIdx, pinIndexById, dayNum } = params;
  const pairs: SegmentPair[] = [];

  if (pinsByDay && pinsByDay.size > 0) {
    const sortedDays = [...pinsByDay.keys()].sort((a, b) => a - b);
    for (const d of sortedDays) {
      const dayPins = [...(pinsByDay.get(d) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
      for (let i = 0; i < dayPins.length - 1; i++) {
        const a = dayPins[i]!;
        const b = dayPins[i + 1]!;
        const aIdx = pinIndexById.get(a.id) ?? -1;
        const bIdx = pinIndexById.get(b.id) ?? -1;
        pairs.push({
          from: { lat: a.lat, lng: a.lng },
          to: { lat: b.lat, lng: b.lng },
          isActive: focusedIdx === aIdx || focusedIdx === bIdx,
          key: `${a.id}->${b.id}`,
          dayNum: d,
        });
      }
    }
    return pairs;
  }

  if (pins.length < 2) return [];
  for (let i = 0; i < pins.length - 1; i++) {
    const a = pins[i]!;
    const b = pins[i + 1]!;
    pairs.push({
      from: { lat: a.lat, lng: a.lng },
      to: { lat: b.lat, lng: b.lng },
      isActive: focusedIdx === i || focusedIdx === i + 1,
      key: `${a.id}->${b.id}`,
      dayNum,
    });
  }
  return pairs;
}

/* ===== Main component ===== */

const OceanMap = memo(function OceanMap({
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
}: OceanMapProps) {
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

  /* --- Markers: create once per pin-set, diff-update on focus change --- */
  const markersRef = useRef<Map<number, google.maps.Marker>>(new Map());

  useEffect(() => {
    if (!map) return;
    const markers = new Map<number, google.maps.Marker>();
    const listeners: google.maps.MapsEventListener[] = [];
    for (const pin of visiblePins) {
      const opts = markerIcon(pin, false, false, pinIdToDayColor.get(pin.id));
      const marker = new google.maps.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        map,
        icon: opts.icon,
        label: opts.label,
        title: `第 ${pin.index} 站：${pin.title}`,
      });
      if (onMarkerClick) {
        listeners.push(marker.addListener('click', () => onMarkerClick(pin.id)));
      }
      markers.set(pin.id, marker);
    }
    markersRef.current = markers;
    return () => {
      for (const l of listeners) l.remove();
      for (const m of markers.values()) m.setMap(null);
      if (markersRef.current === markers) markersRef.current = new Map();
    };
  }, [map, visiblePins, onMarkerClick, pinIdToDayColor]);

  // Diff-based focus update.
  const prevFocusRef = useRef<{
    focusId?: number;
    focusedIdx: number;
    markers: Map<number, google.maps.Marker> | null;
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
      const opts = markerIcon(pin, isFocused, isPastPin(pinId), pinIdToDayColor.get(pinId));
      marker.setIcon(opts.icon);
      marker.setLabel(opts.label);
      marker.setZIndex(isFocused ? 1000 : 0);
    }

    prevFocusRef.current = { focusId, focusedIdx, markers };
  }, [map, onMarkerClick, visiblePins, visiblePinsById, focusId, focusedIdx, pinIndexById, isPastPin, pinIdToDayColor]);

  /* --- Viewport fit / focus follow --- */
  const fitDoneRef = useRef(false);
  useEffect(() => {
    if (!map) return;
    if (mode === 'detail' && visiblePins[0]) {
      map.setCenter({ lat: visiblePins[0].lat, lng: visiblePins[0].lng });
      map.setZoom(15);
      return;
    }
    if (focusId !== undefined) {
      const idx = pinIndexById.get(focusId);
      const pin = idx !== undefined ? pins[idx] : undefined;
      if (pin) {
        const z = map.getZoom() ?? 11;
        flyTo({ lat: pin.lat, lng: pin.lng }, z < 12 ? 13 : undefined);
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
    map.panTo({ lat: panToCoord.lat, lng: panToCoord.lng });
  }, [map, panToCoord]);

  /* --- Segments (polylines) --- */
  const segments = useMemo(() => {
    if (!showRoutes) return [];
    return buildSegments({ pins, pinsByDay, focusedIdx, pinIndexById, dayNum });
  }, [pins, showRoutes, focusedIdx, pinsByDay, pinIndexById, dayNum]);

  // Loading + error overlay (Google Maps JS bundle ~300-500KB)
  const showSkeleton = !map && !loadError;
  const showError = loadError !== null;

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div
        className={className ? `ocean-map-container ${className}` : 'ocean-map-container'}
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
          <div style={{ position: 'absolute', inset: 0 }}>
            <MapSkeleton />
          </div>
        )}
        {showError && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <PageErrorState
              title="服務暫停"
              message={loadError?.message?.includes('quota') || loadError?.message?.includes('LOCKED')
                ? '本月 Google API 已達配額，月初恢復。'
                : '地圖載入失敗，請稍後再試。'}
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

export default OceanMap;
