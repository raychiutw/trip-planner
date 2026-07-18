/**
 * AddEntryPage — v2.32.0 新增景點全頁 form。
 *
 * Route: `/trip/:tripId/add-entry?day=N`（day optional，預設 day 1）
 *
 * UX：對齊 EditEntryPage 形狀 — 上方 day 下拉 + 空 POI placeholder（含 3 個
 * picker buttons: 搜尋/收藏/自訂）+ disabled 備選 section + 時間/備註 (defaults)。
 * 使用者點 picker button → navigate ChangePoiPage with `mode=new&day=N&tab=...`，
 * 在 ChangePoiPage 完成 POI 選擇 → backend POST /entries → navigate
 * /trip/:id/stop/:newId/edit（EditEntryPage 接手 alternates / time / mode）。
 *
 * 為何不直接 inline picker：picker UX（search grid / favorites grid / custom map）
 * 已在 ChangePoiPage 完整實作，重複會 drift。User feedback「相同的增加景點的方式」
 * 同樣指向 reuse ChangePoiPage。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import OperationShell from '../components/shell/OperationShell';
import Icon from '../components/shared/Icon';
import { TripSelect } from '../components/TripSelect';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { apiFetch } from '../lib/apiClient';

interface DayApiRow {
  id: number;
  dayNum: number;
  date?: string | null;
  dayOfWeek?: string | null;
}

interface TripMetaApi {
  id: string;
  title?: string;
  destinations?: Array<{ name: string }>;
}

const SCOPED_STYLES = `
.tp-add-entry-shell {
  min-height: 100%; height: 100%;
  background: var(--color-background);
  overflow-y: auto;
  display: flex; flex-direction: column;
}
.tp-add-entry-body {
  flex: 1;
  padding: 24px 20px 96px;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
  display: flex; flex-direction: column;
}
@media (min-width: 768px) {
  .tp-add-entry-body { padding: 32px 24px 96px; }
}

/* Day dropdown */
.tp-add-entry-daypicker {
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.tp-add-entry-daypicker-label {
  font-size: var(--font-size-eyebrow, 0.75rem);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-muted);
}
/* v2.33.22 cleanup: .tp-add-entry-daypicker-select 規則移除 — v2.33.17
   daypicker 已切到 TripSelect（headless-ui Listbox + tp-select-trigger）。 */

/* POI placeholder */
.tp-add-entry-poi-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 28px 20px;
  background: var(--color-secondary);
  border-radius: var(--radius-lg);
  margin-bottom: 28px;
  text-align: center;
}
.tp-add-entry-poi-placeholder-icon {
  width: 56px; height: 56px;
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  border-radius: var(--radius-md);
  display: inline-flex; align-items: center; justify-content: center;
}
.tp-add-entry-poi-placeholder-icon .svg-icon { width: 24px; height: 24px; }
.tp-add-entry-poi-placeholder-text {
  font-size: var(--font-size-headline);
  font-weight: 700;
  color: var(--color-foreground);
}
.tp-add-entry-poi-placeholder-sub {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  line-height: 1.5;
}
.tp-add-entry-poi-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  width: 100%;
}
.tp-add-entry-poi-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  min-height: 44px;
  border: 1.5px solid var(--color-accent);
  border-radius: var(--radius-full);
  background: var(--color-background);
  color: var(--color-accent);
  font: inherit;
  font-size: var(--font-size-callout);
  font-weight: 700;
  cursor: pointer;
  transition: all 120ms;
}
.tp-add-entry-poi-button:hover {
  background: var(--color-accent);
  color: var(--color-accent-foreground);
}
.tp-add-entry-poi-button .svg-icon { width: 16px; height: 16px; }

