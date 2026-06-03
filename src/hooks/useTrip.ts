import { useState, useRef, useCallback, useEffect } from 'react';
import { apiFetch } from '../lib/apiClient';
import { mapRow } from '../lib/mapRow';
import { ApiError } from '../lib/errors';
import { showErrorToast } from '../components/shared/Toast';
import type { Trip, Day, DaySummary, DocEntry } from '../types/trip';

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
    /** Section 4.3 (terracotta-mockup-parity-v2)：surface trip_days.title */
    title: (raw.title as string | null | undefined) ?? null,
    updatedAt: raw.updatedAt as string | undefined,
    hotel: (raw.hotel as Day['hotel']) ?? null,
    timeline: (raw.timeline as Day['timeline']) ?? [],
  };
}

/* ===== Doc Types ===== */
// v2.33.37 round 2: DOC_KEYS canonical 移到 src/lib/docKeys.ts（lib → hooks
// 反向依賴）。本檔 re-export 維持向後相容。
export { DOC_KEYS } from '../lib/docKeys';
export type { DocKey } from '../lib/docKeys';
import { DOC_KEYS } from '../lib/docKeys';
import type { DocKey } from '../lib/docKeys';

/* ===== Hook Return Type ===== */

export interface UseTripReturn {
  trip: Trip | null;
  days: DaySummary[];
  currentDay: Day | null;
  currentDayNum: number;
  switchDay: (dayNum: number) => void;
  refetchCurrentDay: () => void;
  /** Refetch a specific day (bypass cache). Used by listener when add/edit
   *  happens to a non-current day — timeline 顯示所有 day, 該 day section
   *  仍需 invalidate cache + re-fetch 才會 surface 新 entry。 */
  refetchDay: (dayNum: number) => void;
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
      if (!tripId || !Number.isInteger(dayNum) || dayNum < 1) return null;
      const cached = allDaysRef.current[dayNum];
      if (cached) return cached;

      try {
        const raw = await apiFetch<Record<string, unknown>>(`/trips/${tripId}/days/${dayNum}`);
        const day = mapDayResponse(raw);
        // v2.33.39 round 4: 之前直接 allDaysRef.current[dayNum] = day mutate ref
        // 而 caller 讀的 React state 沒同步 → switchDay 後手動補 setAllDays，
        // 但其它 caller (allDays return value) 看不到 cache。改用 setAllDays
        // 作 single writer，ref mirror 由 useEffect 同步（既有 line 76-77 pattern）。
        setAllDays((prev) => (prev[dayNum] === day ? prev : { ...prev, [dayNum]: day }));
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
          // v2.33.35 (simplify PR-8): 用 batch endpoint GET /trips/:id/docs 取代
          // 原本 5 個 sequential CF Function calls (10 D1 queries)。
          // 新端點回 { docs: { flights | checklist | ... : DocData | null } }
          // — 不存在的 doc 為 null，caller 不需 per-doc catch DATA_NOT_FOUND。
          try {
            const res = await apiFetch<{ docs: Record<DocKey, DocData | null> }>(
              `/trips/${tripId}/docs`,
              { signal: controller.signal },
            );
            if (cancelled) return;
            const next: Partial<Record<DocKey, DocData>> = {};
            for (const key of DOC_KEYS) {
              const data = res.docs[key];
              if (data) next[key] = data;
            }
            setDocs((prev) => ({ ...prev, ...next }));
          } catch (err) {
            if (cancelled) return;
            if (err instanceof ApiError && err.code === 'DATA_NOT_FOUND') {
              // batch endpoint 404（trip 找不到等）— 上游已 setLoadError，這裡靜默
              return;
            }
            if (err instanceof ApiError && err.severity !== 'minor') {
              showErrorToast(err.message, err.severity);
            }
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

  /* --- Refetch a specific day (bypass cache) ---
   * Handles both「current day」 case (dayNum === currentDayNum 同步 setCurrentDay)
   * 跟「某天 add 但不是當前 strip 選中那天」 case (timeline 仍顯示所有 day,
   * 需 update allDays[dayNum] 該 DaySection 才會 re-render)。 */
  const refetchDay = useCallback((dayNum: number) => {
    if (!Number.isInteger(dayNum) || dayNum < 1) return;
    delete allDaysRef.current[dayNum];
    fetchDay(dayNum).then((day) => {
      if (day) {
        setAllDays((prev) => ({ ...prev, [dayNum]: day }));
        if (dayNum === currentDayNum) setCurrentDay(day);
      }
    });
  }, [currentDayNum, fetchDay]);

  /* --- Refetch the current day (legacy alias for refetchDay(currentDayNum)) --- */
  const refetchCurrentDay = useCallback(() => {
    if (!currentDayNum) return;
    refetchDay(currentDayNum);
  }, [currentDayNum, refetchDay]);

  return { trip, days, currentDay, currentDayNum, switchDay, refetchCurrentDay, refetchDay, docs, allDays, loading, error };
}
