/**
 * OceanMap — Leaflet + OSM map component
 *
 * One component serves both entry points:
 *   - mode='detail'   → single focus pin, 280px tall
 *   - mode='overview' → all pins + polyline + auto cluster when >10 stops
 *
 * Numbered accent-color pin (matches rail dot). Polylines fetch lazily via
 * /api/route proxy (Mapbox), falls back to Haversine straight line on failure.
 *
 *  pins[] ─┬─► L.divIcon numbered marker ─────────► map
 *          └─► useRoute(a,b) per segment ─► L.polyline ─► map
 */

import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import Supercluster from 'supercluster';
import { useLeafletMap } from '../../hooks/useLeafletMap';
import { useRoute, type Coord } from '../../hooks/useRoute';
import { dayPolylineStyle } from '../../lib/dayPalette';
import type { MapPin } from '../../hooks/useMapData';

/* ===== Props ===== */

export type OceanMapMode = 'detail' | 'overview';

export interface OceanMapProps {
  pins: MapPin[];
  mode: OceanMapMode;
  /** In overview mode, focused pin gets the accent-active state. In detail mode, this is the single pin to show. */
  focusId?: number;
  /** Draw polylines between consecutive pins (default true in overview, false in detail) */
  routes?: boolean;
  /** Auto-cluster when overview + pins.length > 10 (override via false to disable) */
  cluster?: boolean;
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
  /** When true, fitBounds runs once on mount then preserves user drag/pan. Used by TripMapRail
      because parent TripPage rebuilds pins inline on every render — without this, every re-render
      would snap the rail back to full-trip bounds and wipe manual map moves + scroll-spy pan. */
  fitOnce?: boolean;
  /** Imperative L.Map handle for parent — used by /map page 全覽/我的位置/zoom 控制。
   *  Called once on mount and on cleanup with null。Parent should ref-store, not state-store. */
  onMapReady?: (map: L.Map | null) => void;
  /** Override Leaflet zoom control position (default 'topleft')。/map 用 'bottomright'
   *  避免跟左上 trip-switcher overlap。 */
  zoomControlPosition?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
}

/* ===== Marker construction ===== */

function markerIcon(pin: MapPin, isFocused: boolean, isPast: boolean): L.DivIcon {
  const label = pin.type === 'hotel' ? '🛏' : String(pin.index);
  const state = isFocused ? 'active' : isPast ? 'past' : 'idle';
  return L.divIcon({
    className: 'ocean-map-pin-wrap',
    html: `<span class="ocean-map-pin" data-state="${state}" data-type="${pin.type}">${label}</span>`,
    iconSize: [isFocused ? 36 : 28, isFocused ? 36 : 28],
    iconAnchor: [isFocused ? 18 : 14, isFocused ? 18 : 14],
  });
}