/* Disabled sections (preview only - finalized on EditEntryPage post-create) */
.tp-add-entry-section {
  margin-bottom: 24px;
  padding: 16px 18px;
  background: var(--color-secondary);
  border-radius: var(--radius-md);
  opacity: 0.6;
}
.tp-add-entry-section h3 {
  margin: 0 0 8px;
  font-size: var(--font-size-eyebrow, 0.75rem);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-muted);
}
.tp-add-entry-section-body {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  line-height: 1.5;
}
`;

function formatDayLabel(day: DayApiRow): string {
  const num = String(day.dayNum).padStart(2, '0');
  const mmdd = (day.date ?? '').slice(5).replace('-', '/');
  const dow = day.dayOfWeek ? `（${day.dayOfWeek}）` : '';
  return `DAY ${num} · ${mmdd}${dow}`;
}

export default function AddEntryPage() {
  const auth = useRequireAuth();
  const { tripId } = useParams<{ tripId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const handleBack = useNavigateBack(
    tripId ? `/trips?selected=${encodeURIComponent(tripId)}` : '/trips',
  );

  const dayNumParam = searchParams.get('day');
  const dayNumRaw = dayNumParam ? parseInt(dayNumParam, 10) : NaN;

  const [allDays, setAllDays] = useState<DayApiRow[] | null>(null);
  const [tripMeta, setTripMeta] = useState<TripMetaApi | null>(null);

  useEffect(() => {
    if (!auth.user || !tripId) return;
    let cancelled = false;
    (async () => {
      try {
        const [days, meta] = await Promise.all([
          apiFetch<DayApiRow[]>(`/trips/${encodeURIComponent(tripId)}/days`),
          apiFetch<TripMetaApi>(`/trips/${encodeURIComponent(tripId)}`),
        ]);
        if (cancelled) return;
        setAllDays(days ?? []);
        setTripMeta(meta ?? null);
      } catch {
        // silent — render with fallback labels
      }
    })();
    return () => { cancelled = true; };
  }, [auth.user, tripId]);

  // 預設 day = URL ?day=N → fallback 第一天
  const dayNum = useMemo(() => {
    if (Number.isFinite(dayNumRaw)) return dayNumRaw;
    if (allDays && allDays.length > 0) return allDays[0]!.dayNum;
    return NaN;
  }, [dayNumRaw, allDays]);

  // URL 與 state 對齊 — 若沒帶 ?day 而 allDays 載入後選了第一天，
  // replaceState URL 讓 link / refresh 行為一致
  useEffect(() => {
    if (!Number.isFinite(dayNum)) return;
    if (Number.isFinite(dayNumRaw)) return;
    const sp = new URLSearchParams(searchParams);
    sp.set('day', String(dayNum));
    setSearchParams(sp, { replace: true });
  }, [dayNum, dayNumRaw, searchParams, setSearchParams]);

  const handlePickDay = useCallback((next: number) => {
    if (next === dayNum) return;
    const sp = new URLSearchParams(searchParams);
    sp.set('day', String(next));
    setSearchParams(sp, { replace: true });
  }, [dayNum, searchParams, setSearchParams]);

  const openPicker = useCallback((tab: 'search' | 'favorites' | 'custom') => {
    if (!tripId || !Number.isFinite(dayNum)) return;
    // 用 entryId=0 sentinel 標記「new entry mode」— ChangePoiPage 看到
    // mode=new 會走 POST /entries 而不是 PUT /poi-id。
    navigate(
      `/trip/${encodeURIComponent(tripId)}/stop/0/change-poi?mode=new&day=${dayNum}&tab=${tab}`,
    );
  }, [tripId, dayNum, navigate]);

  if (!auth.user) return null;
  if (!tripId) {
    return (
      <OperationShell shellClassName="tp-add-entry-shell" title="新增景點" back={handleBack}>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-muted)' }}>
          無效的行程
        </div>
      </OperationShell>
    );
  }

  const tripLabel = tripMeta?.title || tripMeta?.destinations?.[0]?.name || '';
  const titleBar = tripLabel ? `新增景點 · ${tripLabel}` : '新增景點';

  return (
    <OperationShell
      shellClassName="tp-add-entry-shell"
      testId="add-entry-page"
      title={titleBar}
      back={handleBack}
      scopedStyles={SCOPED_STYLES}
    >
          <main className="tp-add-entry-body">
            {/* Day dropdown — fallback to first day if URL missing ?day */}
            <div className="tp-add-entry-daypicker">
              <span className="tp-add-entry-daypicker-label">DAY</span>
              {allDays && allDays.length > 0 ? (
                <div data-testid="add-entry-daypicker" style={{ flex: 1 }}>
                  <TripSelect<number>
                    value={Number.isFinite(dayNum) ? dayNum : (allDays[0]?.dayNum ?? 0)}
                    onChange={handlePickDay}
                    ariaLabel="選擇加入哪天"
                    options={allDays.map((d) => ({
                      value: d.dayNum,
                      label: formatDayLabel(d),
                    }))}
                  />
                </div>
              ) : (
                <span style={{ color: 'var(--color-muted)' }}>載入中…</span>
              )}
            </div>

            {/* Empty POI placeholder with 3 picker buttons */}
            <div className="tp-add-entry-poi-placeholder" data-testid="add-entry-poi-placeholder">
              <span className="tp-add-entry-poi-placeholder-icon">
                <Icon name="location-pin" />
              </span>
              <div>
                <div className="tp-add-entry-poi-placeholder-text">選擇正選景點</div>
                <div className="tp-add-entry-poi-placeholder-sub">
                  從搜尋、收藏或自訂三種方式擇一加入。完成後可再加備選與調整時間。
                </div>
              </div>
              <div className="tp-add-entry-poi-buttons">
                <button
                  type="button"
                  className="tp-add-entry-poi-button"
                  onClick={() => openPicker('search')}
                  data-testid="add-entry-pick-search"
                  disabled={!Number.isFinite(dayNum)}
                >
                  <Icon name="search" />
                  搜尋
                </button>
                <button
                  type="button"
                  className="tp-add-entry-poi-button"
                  onClick={() => openPicker('favorites')}
                  data-testid="add-entry-pick-favorites"
                  disabled={!Number.isFinite(dayNum)}
                >
                  <Icon name="heart" />
                  收藏
                </button>
                <button
                  type="button"
                  className="tp-add-entry-poi-button"
                  onClick={() => openPicker('custom')}
                  data-testid="add-entry-pick-custom"
                  disabled={!Number.isFinite(dayNum)}
                >
                  <Icon name="plus" />
                  自訂
                </button>
              </div>
            </div>

            {/* Preview greyed sections — 提示 user 完成正選後可在 EditEntryPage 編輯 */}
            <div className="tp-add-entry-section" aria-hidden="true">
              <h3>備選 ● 0 個</h3>
              <div className="tp-add-entry-section-body">
                先選正選景點後，這裡可加備選並調整順序。
              </div>
            </div>
            <div className="tp-add-entry-section" aria-hidden="true">
              <h3>時間</h3>
              <div className="tp-add-entry-section-body">
                抵達 / 離開時間和停留分鐘數，正選選好後在編輯頁設定。
              </div>
            </div>
            <div className="tp-add-entry-section" aria-hidden="true">
              <h3>移動方式</h3>
              <div className="tp-add-entry-section-body">
                從上一站到本站的交通方式，正選選好後在編輯頁設定。
              </div>
            </div>
          </main>
    </OperationShell>
  );
}
