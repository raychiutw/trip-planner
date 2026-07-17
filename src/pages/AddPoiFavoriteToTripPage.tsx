/**
 * AddPoiFavoriteToTripPage — 全頁 form 將「收藏」加入指定 trip / day。
 * Route: /favorites/:id/add-to-trip。
 * v2.22.0 改 4-field 純時間驅動：{ tripId, dayNum, startTime, endTime }。
 * 不再含 position radio / anchorEntryId — server 依 startTime 自動排 sort_order。
 *
 * mockup-driven hard gate aligned (docs/design-sessions/2026-05-04-favorites-redesign.html v4
 * sign-off 2026-05-04，frame B1/B2/B3)。對齊 DESIGN.md L580-602 規範。
 *
 * Mockup classes：tp-form-poi-summary / tp-form / tp-form-field / tp-form-label /
 * tp-form-select / tp-form-input.tabular / tp-form-help / tp-form-actions / tp-action-btn。
 *
 * Hits fast-path POST /api/poi-favorites/:id/add-to-trip — travel_* 由背景 tp-request 之後算。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import TitleBar from '../components/shell/TitleBar';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import ConflictModal, { type ConflictWith } from '../components/shared/ConflictModal';
import PageErrorState from '../components/shared/PageErrorState';
import EmptyState from '../components/shared/EmptyState';
import { TripSelect } from '../components/TripSelect';
import { TripTimePicker } from '../components/TripTimePicker';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { apiFetch } from '../lib/apiClient';
import { requestTravelRecompute } from '../lib/travelRecompute';
import { ApiError } from '../lib/errors';
import { POI_TYPE_LABELS, mapGooglePrimaryTypeToPoiType, type PoiType } from '../lib/poiCategory';
import { poiTypeToTone } from '../lib/timelineUtils';
import type { PoiFavorite } from '../types/api';

interface TripBrief {
  tripId: string;
  name?: string;
  title?: string | null;
  totalDays?: number;
}

interface DayBrief {
  dayNum: number;
  date: string;
  label: string | null;
}

/** trip dropdown 顯示文字：title 優先，其次 name，fallback tripId。
 *  v2.31.55 fix：原本 name 優先 → user 在 trips list 看到 user-set
 *  「2026 沖繩七日遊」但加入收藏 dropdown 顯示 backend auto-generated
 *  「Hui Yun 的沖繩之旅」(name)，跨頁面 label 不一致。對齊 TripsListPage
 *  line 1088 / TripPickerPopover / ChatPage / MapPage / GlobalMapPage
 *  4 處同樣 `title || name || tripId` pattern。 */
// 後端 TIME_RE 同 functions/api/_time.ts；前端 defense-in-depth，防 legacy browser 把
// type=time 退回 text、autofill 注入非 HH:MM、或測試直接 setState 髒值。module-level 常數
// （不在 render 內重建，否則 canSubmit 的 useMemo 依賴會每 render 變動）。
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function tripDisplayName(t: TripBrief): string {
  return t.title?.trim() || t.name?.trim() || t.tripId;
}

