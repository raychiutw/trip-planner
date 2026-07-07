/**
 * AddCustomStopPage — mobile fullpage for adding a custom-coord stop.
 *
 * v2.31.94 custom-stop-location-picker.
 *
 * Route: `/trip/:tripId/add-custom-stop?day=N`  (mobile only, ≤1023px via
 * MobileOnlyRoute guard — desktop traffic uses AddStopPage 自訂 tab inline).
 *
 * UX (per docs/design-sessions/2026-05-18-add-custom-stop/mobile-fullpage.html):
 *   - 標題 (required)
 *   - 地址或地標 typeahead (optional, flyTo affordance)
 *   - LocationPickerMap with center pin + idle listener + arrow-key a11y
 *   - 「已調整到正確位置」hint checkbox (non-blocking nudge)
 *   - 開始時間 / 停留分鐘 / 備註
 *   - 完成 → POST entries + recompute-travel + navigate back
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { apiFetch, apiFetchRaw } from '../lib/apiClient';
import { requestTravelRecompute } from '../lib/travelRecompute';
import { EVENT } from '../lib/events';
import { formatDateLabel } from '../lib/mapDay';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import TitleBarPrimaryAction from '../components/shell/TitleBarPrimaryAction';
import ToastContainer, { showToast } from '../components/shared/Toast';
import { TripTimePicker } from '../components/TripTimePicker';
import { LocationPickerMap } from '../components/trip/LocationPickerMap';
import { usePlacesAutocomplete } from '../hooks/usePlacesAutocomplete';
import { useTypeaheadKeyboard } from '../hooks/useTypeaheadKeyboard';
import {
  selectDefaultCenter,
  isValidCoord,
  type Coord,
} from '../lib/locationPicker';

interface DayApiRow {
  id: number;
  dayNum: number;
  date?: string | null;
  dayOfWeek?: string | null;
  /** v2.33.107 #1: `?all=1` 回 timeline 含 stopPois，用來取 prev entry master coord
   *  做 picker initialCenter pre-fill。 */
  timeline?: TimelineEntryRow[];
}

interface TimelineEntryRow {
  id?: number;
  /** master is sortOrder=1; mapDay shape from backend `_merge.assembleDay`. */
  stopPois?: { lat?: number | null; lng?: number | null; sortOrder?: number | null }[] | null;
}

interface TripDestApi {
  destOrder: number;
  name: string;
  lat?: number | null;
  lng?: number | null;
}

function deriveDayLabel(day: DayApiRow | null, dayNum: number): string {
  if (!day) return `Day ${dayNum}`;
  const date = day.date ?? '';
  const dow = day.dayOfWeek ?? '';
  // v2.33.4: 對齊 mockup「Day 3 · 7/28（一）」M/D 短格式（不再用 ISO 2026-07-31）
  const shortDate = date ? formatDateLabel(date) : '';
  return `Day ${dayNum}${shortDate ? ` · ${shortDate}` : ''}${dow ? `（${dow}）` : ''}`;
}

