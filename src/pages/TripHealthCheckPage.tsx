/**
 * TripHealthCheckPage — AI 行程健檢全頁
 *
 * Route: `/trip/:tripId/health`
 * 入口: TripCardMenu 「AI 健檢」/ TripPage ⋯ menu 「AI 健檢」
 *
 * 4 個 state（依 trip_health_reports.status）:
 *  - null  (從未健檢過): empty CTA「開始健檢」
 *  - pending: loading view + 3 秒 poll 直到 completed/failed
 *  - completed: severity-grouped findings + 「重新生成」
 *  - failed: error view + 「重新生成」
 *  + re-generating overlay state: 舊 findings dim + 「再重新生成」disabled
 *
 * 結果儲存：D1 `trip_health_reports` (per-trip latest, PRIMARY KEY trip_id)。
 * 對話留底：同步 INSERT `trip_requests` 走 Claude → user 在 /chat 也看得到對話。
 * 命名：tp-ai-health-* CSS class，避開 v2.23.0 既有 TripHealthBanner（POI lifecycle）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TitleBar from '../components/shell/TitleBar';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import Icon from '../components/shared/Icon';
import { apiFetchRaw } from '../lib/apiClient';
import { parseUtcDate } from '../lib/parseUtcDate';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { routes } from '../lib/routes';

type Severity = 'high' | 'medium' | 'low';
type Dimension = 'timing' | 'distance' | 'meals' | 'sights' | 'hotel';

interface Finding {
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

const DIMENSION_LABEL: Record<Dimension, string> = {
  timing: '時間',
  distance: '移動',
  meals: '餐飲',
  sights: '景點',
  hotel: '住宿',
};

interface HealthReport {
  tripId: string;
  userId: string;
  status: 'pending' | 'completed' | 'failed';
  requestId: number | null;
  findings: Finding[];
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

const POLL_INTERVAL_MS = 3000;
const SEVERITY_ORDER: Severity[] = ['high', 'medium', 'low'];

const SCOPED_STYLES = `
.tp-ai-health-shell {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100%;
  background: var(--color-background);
}
.tp-ai-health-body {
  padding: 16px;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}
@media (min-width: 1024px) {
  .tp-ai-health-body { padding: 24px; max-width: 1040px; }
}
.tp-ai-health-hero {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
}
.tp-ai-health-hero .eyebrow {
  font-size: var(--font-size-eyebrow);
  line-height: 14px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-accent);
}
.tp-ai-health-hero h1 {
  margin: 0;
  font-size: var(--font-size-title2);
  line-height: 32px;
  font-weight: 700;
  color: var(--color-foreground);
}
@media (min-width: 1024px) {
  .tp-ai-health-hero h1 { font-size: var(--font-size-title); line-height: 36px; }
}
.tp-ai-health-hero .meta {
  font-size: var(--font-size-footnote);
  line-height: 20px;
  color: var(--color-muted);
}
.tp-ai-health-hero .meta.is-active { color: var(--color-accent); }

/* Empty CTA */
.tp-ai-health-empty {
  display: grid;
  place-items: center;
  gap: 16px;
  padding: 40px 16px;
  text-align: center;
}
.tp-ai-health-empty .icon-bubble {
  width: 72px; height: 72px;
  background: var(--color-accent-fill);
  color: var(--color-accent-foreground);
  border-radius: var(--radius-lg);
  display: grid; place-items: center;
}
.tp-ai-health-empty .icon-bubble .svg-icon {
  width: 32px; height: 32px;
}
.tp-ai-health-empty h2 {
  margin: 0;
  font-size: var(--font-size-headline);
  line-height: 24px;
  font-weight: 700;
}
.tp-ai-health-empty .sub {
  font-size: var(--font-size-footnote);
  line-height: 22px;
  color: var(--color-muted);
  max-width: 360px;
}
/* v2.33.118: body 主 CTA — accent-filled pill button，比 titlebar icon-only 直覺 */
.tp-ai-health-body-cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 14px 28px;
  background: var(--color-accent-fill);
  color: var(--color-accent-foreground);
  border: none;
  border-radius: var(--radius-full);
  font: inherit;
  font-size: var(--font-size-body);
  font-weight: 700;
  cursor: pointer;
  transition: filter 150ms;
}
.tp-ai-health-body-cta:hover:not(:disabled) { filter: brightness(0.95); }
.tp-ai-health-body-cta:focus-visible { outline: none; box-shadow: var(--shadow-ring); }
.tp-ai-health-body-cta:disabled { opacity: 0.5; cursor: not-allowed; }
.tp-ai-health-body-cta .svg-icon { width: 18px; height: 18px; }