const SCOPED_STYLES = `
/* page wrapper: 防 mobile 手指 horizontal scroll 出 viewport
   （grid item min-width: auto 預設會被 child content 撐爆 grid track，連帶 page 可左右滑）。
   overflow-x: clip 比 hidden 好（不創 scroll context、不影響 sticky positioning）。 */
.tp-favorites-add-to-trip {
  display: flex; flex-direction: column; gap: 16px;
  max-width: 720px; width: 100%; margin: 0 auto;
  padding: 16px;
  overflow-x: clip;
}
@media (max-width: 760px) {
  .tp-favorites-add-to-trip { padding: 12px; gap: 14px; }
}

/* POI summary block (mockup B1) — bg + border-left 依加收藏 POI 類型上 tone
   （玩看買=柔褐、住移動=sage、吃=粉）；neutral/未匹配 fallback 回 accent 柔褐 */
/* v2.55.89 V3 Phase 2：POI summary 改 neutral surface；--tone-subtle→中性 secondary、
   --tone（左邊框）保留柔褐 accent。顯式設避免被有設 --tone-* 的祖先繼承汙染。 */
.tp-favorites-add-to-trip .tp-form-poi-summary[data-tone="accent"],
.tp-favorites-add-to-trip .tp-form-poi-summary[data-tone="sage"],
.tp-favorites-add-to-trip .tp-form-poi-summary[data-tone="pink"],
.tp-favorites-add-to-trip .tp-form-poi-summary[data-tone="neutral"] { --tone: var(--color-accent); --tone-deep: var(--color-accent-deep); --tone-subtle: var(--color-secondary); }
.tp-favorites-add-to-trip .tp-form-poi-summary {
  display: flex; flex-direction: column; gap: 4px;
  padding: 14px 16px;
  background: var(--tone-subtle, var(--color-accent-subtle));
  border-left: 3px solid var(--tone, var(--color-accent));
  border-radius: var(--radius-md);
}
.tp-favorites-add-to-trip .tp-form-poi-summary-eyebrow {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--tone-deep, var(--color-accent-deep));
}
.tp-favorites-add-to-trip .tp-form-poi-summary-title {
  font-size: var(--font-size-callout); font-weight: 700;
  color: var(--color-foreground);
  /* 長 POI 名（中文沒空格 break 點）會把 flex 容器撐爆 → 觸發 page horizontal scroll */
  overflow-wrap: anywhere;
  word-break: break-word;
}
.tp-favorites-add-to-trip .tp-form-poi-summary-meta {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* Form */
.tp-favorites-add-to-trip .tp-form {
  display: flex; flex-direction: column; gap: 16px;
}
.tp-favorites-add-to-trip .tp-form-grid-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 16px;
}
@media (max-width: 760px) {
  .tp-favorites-add-to-trip .tp-form-grid-2col { grid-template-columns: 1fr; gap: 12px; }
}

.tp-favorites-add-to-trip .tp-form-field {
  display: flex; flex-direction: column; gap: 6px;
  /* grid item 預設 min-width: auto — 子 select/input 內含長 text（如 trip name）
     會把 grid track 撐爆 viewport。設 min-width: 0 讓 grid track 縮回 1fr 大小。 */
  min-width: 0;
}
.tp-favorites-add-to-trip .tp-form-label {
  font-size: var(--font-size-footnote); font-weight: 600;
  color: var(--color-foreground);
}
/* v2.33.22 cleanup: page-scoped .tp-form-select / .tp-form-input CSS rules
   全 移除 — v2.33.17 (select to TripSelect) + v2.33.21 (time input to
   TripTimePicker) 後本頁無 native select / time input；text input 用
   :where() base layer (DESIGN.md, tokens.css)。 */

.tp-favorites-add-to-trip .tp-form-help {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
}

/* Submit button (mockup .tp-action-btn) */
.tp-favorites-add-to-trip .tp-form-actions {
  margin-top: 8px;
  display: flex; justify-content: center;
}
.tp-favorites-add-to-trip .tp-action-btn {
  font: inherit; font-weight: 700; font-size: var(--font-size-subheadline);
  padding: 12px 28px; border-radius: var(--radius-full);
  background: var(--color-accent); color: var(--color-accent-foreground);
  border: 1px solid var(--color-accent);
  cursor: pointer; min-height: var(--spacing-tap-min);
  min-width: 200px;
}
.tp-favorites-add-to-trip .tp-action-btn:hover:not(:disabled) {
  filter: brightness(0.95);
}
.tp-favorites-add-to-trip .tp-action-btn:disabled {
  opacity: 0.55; cursor: not-allowed;
}
@media (max-width: 760px) {
  .tp-favorites-add-to-trip .tp-action-btn { width: 100%; }
}

/* Day skeleton */
.tp-favorites-add-to-trip .tp-skel {
  background: var(--color-tertiary);
  border-radius: var(--radius-md); height: 44px;
  animation: tp-pulse 1.4s ease-in-out infinite;
}
@keyframes tp-pulse { 0%,100% { opacity: 1; } 50% { opacity: .55; } }
@media (prefers-reduced-motion: reduce) {
  .tp-favorites-add-to-trip .tp-skel { animation: none; }
}

/* Empty no-trip */
.tp-favorites-add-to-trip .tp-empty-cta {
  text-align: center; padding: 40px 24px; color: var(--color-muted);
  border: 1px dashed var(--color-border); border-radius: var(--radius-lg);
}
.tp-favorites-add-to-trip .tp-empty-cta a {
  display: inline-block; margin-top: 12px;
  padding: 10px 20px; border-radius: var(--radius-md);
  background: var(--color-accent); color: var(--color-accent-foreground);
  text-decoration: none; font-weight: 600;
}

/* Submit error */
.tp-favorites-add-to-trip .tp-error {
  padding: 12px 16px; border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  color: var(--color-danger); border: 1px solid var(--color-danger);
  font-size: var(--font-size-footnote);
}
`;

export default function AddPoiFavoriteToTripPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const favoriteId = Number(idParam);
  // v2.23.8: direct mode — 從 ExplorePage ➕ 加入行程 進來，無 favorite，POI 走 query params
  // route /add-to-trip?place_id=X&name=Y&lat=Z&lng=W&address=A&category=C
  // 有 idParam → favorite mode（走 /api/poi-favorites/:id/add-to-trip rate-limit + companion gate）
  // 無 idParam → direct mode（走 /api/trips/:tripId/days/:dayNum/entries 直建 entry）
  const isDirectMode = !idParam;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const goBack = useNavigateBack(isDirectMode ? '/explore' : '/favorites');

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

  // Direct mode：從 query params 解 POI；用同一 favorite shape pattern 餵 form summary 區塊
  const directPoi = useMemo<PoiFavorite | null>(() => {
    if (!isDirectMode) return null;
    const placeId = searchParams.get('place_id') ?? '';
    const name = searchParams.get('name') ?? '';
    const lat = Number(searchParams.get('lat'));
    const lng = Number(searchParams.get('lng'));
    if (!placeId || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      id: 0, // sentinel — direct mode 不對應 favorite row
      poiId: 0,
      poiName: name,
      poiAddress: searchParams.get('address') || null,
      poiType: searchParams.get('category') || null,
      favoritedAt: '',
      note: null,
      poiLat: lat,
      poiLng: lng,
    } as PoiFavorite;
  }, [isDirectMode, searchParams]);

  useEffect(() => {
    if (isDirectMode) {
      // direct mode：不打 /poi-favorites endpoint
      if (!directPoi) {
        setLoadError('景點資料缺漏，請從探索頁重新進入');
        return;
      }
      let cancelled = false;
      apiFetch<TripBrief[] | { trips?: TripBrief[] }>('/my-trips')
        .then((tripsResp) => {
          if (cancelled) return;
          setFavorite(directPoi);
          const tripsList = Array.isArray(tripsResp) ? tripsResp : tripsResp.trips ?? [];
          setTrips(tripsList);
          if (tripsList.length === 1) setTripId(tripsList[0]!.tripId);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setLoadError(err instanceof Error ? err.message : '載入失敗');
        });
      return () => { cancelled = true; };
    }

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
  }, [favoriteId, isDirectMode, directPoi]);

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
    // 改打 /trips/:id/days array endpoint — `/trips/:id` 只回 trip meta，不含 days
    apiFetch<DayBrief[]>(`/trips/${encodeURIComponent(tripId)}/days`)
      .then((data) => {
        if (cancelled) return;
        const dayList = Array.isArray(data) ? data : [];
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
      if (isDirectMode && favorite) {
        // direct mode：POI 從 explore 帶來，沒對應 favorite → 直接 POST entries（同 AddStopPage 'search' tab）。
        // entries.ts 後端只認 body.time（"HH:MM-HH:MM" 單欄位），需在前端 join。
        const time = startTime && endTime ? `${startTime}-${endTime}` : undefined;
        await apiFetch(`/trips/${encodeURIComponent(tripId)}/days/${dayNum}/entries`, {
          method: 'POST',
          body: JSON.stringify({
            name: favorite.poiName,
            note: favorite.poiAddress || undefined,
            lat: favorite.poiLat,
            lng: favorite.poiLng,
            source: 'google',
            time,
            poi_type: mapGooglePrimaryTypeToPoiType(favorite.poiType),
          }),
        });
        // recompute travel for this day (fire-and-forget；同 v2.23.1 AddStopPage pattern)
        void requestTravelRecompute(tripId, dayNum).catch(() => undefined);
      } else {
        await apiFetch(`/poi-favorites/${favoriteId}/add-to-trip`, {
          method: 'POST',
          body: JSON.stringify({
            tripId,
            dayNum: Number(dayNum),
            startTime: startTime || undefined,
            endTime: endTime || undefined,
          }),
        });
      }
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
      setSubmitError(err instanceof Error ? err.message : '加入失敗');
      setSubmitting(false);
    }
  }, [canSubmit, favoriteId, tripId, dayNum, startTime, endTime, navigate, isDirectMode, favorite]);

  const handleConflictCancel = useCallback(() => {
    setConflictPayload(null);
  }, []);

  const onFormSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void handleSubmit();
  }, [handleSubmit]);

  // POI summary 對應 mockup B1 — eyebrow + title + meta（type 中文 + 收藏中 / address）
  const poiTypeLabel = favorite?.poiType
    ? POI_TYPE_LABELS[favorite.poiType as PoiType] ?? favorite.poiType
    : '';
  const poiEyebrow = poiTypeLabel ? `${poiTypeLabel} · 收藏中` : '收藏中';

  // ========== Render ==========

  let mainContent: React.ReactElement;
  if (loadError) {
    mainContent = (
      <PageErrorState
        title="載入失敗"
        message={loadError}
        retryLabel={null}
        className="tp-error"
        testId="favorites-add-to-trip-load-error"
      />
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
        <div className="tp-form-poi-summary" data-tone={poiTypeToTone(mapGooglePrimaryTypeToPoiType(favorite.poiType))}>
          <span className="tp-form-poi-summary-eyebrow">{poiEyebrow}</span>
          <span className="tp-form-poi-summary-title">{favorite.poiName ?? '景點'}</span>
          {favorite.poiAddress && (
            <span className="tp-form-poi-summary-meta">{favorite.poiAddress}</span>
          )}
        </div>
        <EmptyState
          title="你還沒有任何行程"
          ctaLabel="建立第一個行程"
          ctaHref="/trips/new"
          className="tp-empty-cta"
          testId="favorites-add-to-trip-empty"
        />
      </div>
    );
  } else {
    const selectedDay = days?.find((d) => d.dayNum === dayNum);
    mainContent = (
      <div className="tp-favorites-add-to-trip">
        <div className="tp-form-poi-summary" data-tone={poiTypeToTone(mapGooglePrimaryTypeToPoiType(favorite.poiType))}>
          <span className="tp-form-poi-summary-eyebrow">{poiEyebrow}</span>
          <span className="tp-form-poi-summary-title">{favorite.poiName ?? '景點'}</span>
          {favorite.poiAddress && (
            <span className="tp-form-poi-summary-meta">{favorite.poiAddress}</span>
          )}
          {favorite.note && (
            <span className="tp-form-poi-summary-meta">備註：{favorite.note}</span>
          )}
        </div>

        {submitError && (
          <div className="tp-error" role="alert" data-testid="favorites-add-to-trip-error">
            {submitError}
          </div>
        )}

        <form
          className="tp-form"
          aria-label="加入行程表單"
          onSubmit={onFormSubmit}
        >
          <div className="tp-form-grid-2col">
            <div className="tp-form-field" data-testid="favorites-add-to-trip-trip">
              <label className="tp-form-label" htmlFor="atstr-trip">行程</label>
              <TripSelect
                id="atstr-trip"
                value={tripId}
                onChange={setTripId}
                placeholder="選擇行程…"
                ariaLabel="行程"
                options={trips.map((t) => ({
                  value: t.tripId,
                  label: `${tripDisplayName(t)}${t.totalDays ? ` · ${t.totalDays} 天` : ''}`,
                }))}
              />
            </div>

            <div className="tp-form-field">
              <label className="tp-form-label" htmlFor="atstr-day">天數</label>
              {daysLoading ? (
                <div
                  className="tp-skel"
                  data-testid="favorites-add-to-trip-day-skeleton"
                  aria-busy="true"
                  aria-live="polite"
                />
              ) : (
                <div data-testid="favorites-add-to-trip-day">
                  <TripSelect<string>
                    id="atstr-day"
                    value={String(dayNum)}
                    onChange={(v) => setDayNum(v === '' ? '' : Number(v))}
                    disabled={!days || days.length === 0}
                    placeholder={days && days.length === 0 ? '該行程沒有天數' : '選擇天數…'}
                    ariaLabel="天數"
                    options={
                      days && days.length > 0
                        ? days.map((d) => ({
                            value: String(d.dayNum),
                            label: `Day ${d.dayNum}${d.label ? ` · ${d.label}` : ''} (${d.date})`,
                          }))
                        : []
                    }
                  />
                </div>
              )}
              {selectedDay?.label && (
                <span className="tp-form-help">{selectedDay.label}</span>
              )}
            </div>

            <div className="tp-form-field" data-testid="favorites-add-to-trip-start">
              <label className="tp-form-label" htmlFor="atstr-start">開始時間</label>
              <TripTimePicker
                id="atstr-start"
                value={startTime}
                onChange={setStartTime}
                ariaLabel="開始時間"
              />
              <span className="tp-form-help">可空 — 依景點類型自動推算</span>
            </div>

            <div className="tp-form-field" data-testid="favorites-add-to-trip-end">
              <label className="tp-form-label" htmlFor="atstr-end">結束時間</label>
              <TripTimePicker
                id="atstr-end"
                value={endTime}
                onChange={setEndTime}
                ariaLabel="結束時間"
              />
              <span className="tp-form-help">可空 — 依停留時間自動推算</span>
            </div>
          </div>

          <div className="tp-form-actions">
            <button
              type="submit"
              className="tp-action-btn"
              disabled={!canSubmit}
              data-testid="favorites-add-to-trip-submit"
            >
              {submitting ? '加入中…' : '加入行程'}
            </button>
          </div>
        </form>
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
      bottomNav={<GlobalBottomNav authed={user !== null} />}
    />
  );
}
