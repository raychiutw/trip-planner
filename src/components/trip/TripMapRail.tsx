/**
 * TripMapRail — sticky right-column map for desktop ≥1024px (PR3, Item 3).
 *
 * Layout:
 *   position: sticky; top: var(--spacing-nav-h); height: calc(100dvh - var(--spacing-nav-h))
 *
 * Behaviour:
 *   - Only renders on ≥1024px (via useMediaQuery) — returns null on smaller screens
 *   - Shows all trip pins from all days
 *   - Each day's pins connected by a polyline in dayColor(N)
 *   - Clicking a pin navigates to /trip/:tripId/stop/:entryId
 *   - fitBounds on mount; user drag state preserved after that
 *   - No clustering (this is always full trip overview)
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useLeafletMap } from '../../hooks/useLeafletMap';
import { dayColor, dayPolylineStyle } from '../../lib/dayPalette';
import type { MapPin } from '../../hooks/useMapData';

/* ===== Singleton style injection ===== */
function ensureStyle(): void {
  if (typeof document === 'undefined') return;
  if (document.head.querySelector('[data-scope="trip-map-rail"]')) return;
  const el = document.createElement('style');
  el.setAttribute('data-scope', 'trip-map-rail');
  el.textContent = SCOPED_STYLES;
  document.head.appendChild(el);
}

interface TripMapRailProps {
  /** All pins from all days (pre-extracted by TripPage). */
  pins: MapPin[];
  /** Current trip ID — used for navigate to stop detail. */
  tripId: string;
  /** Group pins by day for polyline colouring. Key = dayNum. */
  pinsByDay?: Map<number, MapPin[]>;
  /** Pass through to useLeafletMap — use dark tile layer when true. */
  dark?: boolean;
}

const SCOPED_STYLES = `
.trip-map-rail {
  /* ≥1024px breakpoint — iPad Pro 13" portrait start */
  position: sticky;
  top: var(--spacing-nav-h);
  height: calc(100dvh - var(--spacing-nav-h));
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-secondary);
}
.trip-map-rail > div {
  width: 100%;
  height: 100%;
}
/* Override Leaflet default fonts for controls + attribution */
.trip-map-rail .leaflet-bar a,
.trip-map-rail .leaflet-control-attribution {
  font-family: var(--font-family-system, 'Inter', sans-serif);
}
`;

/* ===== Leaflet default marker icon fix ===== */
function createPinIcon(label: string, color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${color};
      border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,0.3);
      display:grid;place-items:center;
      font-size:var(--font-size-eyebrow,0.625rem);font-weight:700;color:#fff;
      font-family:var(--font-family-system,'Inter',sans-serif);
    ">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

export default function TripMapRail({ pins, tripId, pinsByDay, dark = false }: TripMapRailProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const navigate = useNavigate();

  // Inject scoped styles once (singleton pattern)
  useEffect(() => {
    ensureStyle();
  }, []);

  const { containerRef, map, fitBounds } = useLeafletMap({
    center: [26.2, 127.7],
    zoom: 11,
    dark,
  });

  const fitDoneRef = useRef(false);
  const markersRef = useRef<L.Marker[]>([]);
  const polylinesRef = useRef<L.Polyline[]>([]);

  // Render pins + polylines whenever map or pins change
  useEffect(() => {
    if (!map || !isDesktop) return;

    // Clear old layers
    markersRef.current.forEach((m) => m.remove());
    polylinesRef.current.forEach((p) => p.remove());
    markersRef.current = [];
    polylinesRef.current = [];

    if (pins.length === 0) return;

    // Group by day for polylines
    const byDay = pinsByDay ?? (() => {
      // Reconstruct approximate day grouping from sortOrder / index sequencing
      // Fallback: no polylines if pinsByDay not provided
      return new Map<number, MapPin[]>();
    })();

    // Draw polylines per day
    byDay.forEach((dayPins, dayNum) => {
      const coords = dayPins
        .filter((p) => p.type === 'entry')
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((p): L.LatLngExpression => [p.lat, p.lng]);
      if (coords.length >= 2) {
        // F008: dayPolylineStyle 提供 color + dashArray（color-blind aid）
        const style = dayPolylineStyle(dayNum);
        const line = L.polyline(coords, {
          color: style.color,
          weight: style.weight,
          opacity: 0.8,
          dashArray: style.dashArray,
        }).addTo(map);
        polylinesRef.current.push(line);
      }
    });

    // Draw pins
    for (const pin of pins) {
      const color = (() => {
        // Find which day this pin belongs to
        for (const [dayNum, dayPins] of byDay) {
          if (dayPins.some((p) => p.id === pin.id)) return dayColor(dayNum);
        }
        return 'var(--color-accent)';
      })();

      const icon = createPinIcon(pin.type === 'hotel' ? 'H' : String(pin.index), color);
      const marker = L.marker([pin.lat, pin.lng], { icon })
        .addTo(map)
        .on('click', () => {
          if (pin.type === 'entry') {
            navigate(`/trip/${tripId}/stop/${pin.id}`);
          }
        });
      markersRef.current.push(marker);
    }

    // fitBounds once on initial mount
    if (!fitDoneRef.current) {
      fitDoneRef.current = true;
      const latlngs: L.LatLngExpression[] = pins.map((p) => [p.lat, p.lng]);
      fitBounds(latlngs, 32);
    }
  }, [map, pins, pinsByDay, tripId, navigate, fitBounds, isDesktop]);

  // F007: IntersectionObserver — 當某天 section 進入 viewport 60%+，panTo 該天中心
  useEffect(() => {
    if (!map || !pinsByDay || pinsByDay.size === 0) return;

    const daySections = Array.from(document.querySelectorAll<HTMLElement>('[data-day]'));
    if (daySections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 找最明顯進入視野的 day section
        const mostVisible = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio >= 0.6)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!mostVisible) return;

        const dayNum = Number((mostVisible.target as HTMLElement).dataset.day);
        if (!Number.isFinite(dayNum)) return;

        const dayPins = pinsByDay.get(dayNum);
        if (!dayPins || dayPins.length === 0) return;

        // 計算該天 pins 的平均座標作為中心
        const lat = dayPins.reduce((sum, p) => sum + p.lat, 0) / dayPins.length;
        const lng = dayPins.reduce((sum, p) => sum + p.lng, 0) / dayPins.length;
        (map as L.Map & { panTo?: (latlng: L.LatLngExpression) => void }).panTo?.([lat, lng]);
      },
      { threshold: [0.6, 0.8, 1.0] },
    );

    daySections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [map, pinsByDay]);

  // Don't render below 1024px
  if (!isDesktop) return null;

  return (
    <div className="trip-map-rail">
      <div ref={containerRef} />
    </div>
  );
}
