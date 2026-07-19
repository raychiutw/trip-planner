/**
 * EntryActionPage — 複製 / 移動景點到其他天的全頁 form (取代 EntryActionPopover)。
 *
 * Routes:
 *   - /trip/:tripId/stop/:entryId/copy  → action='copy'
 *   - /trip/:tripId/stop/:entryId/move  → action='move'
 *
 * 對應 DESIGN.md 2026-05-03 「Modal vs Full Page」規則：
 *   form-style popover (day picker + time slot select + confirm CTA) 重新分類
 *   為違規 modal-ish surface — 改全頁 + TitleBar shell。
 *
 * Layout:
 *   AppShell
 *     sidebar: DesktopSidebarConnected (行程 active)
 *     main:
 *       TitleBar(複製/移動到哪一天)  ← back / 確認 action button
 *       content: day picker (list of all days with current marked) +
 *                time slot select dropdown
 *     bottomNav: GlobalBottomNav (行程 active)
 *
 * 進入路徑:
 *   - TimelineRail expanded row「複製」/「移動」 toolbar button →
 *     navigate('/trip/:id/stop/:eid/copy' 或 '/move')
 *
 * 跟舊 EntryActionPopover 差別:
 *   - 從 anchored absolute popover 變獨立 route
 *   - 從 props (action / days / currentDayId / onClose / onConfirm) 改 useParams +
 *     fetch days API + dispatch 同 event + useNavigateBack(routes.tripsSelected(id)) explicit URL
 *   - shortenDateLabel + DayOption type 抽到 src/lib/entryAction.ts (test 共用)
 *
 * Backend endpoints (sama 原 popover):
 *   - copy: POST /api/trips/:id/entries/:eid/copy { targetDayId }
 *   - move: PATCH /api/trips/:id/entries/:eid { day_id }
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { routes } from '../lib/routes';
import { apiFetch, apiFetchRaw } from '../lib/apiClient';
import { requestTravelRecompute } from '../lib/travelRecompute';
import { dayColor } from '../lib/dayPalette';
import { EVENT } from '../lib/events';
import {
  ENTRY_ACTION_TIME_SLOTS,
  dayNumFromId,
  shortenDateLabel,
  type DayOption,
} from '../lib/entryAction';
import OperationShell from '../components/shell/OperationShell';
import Icon from '../components/shared/Icon';
import ToastContainer, { showToast } from '../components/shared/Toast';
import { TripSelect } from '../components/TripSelect';

interface DaysApiRow {
  id: number;
  dayNum: number;
  date?: string | null;
  dayOfWeek?: string | null;
  label?: string | null;
  // v2.31.16: backend /api/trips/:id/days (no all=1) 不回 entryCount。
  // 改用 /days?all=1 拿 timeline 後算 .length（已存在 endpoint，沒新 backend work）。
  timeline?: unknown[];
}

interface EntryApiRow {
  id?: number;
  dayId?: number | null;
  title?: string | null;
}

const SCOPED_STYLES = `
.tp-entry-action-shell {
  min-height: 100%;
  background: var(--color-secondary);
  height: 100%;
  overflow-y: auto;
}
.tp-entry-action-content {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 120px;
  display: flex; flex-direction: column;
}
@media (min-width: 768px) {
  .tp-entry-action-content { padding: 32px 24px 120px; }
}
.tp-entry-action-sub {
  color: var(--color-muted);
  font-size: var(--font-size-callout);
  margin: 0 0 20px;
  line-height: 1.5;
}
.tp-entry-action-day-list {
  display: flex; flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
}
.tp-entry-action-day {
  display: grid;
  grid-template-columns: 8px 1fr;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--color-background);
  border: 1.5px solid var(--color-border);
  cursor: pointer;
  font: inherit;
  text-align: left;
  min-height: 56px;
  transition: border-color 150ms, box-shadow 150ms;
}
.tp-entry-action-day:hover:not([aria-disabled="true"]) {
  border-color: var(--color-accent);
}
.tp-entry-action-day[aria-pressed="true"] {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}
.tp-entry-action-day[aria-disabled="true"] {
  opacity: 0.45;
  cursor: not-allowed;
}
.tp-entry-action-swatch {
  width: 8px; height: 28px;
  border-radius: var(--radius-sm);
}
.tp-entry-action-day-label-stack {
  display: flex; flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.tp-entry-action-day-label-main {
  display: flex; align-items: center; gap: 8px;
  font-weight: 700; font-size: var(--font-size-callout);
  color: var(--color-foreground);
}
.tp-entry-action-day-count-inline {
  font-weight: 500; color: var(--color-muted);
  font-size: var(--font-size-caption);
}
.tp-entry-action-day-label-sub {
  display: flex; align-items: center; gap: 8px;
  font-size: var(--font-size-caption); color: var(--color-muted);
}
.tp-entry-action-day-current-chip {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--color-accent-deep);
  background: var(--color-accent-subtle);
  padding: 1px 6px; border-radius: var(--radius-full);
}

.tp-entry-action-time-row {
  margin-top: 8px;
  padding: 16px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.tp-entry-action-time-label {
  font-size: var(--font-size-caption); color: var(--color-muted);
  text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;
  margin-bottom: 8px; display: block;
}
.tp-entry-action-time-select {
  width: 100%; font: inherit; font-size: var(--font-size-callout); font-weight: 600;
  padding: 10px 12px; border-radius: var(--radius-md);
  border: 1.5px solid var(--color-border-control);
  background: var(--color-secondary);
  min-height: var(--spacing-tap-min);
  color: var(--color-foreground);
  /* v2.31.81 #3：拔 native UA chrome + 加 site-style chevron（accent terracotta） */
  appearance: none; -webkit-appearance: none; -moz-appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23B85F2A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px 16px;
  padding-right: 36px;
  cursor: pointer;
}
body.dark .tp-entry-action-time-select {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23FFFBF5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
}
.tp-entry-action-time-select:focus {
  outline: none; border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}
