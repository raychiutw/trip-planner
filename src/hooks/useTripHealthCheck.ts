import {useCallback, useEffect, useMemo, useState} from 'react';
import {apiFetchRaw} from '../lib/apiClient';
import {ApiError} from '../lib/errors';

export type Severity = 'high' | 'medium' | 'low';
export type Dimension = 'timing' | 'distance' | 'meals' | 'sights' | 'hotel';

export interface Finding {
  severity: Severity;
  title: string;
  description: string;
  /** v2.31.1 Phase 2: audit dimension chip — timing/distance/meals/sights/hotel */
  dimension?: Dimension;
  /** v2.31.1 Phase 2: 建議怎麼修 — 顯示在 description 下方 */
  suggestion?: string;
  // v2.31.14: backend response 經 deepCamel 是 camelCase（actionTarget / entryId）。
  // 早期 snake_case 寫法 `f.action_target?.entry_id` 永遠 undefined → 「前往景點」/
  // 「前往 Day」按鈕永不 render → user 看不到 finding 跳轉。Prod QA found，同 #573
  // EditTripPage camelCase 對齊 bug 家族。
  actionTarget?: { day?: number; entryId?: number };
}

export interface HealthReport {
  tripId: string;
  userId: string;
  status: 'pending' | 'completed' | 'failed';
  requestId: number | null;
  findings: Finding[];
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

interface Snapshot {
  title: string;
  entryCount: number | null;
  report: HealthReport | null;
  lastReport: HealthReport | null;
  loaded: boolean;
  loading: boolean;
  submitting: boolean;
  freshness: 'unknown' | 'fresh' | 'stale';
  error: string | null;
}

/** A trip visit owns report freshness separately from the last readable findings. */
export function useTripHealthCheck(tripId: string) {
  const [state, setState] = useState<Snapshot>({title: '', entryCount: null, report: null, lastReport: null,
    loaded: false, loading: true, submitting: false, freshness: 'unknown', error: null});
  const owner = useMemo(() => ({alive: true, reading: false, submitting: false, sequence: 0,
    controller: new AbortController(), hasTrip: false, latestRequestId: 0}), []);
  const path = `/trips/${encodeURIComponent(tripId)}`;
  const acceptReport = (current: Snapshot, report: HealthReport | null): Snapshot => ({...current, report,
    lastReport: report?.status === 'completed' || report?.findings.length ? report : current.lastReport});

  const retry = useCallback(async () => {
    if (!owner.alive || owner.reading || owner.submitting) return;
    owner.reading = true;
    const sequence = ++owner.sequence;
    setState(current => ({...current, loading: true}));
    try {
      let metadata: {title: string; entryCount: number} | undefined;
      const reportPromise = apiFetchRaw(`${path}/health-check`, {signal: owner.controller.signal}).then(async response => {
        if (!response.ok) throw new Error(response.status === 403 ? '沒有權限讀取此行程健檢' : '無法讀取健檢狀態');
        return (await response.json() as {report: HealthReport | null}).report;
      });
      const metadataPromise = owner.hasTrip ? Promise.resolve() : Promise.all([
        apiFetchRaw(path, {signal: owner.controller.signal}),
        apiFetchRaw(`${path}/days?all=1`, {signal: owner.controller.signal}),
      ]).then(async ([trip, days]) => {
        if (!trip.ok || !days.ok) throw new Error('無法確認行程資料，請重試');
        const tripData = await trip.json() as {title?: string; name?: string};
        const daysData = await days.json() as Array<{timeline?: unknown[]}>;
        if (!Array.isArray(daysData)) throw new Error('無法確認行程日期，請重試');
        metadata = {title: tripData.title?.trim() || tripData.name?.trim() || '行程',
          entryCount: daysData.reduce((sum, day) => sum + (Array.isArray(day.timeline) ? day.timeline.length : 0), 0)};
      });
      const [report] = await Promise.all([reportPromise, metadataPromise]);
      if (!owner.alive || sequence !== owner.sequence) return;
      if (owner.latestRequestId && (!report?.requestId || report.requestId < owner.latestRequestId)) {
        throw new Error('健檢報告尚未更新，請重試');
      }
      owner.latestRequestId = Math.max(owner.latestRequestId, report?.requestId ?? 0);
      owner.hasTrip = true;
      setState(current => ({...acceptReport(current, report), ...metadata, loaded: true,
        loading: false, freshness: 'fresh', error: null}));
    } catch (error) {
      if (owner.alive && sequence === owner.sequence) setState(current => ({...current, loading: false,
        freshness: 'stale', error: error instanceof Error ? error.message : '無法讀取健檢狀態'}));
    } finally {
      if (sequence === owner.sequence) owner.reading = false;
    }
  }, [owner, path]);

  useEffect(() => {
    owner.alive = true;
    owner.controller = new AbortController();
    void retry();
    return () => {owner.alive = false; owner.sequence++; owner.reading = false; owner.controller.abort();};
  }, [owner, retry]);
  useEffect(() => {
    if (state.loading || (state.report?.status !== 'pending' && state.freshness !== 'stale')) return;
    const timer = setTimeout(() => void retry(), 3000);
    return () => clearTimeout(timer);
  }, [state.loading, state.report, state.freshness, retry]);

  const canStart = state.freshness === 'fresh' && !state.loading && !state.submitting
    && state.entryCount !== null && state.entryCount > 0 && state.report?.status !== 'pending';
  const start = async () => {
    if (!canStart || owner.submitting || !owner.alive) return;
    owner.submitting = true;
    setState(current => ({...current, submitting: true, error: null}));
    try {
      const response = await apiFetchRaw(`${path}/health-check`, {method: 'POST', signal: owner.controller.signal});
      const body = await response.json() as {report: HealthReport; error?: {code?: string; message?: string}};
      if (!owner.alive) return;
      if (!response.ok) {
        if (body.error?.code === 'TRIP_EMPTY') setState(current => ({...current, entryCount: 0}));
        if (body.error?.code === 'AI_DATA_CONSENT_REQUIRED' || body.error?.code === 'AI_DATA_CONSENT_OWNER_REQUIRED') {
          throw new ApiError(body.error.code, response.status);
        }
        throw new Error(body.error?.message ?? (response.status === 403 ? '沒有權限執行此行程健檢' : '健檢請求未確認，請重新讀取狀態'));
      }
      owner.latestRequestId = Math.max(owner.latestRequestId, body.report.requestId ?? 0);
      setState(current => ({...acceptReport(current, body.report), freshness: 'fresh'}));
    } catch (error) {
      if (error instanceof ApiError && (error.code === 'AI_DATA_CONSENT_REQUIRED' || error.code === 'AI_DATA_CONSENT_OWNER_REQUIRED')) throw error;
      if (owner.alive) setState(current => ({...current, freshness: 'stale',
        error: error instanceof Error ? error.message : '健檢請求未確認，請重新讀取狀態'}));
    } finally {
      owner.submitting = false;
      if (owner.alive) setState(current => ({...current, submitting: false}));
    }
  };
  return {...state, retry, start, canStart};
}
