/**
 * TripIdContext — resolved tripId for components rendered inside TripPage.
 *
 * Why this exists separate from TripContext: TripContext carries the full
 * useTrip() return (heavy). Many components (TimelineEvent, TimelineRail,
 * DaySection's mapHref) only need tripId. They previously read it via
 * `useParams<{tripId}>()`, which fails when TripPage is embedded inside
 * `/trips?selected=:id` (URL has no :tripId param).
 *
 * TripPage provides this context with its resolved activeTripId in BOTH
 * route mode (`/trip/:tripId`) and embedded mode (TripsListPage sheet/main).
 * Consumers fall back to useParams when the context is absent (e.g., a
 * StopDetailPage rendered directly under /trip/:tripId/stop/:eid still uses
 * URL params via TripLayout's TripContext path).
 */
import { createContext, useContext } from 'react';
import { useParams } from 'react-router-dom';

export const TripIdContext = createContext<string | null>(null);

/** Get the active tripId. Prefers context (embedded mode) over URL params. */
export function useTripId(): string | undefined {
  const fromCtx = useContext(TripIdContext);
  const { tripId: fromUrl } = useParams<{ tripId: string }>();
  return fromCtx ?? fromUrl;
}
