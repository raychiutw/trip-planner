import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/apiClient';

export interface EntryTargetDay {
  id?: number;
  dayNum: number;
  date?: string | null;
  label?: string | null;
  dayOfWeek?: string | null;
}

/** Only a day confirmed by the current trip read is an eligible write target. */
export function useEntryTarget({tripId, dayNum, enabled = true, selectFirst = true}: {
  tripId?: string; dayNum: number | '' | null; enabled?: boolean; selectFirst?: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const scope = useMemo(() => ({tripId, enabled, attempt}), [tripId, enabled, attempt]);
  const [snapshot, setSnapshot] = useState<{scope: object; days: EntryTargetDay[]; error: string | null} | null>(null);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    if (!enabled || !tripId) return;
    let cancelled = false;
    apiFetch<EntryTargetDay[]>(`/trips/${encodeURIComponent(tripId)}/days`).then(days => {
      if (!Array.isArray(days) || days.some(day => !day || !Number.isSafeInteger(day.dayNum) || day.dayNum < 1)) {
        throw new Error('日期資料格式錯誤');
      }
      if (!cancelled) setSnapshot({scope, days, error: null});
    }).catch(() => {
      if (!cancelled) setSnapshot({scope, days: [], error: '日期載入失敗，請重試'});
    });
    return () => { cancelled = true; };
  }, [tripId, enabled, scope]);
  const current = snapshot?.scope === scope ? snapshot : null;
  const status = !enabled || !tripId ? 'idle' : !current ? 'loading' : current.error ? 'error' : 'success';
  const days = status === 'success' ? current!.days : null;
  const day = (dayNum === '' || dayNum === null)
    ? (selectFirst ? days?.[0] : null)
    : days?.find(row => row.dayNum === dayNum);
  return {days, day: day ?? null, status, error: current?.error ?? null, retry};
}
