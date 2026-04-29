/**
 * TripMapRail — sticky right-column map for desktop ≥1024px.
 *
 * Thin wrapper around OceanMap that adds:
 *   - Sticky positioning (≥1024px only, returns null below)
 *   - Scroll spy: when a day section ([data-day]) enters viewport 60%+, panTo that
 *     day's center without changing zoom
 *   - Pin click → navigate to /trip/:tripId/stop/:entryId
 *
 * The actual map rendering (tiles, pins, per-day colored polylines along real
 * roads via Mapbox Directions) is delegated to OceanMap so desktop rail + mobile
 * MapPage share the same polyline engine and font stack.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { MapPin } from '../../hooks/useMapData';

const OceanMap = lazy(() => import('./OceanMap'));

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
  /** Pass through to OceanMap — use dark tile layer when true. */
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
.trip-map-rail > * {
  width: 100%;
  height: 100%;
}
`;

export default function TripMapRail({ pins, tripId, pinsByDay, dark = false }: TripMapRailProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const navigate = useNavigate();
  const [panToCoord, setPanToCoord] = useState<{ lat: number; lng: number } | undefined>();

  useEffect(() => {
    ensureStyle();
  }, []);

  const handleMarkerClick = useCallback(
    (pinId: number) => {
      const pin = pins.find((p) => p.id === pinId);
      if (pin?.type === 'entry') {
        navigate(`/trip/${tripId}/stop/${pinId}`);
      }
    },
    [pins, tripId, navigate],
  );

  /* Scroll spy: pan map to the center of whichever day section is most in view.
     Computes centers up-front so the observer callback stays cheap. Averages over ALL pins
     (entries + hotel) to preserve pre-refactor behavior — hotel-only days still pan to hotel. */
  const dayCenters = useMemo(() => {
    const m = new Map<number, { lat: number; lng: number }>();
    if (!pinsByDay) return m;
    pinsByDay.forEach((dayPins, dayNum) => {
      if (dayPins.length === 0) return;
      const lat = dayPins.reduce((sum, p) => sum + p.lat, 0) / dayPins.length;
      const lng = dayPins.reduce((sum, p) => sum + p.lng, 0) / dayPins.length;
      m.set(dayNum, { lat, lng });
    });
    return m;
  }, [pinsByDay]);

  useEffect(() => {
    if (!isDesktop || dayCenters.size === 0) return;
    const daySections = Array.from(document.querySelectorAll<HTMLElement>('[data-day]'));
    if (daySections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio >= 0.6)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!mostVisible) return;
        const dayNum = Number((mostVisible.target as HTMLElement).dataset.day);
        if (!Number.isFinite(dayNum)) return;
        const center = dayCenters.get(dayNum);
        if (center) setPanToCoord(center);
      },
      { threshold: [0.6, 0.8, 1.0] },
    );

    daySections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [isDesktop, dayCenters]);

  if (!isDesktop) return null;

  return (
    <div className="trip-map-rail">
      <Suspense fallback={<div />}>
        <OceanMap
          pins={pins}
          mode="overview"
          pinsByDay={pinsByDay}
          routes={true}
          fillParent={true}
          fitOnce={true}
          onMarkerClick={handleMarkerClick}
          panToCoord={panToCoord}
          dark={dark}
        />
      </Suspense>
    </div>
  );
}
