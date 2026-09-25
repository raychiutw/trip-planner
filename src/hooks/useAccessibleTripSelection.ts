/** Accessible summaries, preference resolution and explicit targets for trip-aware callers. */
import { useEffect, useRef } from 'react';
import { useActiveTrip } from '../contexts/ActiveTripContext';
import { useMyTrips } from './useMyTrips';

export function useAccessibleTripSelection(userId: string | null | undefined, explicitTripId?: string | null, lockSelection = false) {
  const { trips, status, retry } = useMyTrips(userId);
  const { activeTripId, setActiveTrip } = useActiveTrip();
  const selectionAtReadStart = useRef(activeTripId);
  const previousStatus = useRef(status);

  useEffect(() => {
    if (status === 'loading' && previousStatus.current !== 'loading') {
      selectionAtReadStart.current = activeTripId;
    }
    previousStatus.current = status;
  }, [activeTripId, status]);

  useEffect(() => {
    if (explicitTripId) setActiveTrip(explicitTripId);
  }, [explicitTripId, setActiveTrip]);

  useEffect(() => {
    if (lockSelection && explicitTripId && activeTripId !== explicitTripId) setActiveTrip(explicitTripId);
  }, [activeTripId, explicitTripId, lockSelection, setActiveTrip]);

  useEffect(() => {
    if (explicitTripId || !userId || status !== 'success' || !trips) return;
    if (activeTripId && trips.some((trip) => trip.tripId === activeTripId)) return;
    if (activeTripId !== selectionAtReadStart.current) return;
    setActiveTrip(trips[0]?.tripId ?? null);
  }, [activeTripId, explicitTripId, setActiveTrip, status, trips, userId]);

  const selectedTripId = status !== 'success' ? null
    : activeTripId && (trips?.some((trip) => trip.tripId === activeTripId) || activeTripId !== selectionAtReadStart.current)
      ? activeTripId : trips?.[0]?.tripId ?? null;

  return { trips, status, retry, activeTripId, selectedTripId, setActiveTrip };
}