const SCOPED_STYLES = `
  .tp-custom-stop-shell {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    background: var(--color-background);
  }
  .tp-custom-stop-day-meta {
    padding: 10px 20px;
    background: var(--color-tertiary);
    border-bottom: 1px solid var(--color-border);
    font-size: var(--font-size-footnote);
    color: var(--color-muted);
  }
  .tp-custom-stop-day-meta strong { color: var(--color-foreground); font-weight: 600; }
  /* 2026-07-07 day picker chips — 對齊 AddStopPage v2.31.99 同款（user 要求
   * 新增景點可選加入哪天；本頁原本 URL ?day 鎖死不可切）。 */
  .tp-add-stop-daypicker {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px 20px 0;
  }
  .tp-add-stop-daypicker-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 14px;
    min-height: 48px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    font: inherit;
    color: var(--color-foreground);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .tp-add-stop-daypicker-chip:hover { background: var(--color-hover); }
  .tp-add-stop-daypicker-chip.is-active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-accent-foreground);
  }
  .tp-add-stop-daypicker-chip-num {
    font-size: var(--font-size-caption);
    font-weight: 700;
    line-height: 1.2;
  }
  .tp-add-stop-daypicker-chip-date {
    font-size: var(--font-size-caption2);
    opacity: 0.85;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }
  .tp-custom-stop-form { display: flex; flex-direction: column; }
  .tp-custom-stop-field {
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border);
  }
  .tp-custom-stop-field:last-child { border-bottom: none; }
  .tp-custom-stop-label {
    display: block;
    font-size: var(--font-size-caption);
    line-height: 16px;
    font-weight: 600;
    color: var(--color-muted);
    margin-bottom: 6px;
  }
  .tp-custom-stop-label-required::after {
    content: ' *';
    color: var(--color-destructive);
  }
  /* v2.33.22 cleanup: .tp-custom-stop-input 規則移除 — title input 已切到
     .tp-input-long（tokens.css @layer base）。 */
  .tp-custom-stop-textarea {
    width: 100%;
    min-height: 64px;
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
    color: var(--color-foreground);
    font-size: var(--font-size-body);
    outline: none;
    resize: vertical;
    font-family: inherit;
    line-height: 1.5;
  }
  .tp-custom-stop-help {
    margin-top: 6px;
    font-size: var(--font-size-footnote);
    color: var(--color-muted);
    line-height: 1.5;
  }
  .tp-custom-stop-row-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .tp-custom-stop-typeahead-wrap { position: relative; }
  .tp-custom-stop-typeahead-list {
    margin-top: 4px;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    overflow: hidden;
  }
  .tp-custom-stop-typeahead-item {
    padding: 10px 12px;
    border-bottom: 1px solid var(--color-border);
    cursor: pointer;
    background: none;
    border-left: none;
    border-right: none;
    border-top: none;
    width: 100%;
    text-align: left;
    color: var(--color-foreground);
  }
  .tp-custom-stop-typeahead-item:last-child { border-bottom: none; }
  .tp-custom-stop-typeahead-item:hover,
  .tp-custom-stop-typeahead-item:focus,
  .tp-custom-stop-typeahead-item.is-focused {
    background: var(--color-accent-subtle);
    outline: none;
  }
  .tp-custom-stop-typeahead-main {
    font-size: var(--font-size-subheadline);
    font-weight: 500;
    color: var(--color-foreground);
  }
  .tp-custom-stop-typeahead-sub {
    font-size: var(--font-size-footnote);
    color: var(--color-muted);
    margin-top: 2px;
  }
  .tp-custom-picker-wrap {
    position: relative;
    width: 100%;
    height: 280px;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--color-secondary);
    border: 1px solid var(--color-border);
  }
  .tp-custom-picker-map {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .tp-custom-picker-map:focus-visible {
    outline: 3px solid var(--color-accent);
    outline-offset: -3px;
  }
  .tp-custom-picker-pin {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -100%);
    width: 32px;
    height: 40px;
    pointer-events: none;
    filter: drop-shadow(0 2px 4px rgba(42, 31, 24, 0.25));
    z-index: 5;
  }
  .tp-custom-picker-pin svg { width: 100%; height: 100%; display: block; }
  .tp-custom-picker-coord {
    position: absolute;
    left: 8px;
    top: 8px;
    font-size: var(--font-size-caption2);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--color-foreground);
    background: rgba(255, 251, 245, 0.92);
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm);
    z-index: 6;
  }
  .tp-custom-picker-error {
    padding: 12px 14px;
    background: var(--color-destructive-bg);
    color: var(--color-destructive);
    border-radius: var(--radius-md);
    font-size: var(--font-size-footnote);
    text-align: center;
  }
  .tp-custom-stop-hint {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: var(--color-accent-subtle);
    border: 1px solid var(--color-accent-bg);
    border-radius: var(--radius-md);
    margin-top: 12px;
  }
  .tp-custom-stop-hint-checkbox {
    appearance: none;
    width: 20px;
    height: 20px;
    border: 2px solid var(--color-line-strong);
    border-radius: var(--radius-sm);
    cursor: pointer;
    position: relative;
    flex-shrink: 0;
    background: var(--color-background);
    margin: 0;
  }
  .tp-custom-stop-hint-checkbox:checked {
    background: var(--color-accent);
    border-color: var(--color-accent);
  }
  .tp-custom-stop-hint-checkbox:checked::after {
    content: '';
    position: absolute;
    left: 5px;
    top: 2px;
    width: 5px;
    height: 10px;
    border: solid var(--color-accent-foreground);
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }
  .tp-custom-stop-hint-text {
    font-size: var(--font-size-footnote);
    color: var(--color-foreground);
    line-height: 1.4;
  }
  .tp-custom-stop-hint-text strong { font-weight: 600; }
  .tp-custom-stop-error {
    margin: 12px 20px;
    padding: 10px 12px;
    background: var(--color-destructive-bg);
    border-left: 3px solid var(--color-destructive);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-footnote);
    color: var(--color-destructive);
    line-height: 1.4;
  }
`;

