/**
 * TripContext — shared trip data across /trip/:tripId/* routes.
 *
 * Provided by <TripLayout>, consumed by TripPage + StopDetailPage (+ future
 * StopMapPage in PR3). Avoids duplicate /api/trips fetch when navigating
 * between stop detail and trip overview.
 *
 *   /trip/:tripId/*
 *     ├── TripLayout ─ useTrip(urlTripId) ─► TripContext.Provider
 *     │                                           │
 *     │    (index)                                │
 *     │    └── TripPage ──────── useTripContext()
 *     │                                           │
 *     │    stop/:entryId                          │
 *     └── StopDetailPage ─────── useTripContext()
 */

import { createContext, useContext } from 'react';
import type { UseTripReturn } from '../hooks/useTrip';

export const TripContext = createContext<UseTripReturn | null>(null);

export function useTripContext(): UseTripReturn {
  const ctx = useContext(TripContext);
  if (!ctx) {
    throw new Error(
      'useTripContext must be used inside <TripLayout>. ' +
        'Route this page under /trip/:tripId/*',
    );
  }
  return ctx;
}

/** Optional accessor — returns null outside a TripProvider instead of throwing. */
export function useTripContextOptional(): UseTripReturn | null {
  return useContext(TripContext);
}
