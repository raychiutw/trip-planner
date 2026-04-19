/**
 * TripLayout — wraps /trip/:tripId/* routes with a shared TripContext.
 *
 * Thin pass-through: useTrip(urlTripId) → TripContext.Provider → <Outlet />.
 * Does NOT implement resolve fallbacks (unpublished/default) — those remain
 * in TripPage where they always have. This layout exists so peer routes
 * (TripPage index, StopDetailPage) can share one trip+days fetch.
 */

import { useParams, Outlet } from 'react-router-dom';
import { useTrip } from '../hooks/useTrip';
import { TripContext } from '../contexts/TripContext';

export default function TripLayout() {
  const { tripId } = useParams<{ tripId: string }>();
  const valid = tripId && /^[\w-]+$/.test(tripId) ? tripId : null;
  const tripState = useTrip(valid);
  return (
    <TripContext.Provider value={tripState}>
      <Outlet />
    </TripContext.Provider>
  );
}