export default function AddCustomStopPage() {
  const auth = useRequireAuth();
  const params = useParams<{ tripId: string }>();
  const tripId = params.tripId;
  const [searchParams, setSearchParams] = useSearchParams();
  const dayNum = Number(searchParams.get('day'));
  const handleBack = useNavigateBack(tripId ? `/trip/${encodeURIComponent(tripId)}` : '/trips');

  // 2026-07-07: chips 切天 → URL replaceState（對齊 AddStopPage handlePickDay）。
  // dayNum 變 → days-fetch effect 重算 currentDay + map pre-fill 跟著走。
  const handlePickDay = useCallback((next: number) => {
    if (next === dayNum) return;
    const sp = new URLSearchParams(searchParams);
    sp.set('day', String(next));
    setSearchParams(sp, { replace: true });
  }, [dayNum, searchParams, setSearchParams]);

  const [currentDay, setCurrentDay] = useState<DayApiRow | null>(null);
  // 2026-07-07 day picker：全 days 列表（chips 切天用）。null = 未載入不 render 列。
  const [allDays, setAllDays] = useState<DayApiRow[] | null>(null);
  // v2.32.1 fix: 初值 null 區分「未載入」與「載入後 0 個」，避免 LocationPickerMap
  // 用 Tokyo fallback initialCenter mount 後被鎖死。
  const [destinations, setDestinations] = useState<TripDestApi[] | null>(null);

  useEffect(() => {
    if (!tripId || !Number.isFinite(dayNum)) return;
    let cancelled = false;
    (async () => {
      try {
        // v2.33.107 #1: `?all=1` 回 timeline 讓我們取得 prev entry coord 做
        // picker pre-fill；若 timeline 空（day 還沒 stop）fallback 走 destinations。
        const [days, tripBody] = await Promise.all([
          apiFetch<DayApiRow[]>(`/trips/${encodeURIComponent(tripId)}/days?all=1`),
          apiFetch<{ destinations?: TripDestApi[] }>(`/trips/${encodeURIComponent(tripId)}`),
        ]);
        if (cancelled) return;
        setCurrentDay(days.find((d) => d.dayNum === dayNum) ?? null);
        setAllDays(days);
        setDestinations(tripBody?.destinations ?? []);
      } catch {
        // v2.32.1: network fail → 標 [] 讓 fallback chain 走 Tokyo（最後安全網），
        // 避免 null 永遠卡 render
        if (!cancelled) setDestinations([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId, dayNum]);

  /**
   * v2.33.107 #1: prev-entry coord pre-fill — 取 currentDay.timeline 最後一個 entry
   * 的 master stopPoi (sortOrder=1) lat/lng 作為 picker initialCenter，讓使用者
   * 加新 stop 時地圖預設在 day 最後一個既有 stop 附近（而非 destinations 中心）。
   * Empty timeline / 缺 coord → null fallback 給 destinations / Tokyo。
   */
  const prevEntryCoord = useMemo<Coord | null>(() => {
    const timeline = currentDay?.timeline ?? [];
    for (let i = timeline.length - 1; i >= 0; i--) {
      const stopPois = timeline[i]?.stopPois ?? [];
      const master = stopPois.find((p) => p.sortOrder === 1) ?? stopPois[0];
      if (master && typeof master.lat === 'number' && typeof master.lng === 'number') {
        return { lat: master.lat, lng: master.lng };
      }
    }
    return null;
  }, [currentDay]);

  const initialCenter = useMemo<Coord>(() => {
    return selectDefaultCenter({
      prevEntry: prevEntryCoord,
      tripDestinations: (destinations ?? [])
        .filter((d) => typeof d.lat === 'number' && typeof d.lng === 'number')
        .map((d) => ({ lat: d.lat!, lng: d.lng! })),
    });
  }, [prevEntryCoord, destinations]);

  const [pickedCoord, setPickedCoord] = useState<Coord | null>(null);
  const [flyToSignal, setFlyToSignal] = useState<{ coord: Coord; zoom?: number } | null>(null);
  const [hintConfirmed, setHintConfirmed] = useState(false);

  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const typeahead = usePlacesAutocomplete();

  const handlePickSuggestion = useCallback(
    async (placeId: string) => {
      const closingToken = typeahead.pickSuggestion(placeId);
      try {
        const qs = new URLSearchParams({ placeId });
        if (closingToken) qs.set('sessionToken', closingToken);
        const res = await apiFetchRaw(`/places/resolve?${qs.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as { lat: number; lng: number };
        if (!isValidCoord({ lat: data.lat, lng: data.lng })) return;
        setFlyToSignal({ coord: { lat: data.lat, lng: data.lng }, zoom: 15 });
      } catch {
        // Silent — user can still drag map manually.
      }
    },
    [typeahead],
  );

  // v2.31.94 a11y: ARIA combobox keyboard nav (Arrow/Enter/Escape) for typeahead.
  const typeaheadKb = useTypeaheadKeyboard({
    listId: 'add-custom-stop-suggestions',
    options: typeahead.predictions,
    onPick: (p) => void handlePickSuggestion(p.placeId),
  });

  const handleConfirm = useCallback(async () => {
    if (submitting || !tripId || !Number.isFinite(dayNum)) return;
    setSubmitError(null);

    if (!title.trim()) {
      setSubmitError('請輸入標題');
      return;
    }
    if (!pickedCoord || !isValidCoord(pickedCoord)) {
      setSubmitError('請先在地圖上選擇位置');
      return;
    }

    setSubmitting(true);
    try {
      const noteParts = [duration && `${duration} 分`, note.trim()].filter(Boolean);
      const body = {
        name: title.trim(),
        time: startTime || undefined,
        note: noteParts.length > 0 ? noteParts.join(' · ') : undefined,
        lat: pickedCoord.lat,
        lng: pickedCoord.lng,
        source: 'custom',
      };
      const res = await apiFetchRaw(
        `/trips/${encodeURIComponent(tripId)}/days/${dayNum}/entries`,
        {
          method: 'POST',
          credentials: 'same-origin',
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(`儲存失敗 (${res.status})`);

      void requestTravelRecompute(tripId, dayNum).catch(() => undefined);

      window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, { detail: { tripId, dayNum } }));
      showToast('已加入自訂景點', 'success');
      handleBack();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, tripId, dayNum, title, pickedCoord, duration, note, startTime, handleBack]);

  if (!auth.user) return null;
  if (!tripId || !Number.isFinite(dayNum)) {
    return (
      <AppShell
        sidebar={<DesktopSidebarConnected />}
        main={
          <div className="tp-custom-stop-shell" data-testid="add-custom-stop-page">
            <TitleBar title="自訂景點" back={handleBack} backLabel="返回" />
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-muted)' }}>
              無效的行程或日期參數
            </div>
          </div>
        }
        bottomNav={<GlobalBottomNav authed={auth.user !== null} />}
      />
    );
  }

  const dayLabel = deriveDayLabel(currentDay, dayNum);

  const titleBarActions = (
    <TitleBarPrimaryAction
      label="完成"
      busyLabel="加入中⋯"
      busy={submitting}
      disabled={submitting || !title.trim() || !pickedCoord}
      onClick={() => void handleConfirm()}
      testId="add-custom-stop-confirm"
    />
  );

  return (
    <>
      <ToastContainer />
      <AppShell
        sidebar={<DesktopSidebarConnected />}
        main={
          <div className="tp-custom-stop-shell" data-testid="add-custom-stop-page">
            <style>{SCOPED_STYLES}</style>
            <TitleBar title="自訂景點" back={handleBack} backLabel="返回" actions={titleBarActions} />
            <div className="tp-custom-stop-day-meta">{dayLabel}</div>

            {/* 2026-07-07 day picker chips — 可切換加入哪天（對齊 AddStopPage）。 */}
            {allDays && allDays.length > 0 && (
              <div
                className="tp-add-stop-daypicker"
                role="tablist"
                aria-label="選擇加入哪天"
                data-testid="add-custom-stop-daypicker"
              >
                {allDays.map((d) => {
                  const isActive = d.dayNum === dayNum;
                  const mmdd = (d.date ?? '').slice(5).replace('-', '/');
                  return (
                    <button
                      key={d.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`tp-add-stop-daypicker-chip ${isActive ? 'is-active' : ''}`}
                      onClick={() => handlePickDay(d.dayNum)}
                      data-testid={`add-custom-stop-daypicker-chip-${d.dayNum}`}
                    >
                      <span className="tp-add-stop-daypicker-chip-num">DAY {String(d.dayNum).padStart(2, '0')}</span>
                      {mmdd && <span className="tp-add-stop-daypicker-chip-date">{mmdd}{d.dayOfWeek ? `（${d.dayOfWeek}）` : ''}</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {submitError && (
              <div className="tp-custom-stop-error" data-testid="add-custom-stop-error">
                {submitError}
              </div>
            )}

            <div className="tp-custom-stop-form">
              <div className="tp-custom-stop-field">
                <label className="tp-custom-stop-label tp-custom-stop-label-required" htmlFor="cs-title">
                  標題
                </label>
                <input
                  id="cs-title"
                  type="text"
                  className="tp-input-long"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：外婆家、朋友推薦的隱藏景點"
                  data-testid="add-custom-stop-title"
                />
              </div>

              <div className="tp-custom-stop-field">
                <label className="tp-custom-stop-label" htmlFor="cs-address">
                  地址或地標
                </label>
                <div className="tp-custom-stop-typeahead-wrap">
                  <input
                    id="cs-address"
                    type="text"
                    className="tp-custom-stop-input"
                    value={typeahead.query}
                    onChange={(e) => typeahead.setQuery(e.target.value)}
                    placeholder="輸入地址縮放地圖（選填）"
                    autoComplete="off"
                    data-testid="add-custom-stop-address-typeahead"
                    {...typeaheadKb.inputProps}
                  />
                  {typeahead.predictions.length > 0 && (
                    <div
                      id="add-custom-stop-suggestions"
                      className="tp-custom-stop-typeahead-list"
                      role="listbox"
                    >
                      {typeahead.predictions.map((p, i) => {
                        const focused = typeaheadKb.focusedIndex === i;
                        return (
                          <button
                            key={p.placeId}
                            id={typeaheadKb.getOptionId(i)}
                            type="button"
                            role="option"
                            aria-selected={focused}
                            className={`tp-custom-stop-typeahead-item${focused ? ' is-focused' : ''}`}
                            onClick={() => void handlePickSuggestion(p.placeId)}
                            data-testid={`add-custom-stop-suggestion-${p.placeId}`}
                          >
                            <div className="tp-custom-stop-typeahead-main">{p.primaryText}</div>
                            {p.secondaryText && (
                              <div className="tp-custom-stop-typeahead-sub">{p.secondaryText}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="tp-custom-stop-help">選填 — 用來把地圖縮放到大概區域，最終位置仍以地圖中心為準。</div>
              </div>

              <div className="tp-custom-stop-field">
                <label className="tp-custom-stop-label">位置 *</label>
                {/* v2.32.1 fix: destinations 還沒載完先 placeholder，避免地圖鎖
                    Tokyo fallback center。 */}
                {destinations === null ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-muted)' }}>
                    載入中⋯
                  </div>
                ) : (
                  <LocationPickerMap
                    initialCenter={initialCenter}
                    initialZoom={14}
                    onCoordChange={setPickedCoord}
                    flyToSignal={flyToSignal}
                  />
                )}
                <div className="tp-custom-stop-hint">
                  <input
                    type="checkbox"
                    id="cs-hint"
                    className="tp-custom-stop-hint-checkbox"
                    checked={hintConfirmed}
                    onChange={(e) => setHintConfirmed(e.target.checked)}
                    data-testid="add-custom-stop-hint"
                  />
                  <label htmlFor="cs-hint" className="tp-custom-stop-hint-text">
                    <strong>已調整到正確位置</strong> — 拖地圖或用方向鍵微調
                  </label>
                </div>
              </div>

              <div className="tp-custom-stop-field">
                <label className="tp-custom-stop-label">時間（選填）</label>
                <div className="tp-custom-stop-row-2col">
                  <div data-testid="add-custom-stop-time">
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 4 }}>開始</div>
                    <TripTimePicker
                      value={startTime}
                      onChange={setStartTime}
                      ariaLabel="開始時間"
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 4 }}>停留（分鐘）</div>
                    <input
                      type="number"
                      className="tp-input-short"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="60"
                      data-testid="add-custom-stop-duration"
                    />
                  </div>
                </div>
              </div>

              <div className="tp-custom-stop-field">
                <label className="tp-custom-stop-label" htmlFor="cs-note">
                  備註
                </label>
                <textarea
                  id="cs-note"
                  className="tp-custom-stop-textarea"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="（選填）"
                  data-testid="add-custom-stop-note"
                />
              </div>
            </div>
          </div>
        }
        bottomNav={<GlobalBottomNav authed={auth.user !== null} />}
      />
    </>
  );
}