/* v2.33.118: titlebar refresh-cw button — ghost style (繼承 .tp-titlebar-action)
   + spin animation when pending + 數字 badge when has findings */
.tp-ai-health-titlebar-btn { position: relative; }
.tp-ai-health-titlebar-btn.is-spinning .svg-icon {
  animation: tp-ai-health-spin 1.5s linear infinite;
}
@keyframes tp-ai-health-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .tp-ai-health-titlebar-btn.is-spinning .svg-icon { animation: none; }
}

/* Loading pulse */
.tp-ai-health-loading {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  background: var(--color-accent-subtle);
  border: 1px solid var(--color-accent-bg);
  border-radius: var(--radius-md);
  margin-bottom: 16px;
}
.tp-ai-health-loading .pulse {
  width: 36px; height: 36px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  position: relative;
  flex-shrink: 0;
  animation: tp-aih-pulse 1.6s ease-out infinite;
}
.tp-ai-health-loading .pulse::after {
  content: '';
  position: absolute; inset: -6px;
  border-radius: var(--radius-full);
  border: 2px solid var(--color-accent);
  opacity: 0.4;
  animation: tp-aih-pulse-ring 1.6s ease-out infinite;
}
.tp-ai-health-loading .text .title {
  font-size: var(--font-size-footnote);
  line-height: 20px;
  font-weight: 700;
}
.tp-ai-health-loading .text .sub {
  font-size: var(--font-size-caption);
  line-height: 18px;
  color: var(--color-muted);
}
@keyframes tp-aih-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(0.92); }
}
@keyframes tp-aih-pulse-ring {
  0% { transform: scale(0.95); opacity: 0.6; }
  100% { transform: scale(1.3); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .tp-ai-health-loading .pulse,
  .tp-ai-health-loading .pulse::after {
    animation: none;
  }
}

/* Severity counts */
.tp-ai-health-counts {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.tp-ai-health-count {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-caption);
  line-height: 16px;
  font-weight: 600;
}
.tp-ai-health-count .dot {
  width: 6px; height: 6px;
  border-radius: var(--radius-full);
}
.tp-ai-health-count.is-high { background: var(--color-priority-high-bg); color: var(--color-priority-high-dot); }
.tp-ai-health-count.is-high .dot { background: var(--color-priority-high-dot); }
.tp-ai-health-count.is-medium { background: var(--color-priority-medium-bg); color: var(--color-priority-medium-dot); }
.tp-ai-health-count.is-medium .dot { background: var(--color-priority-medium-dot); }
.tp-ai-health-count.is-low { background: var(--color-priority-low-bg); color: var(--color-priority-low-dot); }
.tp-ai-health-count.is-low .dot { background: var(--color-priority-low-dot); }

/* Severity groups */
.tp-ai-health-group {
  margin-bottom: 20px;
}
.tp-ai-health-group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.tp-ai-health-group-head .pill {
  background: var(--color-tertiary);
  color: var(--color-muted);
  border-radius: var(--radius-full);
  padding: 2px 8px;
  font-size: var(--font-size-caption2);
  line-height: 14px;
  font-weight: 600;
}
.tp-ai-health-findings {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tp-ai-health-finding {
  display: grid;
  grid-template-columns: 6px 1fr;
  gap: 12px;
  padding: 12px;
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.tp-ai-health-finding .bar {
  border-radius: var(--radius-full);
}
.tp-ai-health-finding.is-high .bar { background: var(--color-priority-high-dot); }
.tp-ai-health-finding.is-medium .bar { background: var(--color-priority-medium-dot); }
.tp-ai-health-finding.is-low .bar { background: var(--color-priority-low-dot); }
.tp-ai-health-finding .body .head-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.tp-ai-health-finding .body .title {
  font-size: var(--font-size-footnote);
  line-height: 20px;
  font-weight: 700;
}
.tp-ai-health-finding .body .dimension-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: var(--radius-full);
  background: var(--color-tertiary);
  color: var(--color-muted);
  font-size: var(--font-size-caption2);
  line-height: 16px;
  font-weight: 600;
}
.tp-ai-health-finding .body .desc {
  font-size: var(--font-size-footnote);
  line-height: 20px;
  color: var(--color-muted);
  margin: 4px 0 8px;
}
.tp-ai-health-finding .body .suggestion {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: baseline;
  padding: 8px 10px;
  margin: 4px 0 8px;
  background: var(--color-accent-subtle);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-footnote);
  line-height: 20px;
  color: var(--color-accent-deep);
}
.tp-ai-health-finding .body .suggestion .label {
  font-size: var(--font-size-caption2);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-accent);
  white-space: nowrap;
}
.tp-ai-health-finding .body .actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.tp-ai-health-finding .body .action {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-foreground);
  padding: 6px 12px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-caption);
  line-height: 16px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: var(--spacing-tap-min);
}
.tp-ai-health-finding .body .action:hover {
  background: var(--color-hover);
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.tp-ai-health-finding .body .action.is-primary {
  background: var(--color-accent-fill);
  color: var(--color-accent-foreground);
  border-color: var(--color-accent-fill);
}
.tp-ai-health-finding .body .action.is-primary:hover {
  background: var(--color-accent-deep);
  border-color: var(--color-accent-deep);
}

/* Re-generating overlay (results 仍可看，bg dimmed) */
.tp-ai-health-results.is-regenerating {
  opacity: 0.55;
}

/* Empty trip guard banner — entryCount===0 時顯示。border-left accent + muted text
 * 對齊 .tp-ai-health-error 視覺重量（low-key info / advisory）。CTA disabled
 * 在 title bar action，這個 banner 補語意說明為什麼 disabled。 */
.tp-ai-health-notice {
  background: color-mix(in srgb, var(--color-tertiary-bg, var(--color-background)) 70%, transparent);
  border-left: 3px solid var(--color-accent);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  margin-bottom: 16px;
  font-size: var(--font-size-footnote);
  line-height: 20px;
  color: var(--color-foreground);
}

/* Error state */
.tp-ai-health-error {
  background: var(--color-destructive-bg);
  border: 1px solid var(--color-destructive);
  border-left-width: 4px;
  border-radius: var(--radius-md);
  padding: 12px 14px;
  margin-bottom: 16px;
}
.tp-ai-health-error .title {
  font-size: var(--font-size-footnote);
  line-height: 20px;
  font-weight: 700;
  color: var(--color-destructive);
}
.tp-ai-health-error .desc {
  font-size: var(--font-size-footnote);
  line-height: 20px;
  color: var(--color-foreground);
  margin-top: 4px;
}

/* Footnote */
.tp-ai-health-footnote {
  font-size: var(--font-size-caption2);
  line-height: 16px;
  color: var(--color-muted);
  margin-top: 16px;
  text-align: center;
}

/* Skeleton row */
.tp-ai-health-skel {
  background: linear-gradient(90deg, var(--color-tertiary) 25%, var(--color-secondary) 50%, var(--color-tertiary) 75%);
  background-size: 200% 100%;
  border-radius: var(--radius-sm);
  animation: tp-aih-shimmer 1.4s infinite;
}
@keyframes tp-aih-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;

interface TripSummary {
  id: string;
  title?: string;
}

export default function TripHealthCheckPage() {
  const auth = useRequireAuth();
  const { user } = useCurrentUser();
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const handleBack = useNavigateBack(tripId ? routes.tripsSelected(tripId) : routes.trips());

  const [trip, setTrip] = useState<TripSummary | null>(null);
  const [report, setReport] = useState<HealthReport | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // v2.31.58：empty trip guard — 沒任何 entry 不該允許觸發 AI 健檢。
  // null = 還沒 fetch；number = 實際 entry 總數（跨所有天）。
  const [entryCount, setEntryCount] = useState<number | null>(null);

  // Polling: 用 ref 持有 timeout id，避免 effect 重 render 時舊 timer 漏清
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchReport = useCallback(async (signal?: AbortSignal): Promise<HealthReport | null> => {
    if (!tripId) return null;
    const res = await apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/health-check`, { signal });
    if (!res.ok) throw new Error(`load failed: ${res.status}`);
    const data = await res.json() as { report: HealthReport | null };
    return data.report;
  }, [tripId]);

  // Initial GET trip name + report
  useEffect(() => {
    if (!auth.user || !tripId) return;
    const ctrl = new AbortController();
    let cancelled = false;
    (async () => {
      setInitialLoading(true);
      setError(null);
      try {
        const [tripRes, daysRes, reportData] = await Promise.all([
          apiFetchRaw(`/trips/${encodeURIComponent(tripId)}`, { signal: ctrl.signal }),
          apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/days?all=1`, { signal: ctrl.signal }),
          fetchReport(ctrl.signal),
        ]);
        if (cancelled) return;
        if (tripRes.ok) {
          const tripData = await tripRes.json() as TripSummary;
          setTrip({ id: tripData.id, title: tripData.title });
        }
        if (daysRes.ok) {
          // v2.31.58 empty trip guard：?all=1 endpoint 回每天 timeline array，
          // 累加跨天 entry 數判斷 trip 是否完全空白。
          const daysData = await daysRes.json() as Array<{ timeline?: unknown[] }>;
          const totalEntries = Array.isArray(daysData)
            ? daysData.reduce((sum, d) => sum + (Array.isArray(d.timeline) ? d.timeline.length : 0), 0)
            : 0;
          setEntryCount(totalEntries);
        }
        setReport(reportData);
      } catch (err) {
        if (cancelled) return;
        const e = err as { name?: string };
        if (e.name !== 'AbortError') {
          setError('載入失敗，請重新整理');
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [auth.user, tripId, fetchReport]);

  // Polling effect while pending
  useEffect(() => {
    if (!report || report.status !== 'pending') return;
    let cancelled = false;
    const ctrl = new AbortController();

    function schedule() {
      pollRef.current = setTimeout(async () => {
        if (cancelled) return;
        try {
          const next = await fetchReport(ctrl.signal);
          if (cancelled) return;
          setReport(next);
          if (next?.status === 'pending') schedule();
        } catch (err) {
          if (cancelled) return;
          const e = err as { name?: string };
          if (e.name !== 'AbortError') schedule();
        }
      }, POLL_INTERVAL_MS);
    }
    schedule();

    return () => {
      cancelled = true;
      ctrl.abort();
      if (pollRef.current) {
        clearTimeout(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [report, fetchReport]);

  const handleStart = useCallback(async () => {
    if (!tripId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetchRaw(`/trips/${encodeURIComponent(tripId)}/health-check`, {
        method: 'POST',
      });
      if (!res.ok) {
        // v2.31.58：backend TRIP_EMPTY guard 拒絕（race window：frontend fetch
        // 完 trip empty 後 user 加 entry，但 button 還沒 re-enable 就點到，
        // 反之亦然）→ 顯示 backend 中文 message + 同步 entryCount = 0
        // 讓 button 立即 disabled。
        try {
          const errData = await res.json() as { error?: { code?: string; message?: string } };
          if (errData.error?.code === 'TRIP_EMPTY') {
            setEntryCount(0);
            setError(errData.error.message ?? '此行程尚無景點，請先加入景點再執行健檢');
            return;
          }
        } catch {
          /* ignore parse error, fall through to generic message */
        }
        throw new Error(`start failed: ${res.status}`);
      }
      const data = await res.json() as { report: HealthReport };
      setReport(data.report);
    } catch {
      setError('觸發健檢失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  }, [tripId, submitting]);

  const goToDay = useCallback((day: number) => {
    if (!tripId) return;
    navigate(`${routes.trip(tripId)}?day=${day}`);
  }, [navigate, tripId]);

  const goToEntry = useCallback((entryId: number) => {
    if (!tripId) return;
    navigate(`/trip/${encodeURIComponent(tripId)}/stop/${entryId}/edit`);
  }, [navigate, tripId]);

  if (!auth.user || !tripId) {
    return null;
  }

  const tripTitle = trip?.title ?? '行程';
  const findings = report?.findings ?? [];
  const counts: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  for (const f of findings) counts[f.severity]++;
  const grouped: Record<Severity, Finding[]> = { high: [], medium: [], low: [] };
  for (const f of findings) grouped[f.severity].push(f);

  const isPending = report?.status === 'pending';
  const isCompleted = report?.status === 'completed';
  const isFailed = report?.status === 'failed';
  const isRegenerating = isPending && findings.length > 0;
  const hasResults = isCompleted && findings.length > 0;
  const hasNoIssues = isCompleted && findings.length === 0;

  const ctaLabel = submitting
    ? '送出中⋯'
    : isPending && isRegenerating
      ? '再重新生成'
      : isPending
        ? '健檢進行中⋯'
        : report
          ? '重新生成'
          : '開始健檢';

  const main = (
    <div className="tp-ai-health-shell" data-testid="ai-health-page">
      <style>{SCOPED_STYLES}</style>
      <TitleBar
        title="AI 健檢"
        back={handleBack}
        backLabel="回行程"
        // v2.33.118 redesign: titlebar action 只在有狀態時顯（pending / completed / failed）。
        // empty (entryCount=0) 或 idle (entry > 0 + 未做過) 不顯 — body 改主 CTA。
        // 風格從 .is-primary (accent fill) 改 ghost (`.tp-titlebar-action`) — 與其他
        // titlebar functional icon 同 family 但用 refresh-cw icon 區辨「重新生成」action，
        // pending 時 icon spin 表進行中，completed 加數字 badge 顯 findings 數量。
        actions={!initialLoading && report && (
          <button
            type="button"
            className={`tp-titlebar-action tp-titlebar-action--icon-only tp-ai-health-titlebar-btn${isPending ? ' is-spinning' : ''}`}
            onClick={handleStart}
            disabled={submitting || isPending}
            aria-label={ctaLabel}
            title={ctaLabel}
            data-testid="ai-health-start-btn"
          >
            <Icon name="refresh-cw" />
            <span className="tp-titlebar-action-label">{ctaLabel}</span>
          </button>
        )}
      />

      <div className="tp-ai-health-body">
        {!initialLoading && entryCount === 0 && (
          <div className="tp-ai-health-notice" role="status" data-testid="ai-health-empty-hint">
            此行程尚無景點，請先加入景點再執行健檢
          </div>
        )}
        <div className="tp-ai-health-hero">
          <div className="eyebrow">AI 行程建議</div>
          <h1 data-testid="ai-health-title">{tripTitle}</h1>
          {initialLoading ? (
            <div className="meta">載入中…</div>
          ) : isPending ? (
            <div className="meta is-active">健檢進行中…</div>
          ) : isCompleted && report ? (
            <div className="meta">{formatTimestamp(report.completedAt || report.createdAt)} · 共 {findings.length} 項建議</div>
          ) : isFailed ? (
            <div className="meta">健檢失敗</div>
          ) : (
            <div className="meta">尚未進行 AI 健檢</div>
          )}
        </div>

        {error && (
          <div className="tp-ai-health-error" role="alert" data-testid="ai-health-error">
            <div className="title">操作失敗</div>
            <div className="desc">{error}</div>
          </div>
        )}

        {initialLoading && (
          <div data-testid="ai-health-skeleton" aria-busy="true">
            <div className="tp-ai-health-skel" style={{ height: 16, width: '40%', marginBottom: 12 }} />
            <div className="tp-ai-health-skel" style={{ height: 64, marginBottom: 12 }} />
            <div className="tp-ai-health-skel" style={{ height: 64 }} />
          </div>
        )}

        {!initialLoading && !report && (
          <div className="tp-ai-health-empty" data-testid="ai-health-empty">
            <div className="icon-bubble" aria-hidden="true">
              <Icon name="sparkle" />
            </div>
            <h2>尚未健檢過此行程</h2>
            <div className="sub">由 AI 檢視整份行程，找出時間衝突、距離過遠、漏掉必排景點等問題。通常 3-7 分鐘完成。</div>
            {/* v2.33.118 redesign: idle state 主 CTA 從 titlebar 移到 body — 中央大 button
                明確「開始健檢」action affordance，比 titlebar 右上 icon-only 更直覺。
                entryCount=0 時 disabled + 上方 banner 已告知「先加入景點」 */}
            <button
              type="button"
              className="tp-ai-health-body-cta"
              onClick={handleStart}
              disabled={submitting || entryCount === 0}
              data-testid="ai-health-start-btn"
            >
              <Icon name="sparkle" />
              <span>{ctaLabel}</span>
            </button>
          </div>
        )}

        {!initialLoading && isPending && !isRegenerating && (
          <div className="tp-ai-health-loading" role="status" aria-live="polite" data-testid="ai-health-loading">
            <div className="pulse" />
            <div className="text">
              <div className="title">AI 健檢進行中…</div>
              <div className="sub">通常 3-7 分鐘完成，可以同時編輯行程</div>
            </div>
          </div>
        )}

        {isRegenerating && (
          <div className="tp-ai-health-loading" role="status" aria-live="polite" data-testid="ai-health-regenerating">
            <div className="pulse" />
            <div className="text">
              <div className="title">準備中…</div>
              <div className="sub">舊結果保留可閱讀，新結果生成中</div>
            </div>
          </div>
        )}

        {isFailed && report && (
          <div className="tp-ai-health-error" role="alert" data-testid="ai-health-failed">
            <div className="title">健檢失敗</div>
            <div className="desc">
              {report.errorMessage || 'AI 處理時發生錯誤，可重新生成再試。'}
            </div>
          </div>
        )}

        {hasNoIssues && (
          <div className="tp-ai-health-empty" data-testid="ai-health-noissues">
            <div className="icon-bubble" aria-hidden="true" style={{ background: 'var(--color-success)' }}>
              <Icon name="check" />
            </div>
            <h2>看起來沒有問題</h2>
            <div className="sub">AI 沒有找到需要修正的地方。行程安排良好！</div>
          </div>
        )}

        {(hasResults || isRegenerating) && (
          <div className={`tp-ai-health-results${isRegenerating ? ' is-regenerating' : ''}`} data-testid="ai-health-results">
            <div className="tp-ai-health-counts">
              {SEVERITY_ORDER.map((sev) =>
                counts[sev] > 0 ? (
                  <span key={sev} className={`tp-ai-health-count is-${sev}`}>
                    <span className="dot" />
                    {severityLabel(sev)} {counts[sev]}
                  </span>
                ) : null,
              )}
            </div>

            {SEVERITY_ORDER.map((sev) => {
              if (grouped[sev].length === 0) return null;
              return (
                <section key={sev} className="tp-ai-health-group" data-testid={`ai-health-group-${sev}`}>
                  <div className="tp-ai-health-group-head">
                    <span className={`tp-ai-health-count is-${sev}`}>
                      <span className="dot" />
                      {severityHeading(sev)}
                    </span>
                    <span className="pill">{grouped[sev].length} 項</span>
                  </div>
                  <div className="tp-ai-health-findings">
                    {grouped[sev].map((f, idx) => (
                      <article
                        key={`${sev}-${idx}`}
                        className={`tp-ai-health-finding is-${sev}`}
                        data-testid={`ai-health-finding-${sev}-${idx}`}
                      >
                        <div className="bar" aria-hidden="true" />
                        <div className="body">
                          <div className="head-row">
                            <div className="title">{f.title}</div>
                            {f.dimension && (
                              <span
                                className="dimension-chip"
                                data-testid={`ai-health-finding-dimension-${sev}-${idx}`}
                              >
                                {DIMENSION_LABEL[f.dimension]}
                              </span>
                            )}
                          </div>
                          {f.description && <div className="desc">{f.description}</div>}
                          {f.suggestion && (
                            <div
                              className="suggestion"
                              data-testid={`ai-health-finding-suggestion-${sev}-${idx}`}
                            >
                              <span className="label">建議</span>
                              <span>{f.suggestion}</span>
                            </div>
                          )}
                          <div className="actions">
                            {typeof f.actionTarget?.entryId === 'number' && (
                              <button
                                type="button"
                                className="action is-primary"
                                onClick={() => goToEntry(f.actionTarget!.entryId!)}
                                data-testid={`ai-health-finding-goto-entry-${sev}-${idx}`}
                              >
                                前往景點
                              </button>
                            )}
                            {typeof f.actionTarget?.day === 'number'
                              && typeof f.actionTarget?.entryId !== 'number' && (
                              <button
                                type="button"
                                className="action is-primary"
                                onClick={() => goToDay(f.actionTarget!.day!)}
                              >
                                前往 Day {f.actionTarget.day}
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}

            <div className="tp-ai-health-footnote">由 Claude AI 產生，僅供參考</div>
          </div>
        )}
      </div>
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

function severityLabel(sev: Severity): string {
  return sev === 'high' ? '高' : sev === 'medium' ? '中' : '低';
}

function severityHeading(sev: Severity): string {
  return sev === 'high' ? '高優先' : sev === 'medium' ? '中等' : '低';
}

function formatTimestamp(iso: string): string {
  // v2.31.7: 用 parseUtcDate 統一處理 D1 naive datetime（'YYYY-MM-DD HH:MM:SS'）
  // 直接 `new Date(iso)` 沒 Z 後綴被 Chrome 當 local time → 顯示落差 TZ offset 小時。
  const d = parseUtcDate(iso);
  if (!d) return iso;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return '剛剛完成';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分鐘前完成`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小時前完成`;
  return d.toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' });
}
