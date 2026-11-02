import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';

type Day = { dayNum: number };
type Result<T extends Day> =
  | { tripId: string; request: number; status: 'ready'; days: T[] }
  | { tripId: string; request: number; status: 'error' };

/** Keep the selected day and fetch result tied to the trip that supplied them. */
export function useAddToTripTarget<T extends Day>(tripId: string, preferredDay?: number) {
  const [request, setRequest] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  const [choice, setChoice] = useState<{ tripId: string; dayNum: number } | null>(null);

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    apiFetch<T[]>(`/trips/${encodeURIComponent(tripId)}/days`)
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data)) throw new Error('Invalid days response');
        setResult({ tripId, request, status: 'ready', days: data });
      })
      .catch(() => {
        if (!cancelled) setResult({ tripId, request, status: 'error' });
      });
    return () => { cancelled = true; };
  }, [tripId, request]);

  const current = result?.tripId === tripId && result.request === request ? result : null;
  const status = !tripId ? 'idle' : current?.status ?? 'loading';
  const days = current?.status === 'ready' ? current.days : [];
  const wanted = choice?.tripId === tripId ? choice.dayNum : preferredDay;
  const dayNum = status === 'ready'
    ? (days.find((day) => day.dayNum === wanted)?.dayNum ?? days[0]?.dayNum ?? null)
    : null;
  const selectDay = useCallback((next: number) => {
    setChoice({ tripId, dayNum: next });
  }, [tripId]);
  const retry = useCallback(() => setRequest((value) => value + 1), []);

  return { status, days, dayNum, selectDay, retry };
}
