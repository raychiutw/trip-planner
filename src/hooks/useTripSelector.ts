import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { lsGet, LS_KEY_TRIP_PREF } from '../lib/localStorage';

interface UseTripSelectorResult {
  currentTripIdRef: React.RefObject<string | null>;
  abortRef: React.RefObject<AbortController | null>;
  handleClose: () => void;
}

/**
 * Shared pattern for pages that display a trip selector.
 * Provides a stable ref for the current trip ID, an abort controller ref,
 * and a handleClose function that navigates back to the trip or home.
 *
 * currentTripId state lives in the calling component; this hook only manages
 * the ref (kept in sync by the caller) and the close/nav logic.
 */
export function useTripSelector(currentTripId: string | null): UseTripSelectorResult {
  const navigate = useNavigate();

  const currentTripIdRef = useRef<string | null>(currentTripId);
  currentTripIdRef.current = currentTripId;

  const abortRef = useRef<AbortController | null>(null);

  function handleClose() {
    const tripId = lsGet<string>(LS_KEY_TRIP_PREF);
    navigate(tripId ? `/trip/${tripId}` : '/');
  }

  return { currentTripIdRef, abortRef, handleClose };
}
