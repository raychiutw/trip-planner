import { useState, useRef, useCallback, useEffect } from 'react';
import { apiFetch } from './useApi';
import type { Trip, Day, DaySummary, TripDoc } from '../types/trip';

/* ===== Doc Types ===== */

const DOC_KEYS = ['flights', 'checklist', 'backup', 'emergency', 'suggestions'] as const;
export type DocKey = (typeof DOC_KEYS)[number];

/* ===== Hook Return Type ===== */

export interface UseTripReturn {
  trip: Trip | null;
  days: DaySummary[];
  currentDay: Day | null;
  currentDayNum: number;
  switchDay: (dayNum: number) => void;
  docs: Partial<Record<DocKey, unknown>>;
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
  const [docs, setDocs] = useState<Partial<Record<DocKey, unknown>>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [allDays, setAllDays] = useState<Record<number, Day>>({});

  // Cache day data to avoid re-fetching
  const dayCacheRef = useRef<Record<number, Day>>({});

  /* --- Fetch a single day --- */
  const fetchDay = useCallback(
    async (dayNum: number): Promise<Day | null> => {
      if (!tripId) return null;
      // Return cached if available
      const cached = dayCacheRef.current[dayNum];
      if (cached) return cached;

      try {
        const raw = await apiFetch<Day>(`/trips/${tripId}/days/${dayNum}`);
        dayCacheRef.current[dayNum] = raw;
        return raw;
      } catch {
        return null;
      }
    },
    [tripId],
  );

  /* --- Switch to a specific day --- */
  const switchDay = useCallback(
    (dayNum: number) => {
      setCurrentDayNum(dayNum);
      // If cached, set immediately
      const cached = dayCacheRef.current[dayNum];
      if (cached) {
        setCurrentDay(cached);
        return;
      }
      // Otherwise fetch
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

    // Reset state for new trip
    setTrip(null);
    setDays([]);
    setCurrentDay(null);
    setCurrentDayNum(0);
    setDocs({});
    setError(null);
    setLoading(true);
    dayCacheRef.current = {};
    setAllDays({});

    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      try {
        // Fetch meta + days list in parallel
        const [meta, daysList] = await Promise.all([
          apiFetch<Trip>(`/trips/${tripId}`, { signal: controller.signal }),
          apiFetch<DaySummary[]>(`/trips/${tripId}/days`, { signal: controller.signal }),
        ]);

        if (cancelled) return;

        setTrip(meta);

        // Sort days by day_num
        const sorted = [...daysList].sort(
          (a, b) => a.day_num - b.day_num,
        );
        setDays(sorted);

        // Determine initial day (first day by default)
        const firstDayNum = sorted.length > 0 ? sorted[0].day_num : 0;
        if (firstDayNum > 0) {
          setCurrentDayNum(firstDayNum);
        }

        // Fire ALL day fetches in parallel (non-blocking)
        for (const d of sorted) {
          const num = d.day_num;
          apiFetch<Day>(`/trips/${tripId}/days/${num}`, { signal: controller.signal })
            .then((dayData) => {
              if (cancelled) return;
              dayCacheRef.current[num] = dayData;
              setAllDays((prev) => ({ ...prev, [num]: dayData }));
              // Set currentDay when first day arrives
              if (num === firstDayNum) {
                setCurrentDay(dayData);
              }
            })
            .catch(() => {
              // silently skip failed day loads
            });
        }

        // Fetch docs in the background (non-blocking)
        for (const key of DOC_KEYS) {
          apiFetch<TripDoc>(`/trips/${tripId}/docs/${key}`, { signal: controller.signal })
            .then((data) => {
              if (cancelled) return;
              let content: unknown = data.content;
              // Parse JSON string if needed
              if (typeof content === 'string') {
                try {
                  content = JSON.parse(content);
                } catch {
                  // keep as string
                }
              }
              // Unwrap nested content structure: { title, content: { ... } }
              if (
                content &&
                typeof content === 'object' &&
                'content' in (content as Record<string, unknown>)
              ) {
                const outer = content as Record<string, unknown>;
                const docTitle = outer.title;
                content = outer.content;
                if (content && typeof content === 'object') {
                  (content as Record<string, unknown>)._title = docTitle;
                }
              }
              setDocs((prev) => ({ ...prev, [key]: content }));
            })
            .catch(() => {
              // doc not available, silently skip
            });
        }

        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '載入行程失敗');
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

  return { trip, days, currentDay, currentDayNum, switchDay, docs, allDays, loading, error };
}