.tp-entry-action-error {
  margin: 16px 0 0;
  padding: 10px 12px;
  background: var(--color-priority-high-bg);
  border: 1px solid var(--color-priority-high-dot);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-footnote);
  color: var(--color-priority-high-dot);
  display: flex; align-items: flex-start; gap: 6px;
}
.tp-entry-action-error .svg-icon { width: 14px; height: 14px; flex-shrink: 0; margin-top: 2px; }

.tp-entry-action-loading {
  padding: 60px 24px;
  text-align: center;
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
}

/* sticky bottom bar 已移到 css/tokens.css .tp-page-bottom-bar 共用,EntryAction 用 --end variant。 */
.tp-entry-action-btn {
  padding: 12px 20px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-foreground);
  font: inherit; font-weight: 600;
  font-size: var(--font-size-callout);
  cursor: pointer;
  min-height: var(--spacing-tap-min);
}
.tp-entry-action-btn:hover:not(:disabled) { background: var(--color-hover); }
.tp-entry-action-btn-primary {
  background: var(--color-accent-fill);
  color: var(--color-accent-foreground);
  border-color: var(--color-accent-fill);
}
.tp-entry-action-btn-primary:hover:not(:disabled) {
  filter: brightness(0.95);
}
.tp-entry-action-btn:disabled {
  opacity: 0.5; cursor: not-allowed;
}
`;

type EntryAction = 'copy' | 'move';

interface EntryActionPageProps {
  /** Route component decides which action — `/copy` or `/move`. */
  action: EntryAction;
}

export default function EntryActionPage({ action }: EntryActionPageProps) {
  const auth = useRequireAuth();
  const { tripId, entryId } = useParams<{ tripId: string; entryId: string }>();
  const handleBack = useNavigateBack(tripId ? routes.tripsSelected(tripId) : routes.trips());

  const entryIdNum = entryId ? parseInt(entryId, 10) : null;
  // G-T2:動詞對齊 menu「移到其他天 / 複製到其他天」（DESIGN.md:471 SoT），避免 移到/移動 混用。
  const heading = action === 'copy' ? '複製到哪一天' : '移到哪一天';
  const ctaLabel = action === 'copy' ? '複製' : '移動';

  const [days, setDays] = useState<DayOption[] | null>(null);
  const [currentDayId, setCurrentDayId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedDayId, setSelectedDayId] = useState<number | null>(null);
  const [timeSlot, setTimeSlot] = useState<string>('same');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch days + entry meta on mount
  useEffect(() => {
    if (!auth.user || !tripId || !entryIdNum) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [daysData, entryData] = await Promise.all([
          // v2.31.16: ?all=1 才會回 timeline，否則沒法算 entryCount。
          apiFetch<DaysApiRow[]>(`/trips/${encodeURIComponent(tripId)}/days?all=1`),
          apiFetch<EntryApiRow>(`/trips/${encodeURIComponent(tripId)}/entries/${entryIdNum}`),
        ]);
        if (cancelled) return;

        const dayOptions: DayOption[] = (daysData ?? []).map((d) => ({
          dayNum: d.dayNum,
          dayId: d.id,
          label: `${d.date ?? ''}${d.dayOfWeek ? `（${d.dayOfWeek}）` : ''}`,
          stopCount: Array.isArray(d.timeline) ? d.timeline.length : 0,
          swatchColor: dayColor(d.dayNum),
        }));

        setDays(dayOptions);
        setCurrentDayId(entryData?.dayId ?? null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : '載入失敗');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [auth.user, tripId, entryIdNum]);


  async function handleConfirm() {
    if (!tripId || entryIdNum == null || selectedDayId == null) return;
    setSubmitting(true);
    setSubmitError(null);

    const path = action === 'copy'
      ? `/trips/${encodeURIComponent(tripId)}/entries/${entryIdNum}/copy`
      : `/trips/${encodeURIComponent(tripId)}/entries/${entryIdNum}`;
    const method = action === 'copy' ? 'POST' : 'PATCH';
    const body = action === 'copy'
      ? JSON.stringify({ targetDayId: selectedDayId })
      : JSON.stringify({ day_id: selectedDayId });

    try {
      const res = await apiFetchRaw(path, {
        method,
        credentials: 'same-origin',
        body,
      });
      if (!res.ok) {
        const text = await res.text();
        let message = action === 'copy' ? '複製失敗' : '移動失敗';
        try {
          const data = JSON.parse(text) as { error?: { code?: string; message?: string } };
          if (data?.error?.message) message = data.error.message;
        } catch { /* not JSON */ }
        throw new Error(message);
      }
      // 2026-07-06 車程重算缺口：move 影響來源日 + 目標日兩天的相鄰 pair，
      // copy 影響目標日 → 補顯式 day-scoped recompute（fire-and-forget，失敗
      // 靜默 — self-healing 與 TravelPill ⚠ 是 fallback）。
      const targetDayNum = dayNumFromId(days, selectedDayId);
      const sourceDayNum = action === 'move' ? dayNumFromId(days, currentDayId) : null;
      void requestTravelRecompute(tripId, targetDayNum).catch(() => undefined);
      if (sourceDayNum != null && sourceDayNum !== targetDayNum) {
        void requestTravelRecompute(tripId, sourceDayNum).catch(() => undefined);
      }
      window.dispatchEvent(new CustomEvent(EVENT.entryUpdated, {
        detail: { tripId, entryId: entryIdNum },
      }));
      showToast(action === 'copy' ? '景點已複製' : '景點已移動', 'success');
      handleBack();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '操作失敗');
      setSubmitting(false);
    }
  }

  const canConfirm = useMemo(
    () => !loading && !submitting && selectedDayId != null && selectedDayId !== currentDayId,
    [loading, submitting, selectedDayId, currentDayId],
  );

  if (!auth.user) return null;
  if (!tripId || !entryIdNum) {
    return (
      <OperationShell
        shellClassName="tp-entry-action-shell"
        testId="entry-action-page"
        title={heading}
        back={handleBack}
      >
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-muted)' }}>
          無效的行程或景點 ID
        </div>
      </OperationShell>
    );
  }

  return (
    <>
      <ToastContainer />
      <OperationShell
        shellClassName="tp-entry-action-shell"
        testId="entry-action-page"
        title={heading}
        back={handleBack}
        scopedStyles={SCOPED_STYLES}
      >
            <div className="tp-entry-action-content">
              {loading && (
                <div className="tp-entry-action-loading" data-testid="entry-action-loading">
                  載入中⋯
                </div>
              )}

              {loadError && (
                <div className="tp-entry-action-error" role="alert">
                  <Icon name="warning" />
                  <span>{loadError}</span>
                </div>
              )}

              {!loading && !loadError && days && (
                <>
                  <p className="tp-entry-action-sub">
                    選擇目標日期{action === 'copy' ? '（會複製一份）' : '（原項目移到新日）'}
                  </p>

                  <div className="tp-entry-action-day-list" role="radiogroup" aria-label={heading}>
                    {days.map((d) => {
                      const isCurrent = d.dayId === currentDayId;
                      const isSelected = selectedDayId === d.dayId;
                      return (
                        <button
                          key={d.dayId}
                          type="button"
                          role="radio"
                          className="tp-entry-action-day"
                          aria-disabled={isCurrent || undefined}
                          aria-checked={isSelected}
                          aria-pressed={isSelected}
                          onClick={() => { if (!isCurrent) setSelectedDayId(d.dayId); }}
                          data-testid={`entry-action-day-${d.dayNum}`}
                        >
                          <span
                            className="tp-entry-action-swatch"
                            style={{ background: d.swatchColor || dayColor(d.dayNum) }}
                            aria-hidden="true"
                          />
                          <span className="tp-entry-action-day-label-stack">
                            <span className="tp-entry-action-day-label-main">
                              <span>Day {d.dayNum}</span>
                              <span className="tp-entry-action-day-count-inline">
                                {d.stopCount === 0 ? '空' : `${d.stopCount} 個`}
                              </span>
                            </span>
                            <span className="tp-entry-action-day-label-sub">
                              <span>{shortenDateLabel(d.label)}</span>
                              {isCurrent && (
                                <span className="tp-entry-action-day-current-chip">目前</span>
                              )}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="tp-entry-action-time-row" data-testid="entry-action-timeslot">
                    <label className="tp-entry-action-time-label" htmlFor="entry-action-timeslot">
                      {ctaLabel}到時段
                    </label>
                    <TripSelect<string>
                      id="entry-action-timeslot"
                      value={timeSlot}
                      onChange={setTimeSlot}
                      ariaLabel={`${ctaLabel}到時段`}
                      options={ENTRY_ACTION_TIME_SLOTS.map((s) => ({ value: s.key, label: s.label }))}
                    />
                  </div>

                  {submitError && (
                    <div className="tp-entry-action-error" role="alert">
                      <Icon name="warning" />
                      <span>{submitError}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {!loading && !loadError && (
              <div className="tp-page-bottom-bar tp-page-bottom-bar--end">
                <button
                  type="button"
                  className="tp-entry-action-btn"
                  onClick={handleBack}
                  disabled={submitting}
                  data-testid="entry-action-cancel"
                >
                  取消
                </button>
                <button
                  type="button"
                  className="tp-entry-action-btn tp-entry-action-btn-primary"
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  data-testid="entry-action-confirm"
                >
                  {submitting ? `${ctaLabel}中⋯` : ctaLabel}
                </button>
              </div>
            )}
      </OperationShell>
    </>
  );
}
