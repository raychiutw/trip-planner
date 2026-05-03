/**
 * AddSavedPoiToTripPage — 全頁 form 將「我的收藏」加入指定 trip / day / position。
 * Route: /saved-pois/:id/add-to-trip。
 * Hits fast-path POST /api/saved-pois/:id/add-to-trip — travel_* 由背景 tp-request 之後算。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TitleBar from '../components/shell/TitleBar';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { apiFetch } from '../lib/apiClient';
import { ApiError } from '../lib/errors';
import type { SavedPoi } from '../types/api';

interface TripBrief {
  tripId: string;
  name: string;
  totalDays: number;
}

interface DayBrief {
  dayNum: number;
  date: string;
  label: string | null;
}

type Position = 'append' | 'before' | 'after' | 'replace';

const POSITION_LABELS: Record<Position, string> = {
  append: '加在當天最後',
  before: '插在某個景點前',
  after: '插在某個景點後',
  replace: '取代某個景點',
};

const SCOPED_STYLES = `
.tp-saved-add-to-trip { display: flex; flex-direction: column; gap: 16px; }
.tp-saved-add-to-trip .tp-form-row select,
.tp-saved-add-to-trip .tp-form-row input[type='time'] {
  padding: 10px 12px; border: 1px solid var(--color-border);
  border-radius: var(--radius-md); background: var(--color-background);
  color: var(--color-foreground); font: inherit; font-size: 15px;
  min-height: var(--spacing-tap-min);
}
.tp-saved-add-to-trip .tp-skel { background: var(--color-bg-muted); border-radius: var(--radius-md); height: 36px; animation: tp-pulse 1.4s ease-in-out infinite; }
.tp-saved-add-to-trip .tp-skel + .tp-skel { margin-top: 12px; }
@keyframes tp-pulse { 0%,100% { opacity: 1; } 50% { opacity: .55; } }
.tp-saved-add-to-trip .tp-empty-cta {
  text-align: center; padding: 40px 24px; color: var(--color-muted);
  border: 1px dashed var(--color-border); border-radius: var(--radius-lg);
}
.tp-saved-add-to-trip .tp-empty-cta a {
  display: inline-block; margin-top: 12px;
  padding: 10px 20px; border-radius: var(--radius-md);
  background: var(--color-accent); color: var(--color-background);
  text-decoration: none; font-weight: 600;
}
.tp-saved-add-to-trip .tp-poi-summary {
  padding: 16px; border-radius: var(--radius-md);
  background: var(--color-bg-muted); border: 1px solid var(--color-border);
}
.tp-saved-add-to-trip .tp-poi-summary h3 { margin: 0 0 4px 0; font-size: 16px; }
.tp-saved-add-to-trip .tp-poi-summary p { margin: 0; color: var(--color-muted); font-size: 13px; }
.tp-saved-add-to-trip .tp-error {
  padding: 12px 16px; border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  color: var(--color-danger); border: 1px solid var(--color-danger);
  font-size: 14px;
}
`;

export default function AddSavedPoiToTripPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const savedPoiId = Number(idParam);
  const navigate = useNavigate();
  const goBack = useNavigateBack('/explore');

  // Loading / data states
  const [saved, setSaved] = useState<SavedPoi | null>(null);
  const [trips, setTrips] = useState<TripBrief[] | null>(null);
  const [days, setDays] = useState<DayBrief[] | null>(null);

  // Form state
  const [tripId, setTripId] = useState('');
  const [dayNum, setDayNum] = useState<number | ''>('');
  const [position, setPosition] = useState<Position>('append');
  const [anchorEntryId, setAnchorEntryId] = useState<number | ''>('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Status states
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(savedPoiId) || savedPoiId <= 0) {
      setLoadError('收藏 ID 無效');
      return;
    }
    let cancelled = false;
    Promise.all([
      apiFetch<SavedPoi[]>('/saved-pois'),
      apiFetch<TripBrief[] | { trips?: TripBrief[] }>('/my-trips'),
    ])
      .then(([savedList, tripsResp]) => {
        if (cancelled) return;
        const found = savedList.find((s) => s.id === savedPoiId) ?? null;
        if (!found) {
          setLoadError('找不到該收藏（可能已被刪除）');
          return;
        }
        setSaved(found);
        const tripsList = Array.isArray(tripsResp) ? tripsResp : tripsResp.trips ?? [];
        setTrips(tripsList);
        if (tripsList.length === 1) setTripId(tripsList[0]!.tripId);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : '載入失敗');
      });
    return () => { cancelled = true; };
  }, [savedPoiId]);

  useEffect(() => {
    if (!tripId) {
      setDays(null);
      setDayNum('');
      return;
    }
    let cancelled = false;
    apiFetch<{ days?: DayBrief[] }>(`/trips/${encodeURIComponent(tripId)}`)
      .then((data) => {
        if (cancelled) return;
        const dayList = data.days ?? [];
        setDays(dayList);
        if (dayList.length > 0) setDayNum(dayList[0]!.dayNum);
      })
      .catch(() => {
        if (cancelled) return;
        setDays([]);
      });
    return () => { cancelled = true; };
  }, [tripId]);

  // Backend TIME_RE 同 functions/api/_poi-defaults.ts — 防 FE 過鬆讓 BE 回 400 surprise
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

  const canSubmit = useMemo(() => {
    if (!saved || !tripId || dayNum === '' || submitting) return false;
    if (position !== 'append' && !anchorEntryId) return false;
    if (startTime && !TIME_RE.test(startTime)) return false;
    if (endTime && !TIME_RE.test(endTime)) return false;
    return true;
  }, [saved, tripId, dayNum, position, anchorEntryId, startTime, endTime, submitting]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiFetch(`/saved-pois/${savedPoiId}/add-to-trip`, {
        method: 'POST',
        body: JSON.stringify({
          tripId,
          dayNum: Number(dayNum),
          position,
          anchorEntryId: position !== 'append' ? Number(anchorEntryId) : undefined,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
        }),
      });
      const params = new URLSearchParams({ selected: tripId, day: String(dayNum), saved_added: '1' });
      navigate(`/trips?${params.toString()}`, { replace: true });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : '加入失敗';
      setSubmitError(msg);
      setSubmitting(false);
    }
  }, [canSubmit, savedPoiId, tripId, dayNum, position, anchorEntryId, startTime, endTime, navigate]);

  // ========== Render ==========

  // Hard error state
  if (loadError) {
    return (
      <div className="tp-app">
        <style>{SCOPED_STYLES}</style>
        <TitleBar title="加入行程" back={goBack} />
        <main className="tp-page-content">
          <div className="tp-error" role="alert">
            {loadError}
          </div>
        </main>
      </div>
    );
  }

  // Loading state
  if (!saved || !trips) {
    return (
      <div className="tp-app">
        <style>{SCOPED_STYLES}</style>
        <TitleBar title="加入行程" back={goBack} />
        <main className="tp-page-content">
          <div className="tp-saved-add-to-trip" aria-busy="true" aria-label="載入中">
            <div className="tp-skel" />
            <div className="tp-skel" />
            <div className="tp-skel" />
          </div>
        </main>
      </div>
    );
  }

  // Empty state — partial: saved POI loaded but user has no trip
  if (trips.length === 0) {
    return (
      <div className="tp-app">
        <style>{SCOPED_STYLES}</style>
        <TitleBar title="加入行程" back={goBack} />
        <main className="tp-page-content">
          <div className="tp-saved-add-to-trip">
            <div className="tp-poi-summary">
              <h3>{saved.poiName ?? '景點'}</h3>
              {saved.poiAddress && <p>{saved.poiAddress}</p>}
            </div>
            <div className="tp-empty-cta">
              <p>你還沒有任何行程</p>
              <a href="/trips/new">建立第一個行程</a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="tp-app">
      <style>{SCOPED_STYLES}</style>
      <TitleBar title="加入行程" back={goBack} />
      <main className="tp-page-content">
        <div className="tp-saved-add-to-trip">
          <div className="tp-poi-summary">
            <h3>{saved.poiName ?? '景點'}</h3>
            {saved.poiAddress && <p>{saved.poiAddress}</p>}
            {saved.note && <p>備註：{saved.note}</p>}
          </div>

          {submitError && (
            <div className="tp-error" role="alert" data-testid="saved-add-to-trip-error">
              {submitError}
            </div>
          )}

          <div className="tp-form">
            <div className="tp-form-row">
              <label htmlFor="atstr-trip">行程</label>
              <select
                id="atstr-trip"
                value={tripId}
                onChange={(e) => setTripId(e.target.value)}
                data-testid="saved-add-to-trip-trip"
              >
                <option value="">選擇行程…</option>
                {trips.map((t) => (
                  <option key={t.tripId} value={t.tripId}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="tp-form-row">
              <label htmlFor="atstr-day">第幾天</label>
              <select
                id="atstr-day"
                value={String(dayNum)}
                onChange={(e) => setDayNum(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={!days || days.length === 0}
                data-testid="saved-add-to-trip-day"
              >
                {days === null && <option value="">載入中…</option>}
                {days && days.length === 0 && <option value="">該行程沒有天數</option>}
                {days && days.length > 0 && (
                  <>
                    <option value="">選擇天數…</option>
                    {days.map((d) => (
                      <option key={d.dayNum} value={d.dayNum}>
                        Day {d.dayNum}{d.label ? ` · ${d.label}` : ''} ({d.date})
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <div className="tp-form-row">
              <label htmlFor="atstr-position">放置位置</label>
              <select
                id="atstr-position"
                value={position}
                onChange={(e) => setPosition(e.target.value as Position)}
                data-testid="saved-add-to-trip-position"
              >
                {(['append', 'before', 'after', 'replace'] as Position[]).map((p) => (
                  <option key={p} value={p}>
                    {POSITION_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>

            {position !== 'append' && (
              <div className="tp-form-row">
                <label htmlFor="atstr-anchor">參考的景點 ID（{POSITION_LABELS[position]}）</label>
                <input
                  id="atstr-anchor"
                  type="number"
                  min={1}
                  value={anchorEntryId === '' ? '' : String(anchorEntryId)}
                  onChange={(e) => setAnchorEntryId(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="entry id"
                  data-testid="saved-add-to-trip-anchor"
                />
              </div>
            )}

            <div className="tp-form-row">
              <label htmlFor="atstr-start">開始時間（可空，依景點類型自動推）</label>
              <input
                id="atstr-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                data-testid="saved-add-to-trip-start"
              />
            </div>

            <div className="tp-form-row">
              <label htmlFor="atstr-end">結束時間（可空，依停留時間預估推）</label>
              <input
                id="atstr-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                data-testid="saved-add-to-trip-end"
              />
            </div>
          </div>
        </div>
      </main>
      <div className="tp-page-bottom-bar">
        <button
          type="button"
          className="tp-btn tp-btn--primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
          data-testid="saved-add-to-trip-submit"
        >
          {submitting ? '加入中…' : '加入行程'}
        </button>
      </div>
    </div>
  );
}
