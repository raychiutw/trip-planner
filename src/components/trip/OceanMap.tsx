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

import { memo, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import Supercluster from 'supercluster';
import { useLeafletMap } from '../../hooks/useLeafletMap';
import { useRoute, type Coord } from '../../hooks/useRoute';
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
  onMarkerClick?: (pinId: number) => void;
  dark?: boolean;
  className?: string;
  style?: React.CSSProperties;
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
  font-family: inherit;
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
  background: var(--color-background, #fff);
  border: 1.5px solid var(--color-lineStrong, #C1C1C1);
  color: var(--color-muted, #6A6A6A);
  width: 28px; height: 28px; font-size: 12px;
  line-height: 1;
}
.ocean-map-pin[data-state="active"] {
  width: 36px; height: 36px; font-size: 13px;
  background: var(--color-accent, #0077B6);
  border-color: #fff;
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 119, 182, 0.30);
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
  background: var(--color-accent-bg, #CAF0F8);
  border: 1.5px solid var(--color-accent, #0077B6);
  color: var(--color-foreground, #222);
  font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums;
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
.ocean-map-container .leaflet-control-attribution {
  font-size: 9px;
  background: rgba(255,255,255,0.85);
}
`;

/* ===== Single polyline component (per segment, lazy via useRoute) ===== */

interface SegmentProps {
  map: L.Map | null;
  from: Coord;
  to: Coord;
  isActive: boolean;
}

const Segment = memo(function Segment({ map, from, to, isActive }: SegmentProps) {
  const route = useRoute(from, to);
  const lineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!map || !route) return;
    const line = L.polyline(route.polyline, {
      color: isActive ? 'var(--color-accent, #0077B6)' : '#94A3B8',
      weight: isActive ? 4 : 3,
      opacity: isActive ? 0.85 : 0.6,
      dashArray: route.approx ? '6,6' : undefined,
      interactive: false,
    }).addTo(map);
    lineRef.current = line;
    return () => {
      if (lineRef.current) {
        lineRef.current.remove();
        lineRef.current = null;
      }
    };
  }, [map, route, isActive]);

  return null;
});

/* ===== Main component ===== */

const OceanMap = memo(function OceanMap({
  pins,
  mode,
  focusId,
  routes,
  cluster,
  onMarkerClick,
  dark = false,
  className,
  style,
}: OceanMapProps) {
  const showRoutes = routes ?? (mode === 'overview');
  const autoCluster = cluster ?? (mode === 'overview' && pins.length > 10);

  const { containerRef, map, fitBounds, flyTo } = useLeafletMap({
    zoomControl: mode === 'overview',
    dark,
  });

  const visiblePins = useMemo(() => {
    if (mode === 'detail' && focusId !== undefined) {
      return pins.filter((p) => p.id === focusId);
    }
    return pins;
  }, [pins, mode, focusId]);

  const focusedIdx = useMemo(() => {
    if (focusId === undefined) return -1;
    return pins.findIndex((p) => p.id === focusId);
  }, [pins, focusId]);

  /* --- Markers --- */
  useEffect(() => {
    if (!map) return;
    const layer = L.layerGroup().addTo(map);

    if (!autoCluster) {
      for (const pin of visiblePins) {
        const isFocused = pin.id === focusId;
        const isPast = focusedIdx >= 0 && pins.findIndex((p) => p.id === pin.id) < focusedIdx;
        const icon = markerIcon(pin, isFocused, isPast);
        const marker = L.marker([pin.lat, pin.lng], { icon, keyboard: true, alt: `第 ${pin.index} 站：${pin.title}` });
        if (onMarkerClick) {
          marker.on('click', () => onMarkerClick(pin.id));
        }
        marker.addTo(layer);
      }
    } else {
      const sc = new Supercluster({ radius: 60, maxZoom: 15 });
      sc.load(
        visiblePins.map((pin) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [pin.lng, pin.lat] as [number, number] },
          properties: { pin },
        })),
      );
      const refresh = () => {
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
          const props = c.properties as { cluster?: boolean; point_count?: number; pin?: MapPin };
          if (props.cluster) {
            const count = props.point_count ?? 0;
            L.marker([lat, lng], { icon: clusterIcon(count), keyboard: false }).addTo(layer);
          } else if (props.pin) {
            const pin = props.pin;
            const isFocused = pin.id === focusId;
            const isPast = focusedIdx >= 0 && pins.findIndex((p) => p.id === pin.id) < focusedIdx;
            const m = L.marker([pin.lat, pin.lng], {
              icon: markerIcon(pin, isFocused, isPast),
              keyboard: true,
              alt: `第 ${pin.index} 站：${pin.title}`,
            });
            if (onMarkerClick) m.on('click', () => onMarkerClick(pin.id));
            m.addTo(layer);
          }
        }
      };
      refresh();
      map.on('moveend zoomend', refresh);
      return () => {
        map.off('moveend zoomend', refresh);
        layer.remove();
      };
    }

    return () => {
      layer.remove();
    };
  }, [map, visiblePins, pins, focusId, focusedIdx, onMarkerClick, autoCluster]);

  /* --- Viewport fit / focus follow --- */
  useEffect(() => {
    if (!map) return;
    if (mode === 'detail' && visiblePins[0]) {
      map.setView([visiblePins[0].lat, visiblePins[0].lng], 15);
      return;
    }
    if (focusId !== undefined) {
      const pin = pins.find((p) => p.id === focusId);
      if (pin) {
        flyTo([pin.lat, pin.lng], map.getZoom() < 12 ? 13 : undefined);
        return;
      }
    }
    const latlngs = visiblePins.map((p) => [p.lat, p.lng] as L.LatLngExpression);
    fitBounds(latlngs);
  }, [map, mode, focusId, pins, visiblePins, fitBounds, flyTo]);

  /* --- Resize on container changes (Suspense / mode toggle) --- */
  useEffect(() => {
    if (!map) return;
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(t);
  }, [map, mode]);

  /* --- Segments (polylines) --- */
  const segments = useMemo(() => {
    if (!showRoutes || pins.length < 2) return [];
    const pairs: Array<{ from: Coord; to: Coord; isActive: boolean; key: string }> = [];
    for (let i = 0; i < pins.length - 1; i++) {
      const a = pins[i]!;
      const b = pins[i + 1]!;
      pairs.push({
        from: { lat: a.lat, lng: a.lng },
        to: { lat: b.lat, lng: b.lng },
        isActive: focusedIdx === i || focusedIdx === i + 1,
        key: `${a.id}->${b.id}`,
      });
    }
    return pairs;
  }, [pins, showRoutes, focusedIdx]);

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div
        ref={containerRef}
        className={className ? `ocean-map-container ${className}` : 'ocean-map-container'}
        data-mode={mode}
        style={style}
        role="application"
        aria-label={mode === 'detail' ? '地圖：單點景點' : '地圖：行程景點總覽'}
      />
      {segments.map((s) => (
        <Segment key={s.key} map={map} from={s.from} to={s.to} isActive={s.isActive} />
      ))}
    </>
  );
});

export default OceanMap;
