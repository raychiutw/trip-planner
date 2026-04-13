import { useState, useRef, useCallback, useEffect } from 'react';
import { apiFetch } from '../lib/apiClient';
import { mapRow } from '../lib/mapRow';
import { ApiError } from '../lib/errors';
import { showErrorToast } from '../components/shared/Toast';
import type { Trip, Day, DaySummary } from '../types/trip';
import type { DocEntry } from '../components/trip/DocCard';

/** Shape of a single doc returned from /api/trips/:id/docs/:key */
export interface DocData {
  docType?: string;
  title?: string;
  entries?: DocEntry[];
}


/* ===== API response normaliser ===== */

/**
 * The API now returns camelCase fields (dayNum, dayOfWeek, updatedAt).
 * Normalise to the Day interface before storing.
 */
function mapDayResponse(raw: Record<string, unknown>): Day {
  return {
    id: raw.id as number,
    dayNum: raw.dayNum as number,
    date: (raw.date as string | null | undefined) ?? null,
    dayOfWeek: (raw.dayOfWeek as string | null | undefined) ?? null,
    label: (raw.label as string | null | undefined) ?? null,
    updatedAt: raw.updatedAt as string | undefined,
    hotel: (raw.hotel as Day['hotel']) ?? null,
    timeline: (raw.timeline as Day['timeline']) ?? [],
  };
}

/* ===== Doc Types ===== */

export const DOC_KEYS = ['flights', 'checklist', 'backup', 'emergency', 'suggestions'] as const;
export type DocKey = (typeof DOC_KEYS)[number];

/* ===== Hook Return Type ===== */

export interface UseTripReturn {
  trip: Trip | null;
  days: DaySummary[];
  currentDay: Day | null;
  currentDayNum: number;
  switchDay: (dayNum: number) => void;
  refetchCurrentDay: () => void;
  docs: Partial<Record<DocKey, DocData>>;
  allDays: Record<number, Day>;
  loading: boolean;
  error: string | null;
}

/* ===== Hook ===== */

export function useTrip(tripId: string | null): UseTripReturn {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [days, setDays] = useState<DaySummary[]>([]);
  const [currentDay, setCurrentDay] = useState<Day | null>(null);
  const [currentDayNum, setCurrentDayNum] = useState<number>(0);
  const [docs, setDocs] = useState<Partial<Record<DocKey, DocData>>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [allDays, setAllDays] = useState<Record<number, Day>>({});
  // Single ref mirrors allDays for sync cache lookups (avoids stale closures)
  const allDaysRef = useRef(allDays);
  allDaysRef.current = allDays;

  /* --- Fetch a single day --- */
  const fetchDay = useCallback(
    async (dayNum: number): Promise<Day | null> => {
      if (!tripId) return null;
      const cached = allDaysRef.current[dayNum];
      if (cached) return cached;

      try {
        const raw = await apiFetch<Record<string, unknown>>(`/trips/${tripId}/days/${dayNum}`);
        const day = mapDayResponse(raw);
        allDaysRef.current[dayNum] = day;
        return day;
      } catch (err) {
        if (err instanceof ApiError) {
          showErrorToast(err.message, err.severity);
        }
        return null;
      }
    },
    [tripId],
  );

  /* --- Switch to a specific day --- */
  const switchDay = useCallback(
    (dayNum: number) => {
      setCurrentDayNum(dayNum);
      const cached = allDaysRef.current[dayNum];
      if (cached) {
        setCurrentDay(cached);
        return;
      }
      fetchDay(dayNum).then((day) => {
        if (day) {
          setCurrentDay(day);
          setAllDays((prev) => ({ ...prev, [dayNum]: day }));
        }
      });
    },
    [fetchDay],
  );

  /* --- Initial load: trip meta + days list + docs --- */
  useEffect(() => {
    if (!tripId) {
      setLoading(false);
      return;
    }

    setTrip(null);
    setDays([]);
    setCurrentDay(null);
    setCurrentDayNum(0);
    setDocs({});
    setError(null);
    setLoading(true);
    allDaysRef.current = {};
    setAllDays({});

    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      try {
        // Fetch meta + all days (batch endpoint) in parallel — 2 calls total, not N+1
        const [rawMeta, rawDays] = await Promise.all([
          apiFetch<Record<string, unknown>>(`/trips/${tripId}`, { signal: controller.signal }),
          apiFetch<Record<string, unknown>[]>(`/trips/${tripId}/days?all=1`, { signal: controller.signal }),
        ]);

        if (cancelled) return;

        const meta = mapRow(rawMeta) as unknown as Trip;
        setTrip(meta);

        // Parse all days once, derive summaries and full day cache from same response
        const allDaysData = rawDays.map(mapDayResponse).sort((a, b) => a.dayNum - b.dayNum);
        const summaries: DaySummary[] = allDaysData.map(d => ({
          id: d.id,
          dayNum: d.dayNum,
          date: d.date,
          dayOfWeek: d.dayOfWeek,
          label: d.label,
        }));
        setDays(summaries);

        const byNum: Record<number, Day> = {};
        for (const d of allDaysData) byNum[d.dayNum] = d;
        allDaysRef.current = byNum;
        setAllDays(byNum);

        // Set first day as current
        const first = allDaysData[0];
        if (first) {
          setCurrentDayNum(first.dayNum);
          setCurrentDay(first);
        }

        async function fetchAllDocs() {
          const results = await Promise.allSettled(
            DOC_KEYS.map((key) =>
              apiFetch<DocData>(`/trips/${tripId}/docs/${key}`, { signal: controller.signal })
                .then((data) => ({ key, data }))
            ),
          );
          if (cancelled) return;
          for (const result of results) {
            if (result.status === 'rejected') {
              const err = result.reason;
              if (err instanceof ApiError && err.severity !== 'minor') {
                showErrorToast(err.message, err.severity);
              }
              continue;
            }
            const { key, data } = result.value;
            // 新格式：API 直接回傳 { title, entries }，不需 JSON unwrap
            setDocs((prev) => ({ ...prev, [key]: data }));
          }
        }
        fetchAllDocs();

        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : '載入行程失敗');
          setError(msg);
          if (err instanceof ApiError) showErrorToast(msg, err.severity);
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      controller.abort();
      cancelled = true;
    };
  }, [tripId]);

  /* --- Refetch the current day (bypass cache) --- */
  const refetchCurrentDay = useCallback(() => {
    if (!currentDayNum) return;
    delete allDaysRef.current[currentDayNum];
    fetchDay(currentDayNum).then((day) => {
      if (day) {
        setCurrentDay(day);
        setAllDays((prev) => ({ ...prev, [currentDayNum]: day }));
      }
    });
  }, [currentDayNum, fetchDay]);

  return { trip, days, currentDay, currentDayNum, switchDay, refetchCurrentDay, docs, allDays, loading, error };
}