function clusterIcon(count: number): L.DivIcon {
  return L.divIcon({
    className: 'ocean-map-pin-wrap',
    html: `<span class="ocean-map-cluster">${count}</span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

/* ===== Inline styles (scoped to this component) ===== */

const SCOPED_STYLES = `
.ocean-map-pin-wrap { background: transparent !important; border: none !important; }
.ocean-map-pin {
  display: grid; place-items: center;
  border-radius: 50%;
  font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em;
  /* Explicit Inter stack — inherit from .leaflet-container falls back to Helvetica Neue */
  font-family: var(--font-family-system, 'Inter', sans-serif);
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
  background: var(--color-background, #fff);
  border: 1.5px solid var(--color-lineStrong, #C1C1C1);
  color: var(--color-muted, #6A6A6A);
  width: 28px; height: 28px; font-size: 12px;
  line-height: 1;
}
.ocean-map-pin[data-state="active"] {
  width: 36px; height: 36px; font-size: 13px;
  background: var(--color-accent, #D97848);
  border-color: #fff;
  color: #fff;
  box-shadow: 0 4px 12px rgba(217, 120, 72, 0.30);
}
.ocean-map-pin[data-state="past"] {
  border-color: #E0E0E0;
  color: #C1C1C1;
}
.ocean-map-pin[data-type="hotel"] { font-size: 14px; }
.ocean-map-cluster {
  display: grid; place-items: center;
  width: 40px; height: 40px;
  border-radius: 50%;
  background: var(--color-accent-bg, #F7DFCB);
  border: 1.5px solid var(--color-accent, #D97848);
  color: var(--color-foreground, #222);
  font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums;
  font-family: var(--font-family-system, 'Inter', sans-serif);
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
}
.ocean-map-container {
  width: 100%;
  border-radius: var(--radius-md, 8px);
  overflow: hidden;
  border: 1px solid var(--color-border, #EBEBEB);
}
.ocean-map-container[data-mode="detail"] { height: 280px; }
.ocean-map-container[data-mode="overview"] { height: 420px; }
.ocean-map-container[data-fill-parent="true"] {
  height: 100%;
  min-height: 0;
  border-radius: 0;
}
.ocean-map-container .leaflet-control-attribution {
  font-size: 9px;
  background: rgba(255,255,255,0.85);
}
/* Override Leaflet default Lucida Console on +/- zoom controls */
.ocean-map-container .leaflet-bar a,
.ocean-map-container .leaflet-control-attribution {
  font-family: var(--font-family-system, 'Inter', sans-serif);
}
`;

/* ===== Single polyline component (per segment, lazy via useRoute) ===== */

interface SegmentProps {
  map: L.Map | null;
  from: Coord;
  to: Coord;
  isActive: boolean;
  /** If provided, polyline uses dayPolylineStyle(dayNum) for color + dashArray (color-blind aid). */
  dayNum?: number;
}

function segmentStyle(isActive: boolean, approx: boolean, dayNum?: number): L.PolylineOptions {
  if (dayNum !== undefined) {
    // Day palette mode: dayColor + dashArray (odd=solid, even=dashed) for color-blind aid.
    // approx fallback overrides dashArray for visual distinction.
    const palette = dayPolylineStyle(dayNum);
    return {
      color: palette.color,
      weight: isActive ? 4 : palette.weight,
      opacity: isActive ? 0.85 : 0.6,
      dashArray: approx ? '6,6' : palette.dashArray,
      interactive: false,
    };
  }
  // Default (no dayNum): accent for active, muted grey for idle.
  return {
    color: isActive ? 'var(--color-accent, #D97848)' : '#94A3B8',
    weight: isActive ? 4 : 3,
    opacity: isActive ? 0.85 : 0.6,
    dashArray: approx ? '6,6' : undefined,
    interactive: false,
  };
}

const Segment = memo(function Segment({ map, from, to, isActive, dayNum }: SegmentProps) {
  const route = useRoute(from, to);
  const lineRef = useRef<L.Polyline | null>(null);

  // Create polyline once per route (re-fetched polyline = new line)
  useEffect(() => {
    if (!map || !route) return;
    const line = L.polyline(route.polyline, segmentStyle(isActive, route.approx === true, dayNum)).addTo(map);
    lineRef.current = line;
    return () => {
      line.remove();
      if (lineRef.current === line) lineRef.current = null;
    };
    // isActive / dayNum handled by the style-update effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, route]);

  // Active/idle style update without rebuilding the polyline
  useEffect(() => {
    const line = lineRef.current;
    if (!line || !route) return;
    line.setStyle(segmentStyle(isActive, route.approx === true, dayNum));
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

/**
 * Build consecutive polyline pairs from pins.
 *
 * - pinsByDay mode: per-day polyline, cross-day segments NOT drawn. Hotel
 *   pins ARE included as the day's start point (sortOrder=-1) per
 *   DESIGN.md「地圖 Polyline 規格」— skipping the hotel left the first
 *   entry visually orphaned.
 * - Flat pins mode: connects every consecutive pair.
 */
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
      // Sort by sortOrder so hotel (-1) leads the chain naturally.
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
  cluster,
  fillParent = false,
  onMarkerClick,
  dark = false,
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
  const autoCluster = cluster ?? (mode === 'overview' && pins.length > 10);

  const { containerRef, map, fitBounds, flyTo } = useLeafletMap({
    zoomControl: mode === 'overview',
    zoomControlPosition,
    dark,
  });

  // Expose L.Map handle to parent (one-shot when ready, null on cleanup).
  // 給 GlobalMapPage 的「全覽 / 我的位置」pill button 用。
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

  /** True when pinId sits before the currently focused pin in tour order. */
  const isPastPin = useCallback(
    (pinId: number) => focusedIdx >= 0 && (pinIndexById.get(pinId) ?? -1) < focusedIdx,
    [focusedIdx, pinIndexById],
  );

  /* --- Markers (non-cluster): create once per pin-set, diff-update on focus change --- */
  const markersRef = useRef<Map<number, L.Marker>>(new Map());

  useEffect(() => {
    if (!map || autoCluster) return;
    const layer = L.layerGroup().addTo(map);
    const markers = new Map<number, L.Marker>();
    for (const pin of visiblePins) {
      const marker = L.marker([pin.lat, pin.lng], {
        icon: markerIcon(pin, false, false),
        keyboard: true,
        alt: `第 ${pin.index} 站：${pin.title}`,
      });
      if (onMarkerClick) marker.on('click', () => onMarkerClick(pin.id));
      marker.addTo(layer);
      markers.set(pin.id, marker);
    }
    markersRef.current = markers;
    return () => {
      layer.remove();
      // Only clear ref if it still points to OUR map — avoids clobbering a newer
      // map set by a re-mount (Strict Mode) before this cleanup runs.
      if (markersRef.current === markers) markersRef.current = new Map();
    };
  }, [map, visiblePins, autoCluster, onMarkerClick]);

  // Diff-based focus update: compute which pins' icon state actually changed
  // (prev focused, new focused, past-boundary crossing) and only setIcon on those.
  // Full-update fallback when markers were just rebuilt (different Map identity).
  const prevFocusRef = useRef<{
    focusId?: number;
    focusedIdx: number;
    markers: Map<number, L.Marker> | null;
  }>({ focusedIdx: -1, markers: null });

  useEffect(() => {
    if (autoCluster) return;
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
      marker.setIcon(markerIcon(pin, pinId === focusId, isPastPin(pinId)));
    }

    prevFocusRef.current = { focusId, focusedIdx, markers };
  }, [map, onMarkerClick, visiblePins, visiblePinsById, focusId, focusedIdx, pinIndexById, autoCluster, isPastPin]);

  /* --- Markers (cluster path): create Supercluster once, refresh on focus or viewport --- */
  // Latest focus state for cluster refresh closure (avoids rebuilding SC index on focus change).
  // Assigned in an effect, not during render, to keep the component render-pure.
  const focusStateRef = useRef({ focusId, focusedIdx, isPastPin });
  useEffect(() => {
    focusStateRef.current = { focusId, focusedIdx, isPastPin };
  });
  const clusterRefreshRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!map || !autoCluster) return;
    const layer = L.layerGroup().addTo(map);
    const sc = new Supercluster({ radius: 60, maxZoom: 15 });
    sc.load(
      visiblePins.map((pin) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [pin.lng, pin.lat] as [number, number] },
        properties: { pin },
      })),
    );
    const refresh = () => {
      const { focusId: curFocus, isPastPin: curIsPast } = focusStateRef.current;
      layer.clearLayers();
      const bounds = map.getBounds();
      const bbox: [number, number, number, number] = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ];
      const zoom = Math.floor(map.getZoom());
      const clusters = sc.getClusters(bbox, zoom);
      for (const c of clusters) {
        const [lng, lat] = c.geometry.coordinates as [number, number];
        const props = c.properties as { cluster?: boolean; cluster_id?: number; point_count?: number; pin?: MapPin };
        if (props.cluster) {
          const count = props.point_count ?? 0;
          const clusterId = props.cluster_id;
          // 點 cluster → zoom 到 supercluster 計算的 expansion zoom，使其展開成個別
          // 子 cluster / pin。沒 expansion zoom（已經在 maxZoom）就 +2 級當保險。
          const m = L.marker([lat, lng], { icon: clusterIcon(count), keyboard: true });
          m.on('click', () => {
            const target =
              clusterId != null
                ? Math.min(sc.getClusterExpansionZoom(clusterId), 18)
                : Math.min(map.getZoom() + 2, 18);
            map.setView([lat, lng], target, { animate: true });
          });
          m.addTo(layer);
        } else if (props.pin) {
          const pin = props.pin;
          const m = L.marker([pin.lat, pin.lng], {
            icon: markerIcon(pin, pin.id === curFocus, curIsPast(pin.id)),
            keyboard: true,
            alt: `第 ${pin.index} 站：${pin.title}`,
          });
          if (onMarkerClick) m.on('click', () => onMarkerClick(pin.id));
          m.addTo(layer);
        }
      }
    };
    clusterRefreshRef.current = refresh;
    refresh();
    map.on('moveend zoomend', refresh);
    return () => {
      map.off('moveend zoomend', refresh);
      layer.remove();
      clusterRefreshRef.current = null;
    };
  }, [map, visiblePins, autoCluster, onMarkerClick]);

  // Re-render cluster markers when focus changes — no SC index rebuild.
  useEffect(() => {
    if (!autoCluster) return;
    clusterRefreshRef.current?.();
  }, [autoCluster, focusId, focusedIdx]);

  /* --- Viewport fit / focus follow --- */
  const fitDoneRef = useRef(false);
  useEffect(() => {
    if (!map) return;
    if (mode === 'detail' && visiblePins[0]) {
      map.setView([visiblePins[0].lat, visiblePins[0].lng], 15);
      return;
    }
    if (focusId !== undefined) {
      const idx = pinIndexById.get(focusId);
      const pin = idx !== undefined ? pins[idx] : undefined;
      if (pin) {
        flyTo([pin.lat, pin.lng], map.getZoom() < 12 ? 13 : undefined);
        return;
      }
    }
    // fitOnce: after the first fit, don't re-fit on parent re-renders (would wipe user drag)
    if (fitOnce && fitDoneRef.current) return;
    const latlngs = visiblePins.map((p) => [p.lat, p.lng] as L.LatLngExpression);
    fitBounds(latlngs);
    fitDoneRef.current = true;
  }, [map, mode, focusId, pins, pinIndexById, visiblePins, fitBounds, flyTo, fitOnce]);

  /* --- Resize on container changes (Suspense / mode toggle) --- */
  useEffect(() => {
    if (!map) return;
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(t);
  }, [map, mode]);

  /* --- Imperative soft pan (used by TripMapRail scroll spy to pan per-day without zooming) --- */
  useEffect(() => {
    if (!map || !panToCoord) return;
    map.panTo([panToCoord.lat, panToCoord.lng]);
  }, [map, panToCoord]);

  /* --- Segments (polylines) --- */
  const segments = useMemo(() => {
    if (!showRoutes) return [];
    return buildSegments({ pins, pinsByDay, focusedIdx, pinIndexById, dayNum });
  }, [pins, showRoutes, focusedIdx, pinsByDay, pinIndexById, dayNum]);

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div
        ref={containerRef}
        className={className ? `ocean-map-container ${className}` : 'ocean-map-container'}
        data-mode={mode}
        data-fill-parent={fillParent ? 'true' : undefined}
        style={style}
        role="application"
        aria-label={mode === 'detail' ? '地圖：單點景點' : '地圖：行程景點總覽'}
      />
      {segments.map((s) => (
        <Segment key={s.key} map={map} from={s.from} to={s.to} isActive={s.isActive} dayNum={s.dayNum} />
      ))}
    </>
  );
});

export default OceanMap;
