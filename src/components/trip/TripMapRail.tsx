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
import { dayColor } from '../../lib/dayPalette';
import type { MapPin } from '../../hooks/useMapData';

interface TripMapRailProps {
  /** All pins from all days (pre-extracted by TripPage). */
  pins: MapPin[];
  /** Current trip ID — used for navigate to stop detail. */
  tripId: string;
  /** Group pins by day for polyline colouring. Key = dayNum. */
  pinsByDay?: Map<number, MapPin[]>;
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
      font-family:system-ui,sans-serif;
    ">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

export default function TripMapRail({ pins, tripId, pinsByDay }: TripMapRailProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const navigate = useNavigate();

  const { containerRef, map, fitBounds } = useLeafletMap({
    center: [26.2, 127.7],
    zoom: 11,
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
        const line = L.polyline(coords, {
          color: dayColor(dayNum),
          weight: 3,
          opacity: 0.8,
          dashArray: undefined,
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

  // Don't render below 1024px
  if (!isDesktop) return null;

  return (
    <div className="trip-map-rail">
      <style>{SCOPED_STYLES}</style>
      <div ref={containerRef} />
    </div>
  );
}
