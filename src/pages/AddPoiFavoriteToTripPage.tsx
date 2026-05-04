/**
 * AddPoiFavoriteToTripPage — 全頁 form 將「收藏」加入指定 trip / day。
 * Route: /favorites/:id/add-to-trip。
 * v2.22.0 改 4-field 純時間驅動：{ tripId, dayNum, startTime, endTime }。
 * 不再含 position radio / anchorEntryId — server 依 startTime 自動排 sort_order。
 *
 * mockup-driven hard gate aligned (docs/design-sessions/2026-05-04-favorites-redesign.html v4
 * sign-off 2026-05-04)。對齊 DESIGN.md L580-602 規範。
 *
 * Hits fast-path POST /api/poi-favorites/:id/add-to-trip — travel_* 由背景 tp-request 之後算。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TitleBar from '../components/shell/TitleBar';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import ConflictModal, { type ConflictWith } from '../components/shared/ConflictModal';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { apiFetch } from '../lib/apiClient';
import { ApiError } from '../lib/errors';
import type { PoiFavorite } from '../types/api';

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

const SCOPED_STYLES = `
.tp-favorites-add-to-trip { display: flex; flex-direction: column; gap: 16px; }

.tp-favorites-add-to-trip .tp-form-grid-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 16px;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
}
@media (max-width: 760px) {
  .tp-favorites-add-to-trip .tp-form-grid-2col { grid-template-columns: 1fr; gap: 12px; }
}

.tp-favorites-add-to-trip .tp-form-row { display: flex; flex-direction: column; gap: 6px; }
.tp-favorites-add-to-trip .tp-form-row label {
  font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-foreground);
}
.tp-favorites-add-to-trip .tp-form-row select,
.tp-favorites-add-to-trip .tp-form-row input[type='time'] {
  padding: 10px 12px; border: 1px solid var(--color-border);
  border-radius: var(--radius-md); background: var(--color-background);
  color: var(--color-foreground); font: inherit; font-size: 15px;
  min-height: var(--spacing-tap-min);
}
.tp-favorites-add-to-trip .tp-form-row select:disabled,
.tp-favorites-add-to-trip .tp-form-row input[type='time']:disabled {
  opacity: 0.5; cursor: not-allowed;
}

/* startTime + endTime 並排（grid 內 span 2 col + 內部 grid） */
.tp-favorites-add-to-trip .tp-form-row-pair {
  grid-column: span 2;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
@media (max-width: 760px) {
  .tp-favorites-add-to-trip .tp-form-row-pair { grid-template-columns: 1fr; gap: 12px; }
}

.tp-favorites-add-to-trip .tp-form-actions {
  margin-top: 8px;
  max-width: 720px; width: 100%; margin-left: auto; margin-right: auto;
  display: flex; justify-content: center;
}
.tp-favorites-add-to-trip .tp-form-actions .tp-btn--primary {
  font: inherit; font-weight: 700; font-size: 15px;
  padding: 12px 28px; border-radius: var(--radius-full);
  background: var(--color-accent); color: var(--color-accent-foreground);
  border: 1px solid var(--color-accent);
  cursor: pointer; min-height: var(--spacing-tap-min);
  min-width: 200px;
}
.tp-favorites-add-to-trip .tp-form-actions .tp-btn--primary:disabled {
  opacity: 0.55; cursor: not-allowed;
}
@media (max-width: 760px) {
  .tp-favorites-add-to-trip .tp-form-actions .tp-btn--primary { width: 100%; }
}

.tp-favorites-add-to-trip .tp-skel {
  background: var(--color-bg-muted, var(--color-tertiary));
  border-radius: var(--radius-md); height: 44px;
  animation: tp-pulse 1.4s ease-in-out infinite;
}
@keyframes tp-pulse { 0%,100% { opacity: 1; } 50% { opacity: .55; } }
@media (prefers-reduced-motion: reduce) {
  .tp-favorites-add-to-trip .tp-skel { animation: none; }
}

.tp-favorites-add-to-trip .tp-empty-cta {
  text-align: center; padding: 40px 24px; color: var(--color-muted);
  border: 1px dashed var(--color-border); border-radius: var(--radius-lg);
  max-width: 720px; width: 100%; margin: 0 auto;
}
.tp-favorites-add-to-trip .tp-empty-cta a {
  display: inline-block; margin-top: 12px;
  padding: 10px 20px; border-radius: var(--radius-md);
  background: var(--color-accent); color: var(--color-background);
  text-decoration: none; font-weight: 600;
}
.tp-favorites-add-to-trip .tp-poi-summary {
  padding: 16px; border-radius: var(--radius-md);
  background: var(--color-bg-muted, var(--color-tertiary));
  border: 1px solid var(--color-border);
  max-width: 720px; width: 100%; margin: 0 auto;
}
.tp-favorites-add-to-trip .tp-poi-summary h3 { margin: 0 0 4px 0; font-size: 16px; }
.tp-favorites-add-to-trip .tp-poi-summary p { margin: 0; color: var(--color-muted); font-size: 13px; }
.tp-favorites-add-to-trip .tp-error {
  padding: 12px 16px; border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  color: var(--color-danger); border: 1px solid var(--color-danger);
  font-size: 14px;
  max-width: 720px; width: 100%; margin: 0 auto;
}
`;

export default function AddPoiFavoriteToTripPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const favoriteId = Number(idParam);
  const navigate = useNavigate();
  const goBack = useNavigateBack('/favorites');

  // Loading / data states
  const [favorite, setFavorite] = useState<PoiFavorite | null>(null);
  const [trips, setTrips] = useState<TripBrief[] | null>(null);
  const [days, setDays] = useState<DayBrief[] | null>(null);
  const [daysLoading, setDaysLoading] = useState(false);

  // Form state — 4 fields (純時間驅動 v2.22.0)
  const [tripId, setTripId] = useState('');
  const [dayNum, setDayNum] = useState<number | ''>('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Status states
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [conflictPayload, setConflictPayload] = useState<ConflictWith | null>(null);

  const { user } = useCurrentUser();

  useEffect(() => {
    if (!Number.isInteger(favoriteId) || favoriteId <= 0) {
      setLoadError('收藏 ID 無效');
      return;
    }
    let cancelled = false;
    Promise.all([
      apiFetch<PoiFavorite[]>('/poi-favorites'),
      apiFetch<TripBrief[] | { trips?: TripBrief[] }>('/my-trips'),
    ])
      .then(([favoritesList, tripsResp]) => {
        if (cancelled) return;
        const found = favoritesList.find((s) => s.id === favoriteId) ?? null;
        if (!found) {
          setLoadError('找不到該收藏（可能已被刪除）');
          return;
        }
        setFavorite(found);
        const tripsList = Array.isArray(tripsResp) ? tripsResp : tripsResp.trips ?? [];
        setTrips(tripsList);
        if (tripsList.length === 1) setTripId(tripsList[0]!.tripId);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : '載入失敗');
      });
    return () => { cancelled = true; };
  }, [favoriteId]);

  useEffect(() => {
    if (!tripId) {
      setDays(null);
      setDaysLoading(false);
      setDayNum('');
      return;
    }
    let cancelled = false;
    setDaysLoading(true);
    setDayNum('');
    apiFetch<{ days?: DayBrief[] }>(`/trips/${encodeURIComponent(tripId)}`)
      .then((data) => {
        if (cancelled) return;
        const dayList = data.days ?? [];
        setDays(dayList);
        setDaysLoading(false);
        if (dayList.length > 0) setDayNum(dayList[0]!.dayNum);
      })
      .catch(() => {
        if (cancelled) return;
        setDays([]);
        setDaysLoading(false);
      });
    return () => { cancelled = true; };
  }, [tripId]);

  // Backend TIME_RE 同 functions/api/_poi-defaults.ts
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

  const canSubmit = useMemo(() => {
    if (!favorite || !tripId || dayNum === '' || daysLoading || submitting) return false;
    if (startTime && !TIME_RE.test(startTime)) return false;
    if (endTime && !TIME_RE.test(endTime)) return false;
    return true;
  }, [favorite, tripId, dayNum, daysLoading, startTime, endTime, submitting]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiFetch(`/poi-favorites/${favoriteId}/add-to-trip`, {
        method: 'POST',
        body: JSON.stringify({
          tripId,
          dayNum: Number(dayNum),
          startTime: startTime || undefined,
          endTime: endTime || undefined,
        }),
      });
      const params = new URLSearchParams({ selected: tripId, day: String(dayNum), saved_added: '1' });
      navigate(`/trips?${params.toString()}`, { replace: true });
    } catch (err) {
      // 409 conflict → 開 ConflictModal 顯示衝突資訊（4-field schema 下，user 改時段重 submit）
      if (err instanceof ApiError && err.status === 409) {
        const payload = err.payload as { conflictWith?: ConflictWith } | undefined;
        if (payload?.conflictWith) {
          setConflictPayload(payload.conflictWith);
          setSubmitting(false);
          return;
        }
      }
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : '加入失敗';
      setSubmitError(msg);
      setSubmitting(false);
    }
  }, [canSubmit, favoriteId, tripId, dayNum, startTime, endTime, navigate]);

  const handleConflictCancel = useCallback(() => {
    setConflictPayload(null);
  }, []);

  // ========== Render ==========

  let mainContent: React.ReactElement;
  if (loadError) {
    mainContent = (
      <div className="tp-error" role="alert" data-testid="favorites-add-to-trip-load-error">
        {loadError}
      </div>
    );
  } else if (!favorite || !trips) {
    mainContent = (
      <div
        className="tp-favorites-add-to-trip"
        aria-busy="true"
        aria-label="載入中"
        data-testid="favorites-add-to-trip-loading"
      >
        <div className="tp-skel" />
        <div className="tp-skel" />
        <div className="tp-skel" />
      </div>
    );
  } else if (trips.length === 0) {
    mainContent = (
      <div className="tp-favorites-add-to-trip">
        <div className="tp-poi-summary">
          <h3>{favorite.poiName ?? '景點'}</h3>
          {favorite.poiAddress && <p>{favorite.poiAddress}</p>}
        </div>
        <div className="tp-empty-cta" data-testid="favorites-add-to-trip-empty">
          <p>你還沒有任何行程</p>
          <a href="/trips/new">建立第一個行程</a>
        </div>
      </div>
    );
  } else {
    mainContent = (
      <div className="tp-favorites-add-to-trip">
        <div className="tp-poi-summary">
          <h3>{favorite.poiName ?? '景點'}</h3>
          {favorite.poiAddress && <p>{favorite.poiAddress}</p>}
          {favorite.note && <p>備註：{favorite.note}</p>}
        </div>

        {submitError && (
          <div className="tp-error" role="alert" data-testid="favorites-add-to-trip-error">
            {submitError}
          </div>
        )}

        <div className="tp-form-grid-2col">
          <div className="tp-form-row">
            <label htmlFor="atstr-trip">行程</label>
            <select
              id="atstr-trip"
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
              data-testid="favorites-add-to-trip-trip"
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
            {daysLoading ? (
              <div className="tp-skel" data-testid="favorites-add-to-trip-day-skeleton" />
            ) : (
              <select
                id="atstr-day"
                value={String(dayNum)}
                onChange={(e) => setDayNum(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={!days || days.length === 0}
                data-testid="favorites-add-to-trip-day"
              >
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
            )}
          </div>

          <div className="tp-form-row-pair">
            <div className="tp-form-row">
              <label htmlFor="atstr-start">開始時間（可空，依景點類型自動推）</label>
              <input
                id="atstr-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                data-testid="favorites-add-to-trip-start"
              />
            </div>

            <div className="tp-form-row">
              <label htmlFor="atstr-end">結束時間（可空，依停留時間預估推）</label>
              <input
                id="atstr-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                data-testid="favorites-add-to-trip-end"
              />
            </div>
          </div>
        </div>

        <div className="tp-form-actions">
          <button
            type="button"
            className="tp-btn tp-btn--primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="favorites-add-to-trip-submit"
          >
            {submitting ? '加入中…' : '加入行程'}
          </button>
        </div>
      </div>
    );
  }

  const main = (
    <div className="tp-app">
      <style>{SCOPED_STYLES}</style>
      <TitleBar title="加入行程" back={goBack} />
      <main className="tp-page-content">
        {mainContent}
      </main>
      <ConflictModal
        open={!!conflictPayload}
        conflictWith={conflictPayload}
        busy={false}
        onCancel={handleConflictCancel}
      />
    </div>
  );

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      main={main}
      bottomNav={<GlobalBottomNav authed={!!user} />}
    />
  );
}
