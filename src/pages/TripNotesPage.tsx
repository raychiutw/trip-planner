/**
 * TripNotesPage — 行程筆記
 *
 * Route: `/trip/:tripId/notes`
 * v2.34.x 行程筆記 PR4 — page shell + accordion frame + skeleton + empty hero
 *
 * Mockup sign-off (V1 Accordion Stack):
 *   docs/design-sessions/2026-05-28-trip-notes/v1-accordion-stack.html
 *   docs/design-sessions/2026-05-28-trip-notes/v1-states.html
 *
 * State (PR4 scope):
 *   - loading: skeleton 3 row
 *   - error: AlertPanel.is-error 持續可見 + 重試 (DESIGN.md L549)
 *   - empty (total=0): hero「建立行程筆記」+ 5 dot progress + 5 section collapsed accent border
 *   - hasData: accordion expand 預設 — mobile 航班，desktop ≥768px 全展開
 *
 * CRUD UI per section (PR5-8) 還沒 — section body 顯示 row count + 「加項」placeholder。
 *
 * v2.57.x：遷入 TripStackLayout（owner 2026-07-21「桌機三欄 shell panel 化」）——
 *   桌機：OperationShell bare panel 塞右欄，中欄行程詳情保留。
 *   手機：OperationShell 整頁（bottomNav prop 保留既有 GlobalBottomNav）。
 *   詳見 docs/design-sessions/2026-07-21-desktop-third-column-panelization.html。
 */
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import OperationShell from '../components/shell/OperationShell';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import Icon from '../components/shared/Icon';
import AlertPanel from '../components/shared/AlertPanel';
import FlightsSection from '../components/trip-notes/FlightsSection';
import LodgingsSection from '../components/trip-notes/LodgingsSection';
import ReservationsSection from '../components/trip-notes/ReservationsSection';
import PretripSection from '../components/trip-notes/PretripSection';
import EmergencySection from '../components/trip-notes/EmergencySection';
import NoteAiExclusionsDialog, {
  type NoteAiDocType,
} from '../components/trip-notes/NoteAiExclusionsDialog';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../components/shared/Toast';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { routes } from '../lib/routes';
import { TripContext } from '../contexts/TripContext';

interface TripFlight { id: number; sortOrder: number; airline: string; flightNo: string; cabinClass: string; departAirport: string; arriveAirport: string; departAt: string; arriveAt: string; note: string; version: number; }
interface TripLodging { id: number; sortOrder: number; name: string; address: string; checkInAt: string; checkOutAt: string; bookingNo: string; phone: string; note: string; version: number; }
interface TripReservation { id: number; sortOrder: number; kind: 'restaurant' | 'experience' | 'ticket' | 'transport' | 'other'; title: string; reservedAt: string; partySize: number; reservationNo: string; phone: string; note: string; version: number; }
interface TripPretripNote { id: number; sortOrder: number; section: string; title: string; content: string; aiGenerated: number; aiSource: string | null; origin: 'human' | 'ai'; managedBy: 'human' | 'ai'; semanticKey: string | null; version: number; }
interface TripEmergencyContact { id: number; sortOrder: number; name: string; relationship: string; phone: string; email: string; kind: 'personal' | 'embassy' | 'police' | 'medical' | 'insurance' | 'hotel' | 'other'; aiGenerated: number; origin: 'human' | 'ai'; managedBy: 'human' | 'ai'; semanticKey: string | null; version: number; }

interface NotesAggregator {
  flights: TripFlight[];
  lodgings: TripLodging[];
  reservations: TripReservation[];
  pretripNotes: TripPretripNote[];
  emergencyContacts: TripEmergencyContact[];
}

type SectionKey = 'flights' | 'lodgings' | 'reservations' | 'pretrip' | 'emergency';

interface SectionMeta {
  key: SectionKey;
  title: string;
  icon: string;
  iconAccent?: boolean;
  hasAI: boolean;
  countLabel: (n: number) => string;
}

type NoteAiStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed' | 'timedOut';

interface NoteAiJob {
  docType: NoteAiDocType;
  status: NoteAiStatus;
  jobId: number | null;
  requestId: number | null;
  generation: number;
  insertedCount: number;
  replacedCount: number;
  preservedManualCount: number;
  duplicateExcludedCount: number;
  suppressedCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string | null;
  startedAt: string | null;
  timeoutAt: string | null;
  completedAt: string | null;
  exclusionCount: number;
}

const NOTE_AI_TYPES: NoteAiDocType[] = ['lodging-tips', 'tips', 'emergency'];
const PRETRIP_AI_TYPES: NoteAiDocType[] = ['tips', 'lodging-tips'];
const EMERGENCY_AI_TYPES: NoteAiDocType[] = ['emergency'];
const AI_LABELS: Record<NoteAiDocType, string> = {
  'lodging-tips': '住宿在地建議',
  tips: '一般行前須知',
  emergency: '緊急聯絡',
};

function emptyAiJobs(): Record<NoteAiDocType, NoteAiJob> {
  return Object.fromEntries(NOTE_AI_TYPES.map((docType) => [docType, {
    docType,
    status: 'idle',
    jobId: null,
    requestId: null,
    generation: 0,
    insertedCount: 0,
    replacedCount: 0,
    preservedManualCount: 0,
    duplicateExcludedCount: 0,
    suppressedCount: 0,
    errorCode: null,
    errorMessage: null,
    createdAt: null,
    startedAt: null,
    timeoutAt: null,
    completedAt: null,
    exclusionCount: 0,
  }])) as Record<NoteAiDocType, NoteAiJob>;
}

function isActiveAiJob(job: NoteAiJob): boolean {
  return job.status === 'pending' || job.status === 'processing';
}

function AiJobStatus({ job }: { job: NoteAiJob }) {
  if (job.status === 'idle') return null;
  const label = AI_LABELS[job.docType];
  let message: string;
  if (isActiveAiJob(job)) {
    const started = job.startedAt ?? job.createdAt;
    const parsed = started ? Date.parse(`${started.replace(' ', 'T')}Z`) : Number.NaN;
    const minutes = Number.isFinite(parsed)
      ? Math.max(0, Math.floor((Date.now() - parsed) / 60_000))
      : 0;
    // 「通常 3–7 分鐘」對不上實測：completed 的 job 有 12 / 26 / 101 分鐘的。
    // 給區間 + 誠實講明大行程會更久，避免使用者以為卡住了就重按（重按會建新一代）。
    message = `${label}生成中 · 已等待 ${minutes} 分鐘，通常 2–15 分鐘，行程較大時可能更久`;
  } else if (job.status === 'completed') {
    message = `${label}完成：新增 ${job.insertedCount}、替換 ${job.replacedCount}、保留人工 ${job.preservedManualCount}、排除 ${job.duplicateExcludedCount}、略過 ${job.suppressedCount}`;
  } else if (job.status === 'timedOut') {
    message = `${label}已逾時，原有內容未變更；可按重新生成重試`;
  } else {
    message = `${label}生成失敗：${job.errorMessage ?? '原有內容未變更'}；可按重新生成重試`;
  }
  return (
    <div
      className={`tp-notes-ai-status is-${job.status}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid={`trip-notes-ai-status-${job.docType}`}
    >
      {message}
    </div>
  );
}

const SECTIONS: SectionMeta[] = [
  { key: 'flights', title: '航班', icon: 'plane', iconAccent: true, hasAI: false, countLabel: (n) => `${n} 個航段 · 純手動` },
  { key: 'lodgings', title: '住宿', icon: 'home', hasAI: false, countLabel: (n) => `${n} 間` },
  { key: 'reservations', title: '預訂', icon: 'check-square', hasAI: false, countLabel: (n) => `${n} 筆` },
  { key: 'pretrip', title: '行前須知', icon: 'info', hasAI: true, countLabel: (n) => `${n} 項` },
  { key: 'emergency', title: '緊急聯絡', icon: 'phone', hasAI: true, countLabel: (n) => `${n} 個聯絡人` },
];

const SCOPED_STYLES = `
/* minmax(0,1fr) column caps the implicit grid track at the container width —
 * without it the auto column blows out to content max-content → page-body
 * renders wider than the viewport → mobile horizontal scroll (QA 2026-05-30). */
.tp-notes-shell { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 1fr auto; min-height: 100%; background: var(--color-background); }
/* 2026-07-21 dark-mode elevation audit：桌機第三欄（TripStackLayout 右欄 bare panel）
 * 內比中欄內容再高一階 — 面板自己不透明背景需對齊 .app-shell-sheet 的
 * --color-tertiary，否則覆蓋掉那層 base（見 AppShell.tsx 註解）。手機整頁模式
 * （面板在 .app-shell-main 內）不受此 override 影響，維持原本 --color-background。 */
.app-shell-sheet .tp-notes-shell { background: var(--color-tertiary); }
/* 底部為浮動 tab 膠囊讓位。
 *
 * v2.56.6 讓功能頁「全版鋪到底」的前提是 tab **全透明** —— 內容從 tab 之間透出。
 * v2.57.4 材質回歸（0.42 tint + blur 28px）後那個前提不成立了：底下的內容是真的
 * 被遮住。v2.57.5 再從 4 個 tab 變 5 個、膠囊更寬，手機上最後一段手風琴直接
 * 點不到（mobile-chrome / mobile-safari e2e 逾時實證）。
 *
 * 與 AppShell 註解記載的兩次舊事故同型（form confirm 被攔截、地圖 POI 卡按不動）：
 * 容器雖 pointer-events:none，但**按鈕本身吃事件**，tab 一多覆蓋面積就變大。 */
.tp-notes-page-body {
  padding: 16px;
  padding-bottom: calc(16px + var(--nav-overlay-h, 0px));
  max-width: 720px; margin: 0 auto; width: 100%; box-sizing: border-box;
}
@media (min-width: 768px) { .tp-notes-page-body { padding: 24px; max-width: 1040px; } }

/* Empty hero (state A) — 拔 gradient 對齊 editorial restrained */
.tp-notes-empty-hero {
  padding: 24px 20px;
  background: var(--color-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  text-align: center;
  margin-bottom: 16px;
}
.tp-notes-empty-hero-bubble {
  width: 56px; height: 56px; margin: 0 auto 12px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: var(--color-background);
  color: var(--color-accent-deep);
  border: 1px solid var(--color-border);
}
.tp-notes-empty-hero-eyebrow { font-size: var(--font-size-caption2); font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-muted); margin-bottom: 4px; }
.tp-notes-empty-hero-title { font-size: var(--font-size-title3); font-weight: 700; line-height: 1.3; }
.tp-notes-empty-hero-sub { font-size: var(--font-size-footnote); color: var(--color-muted); margin-top: 6px; max-width: 280px; margin-inline: auto; }
.tp-notes-empty-hero-progress { display: flex; justify-content: center; gap: 6px; margin-top: 14px; }
.tp-notes-empty-hero-dot { width: 24px; height: 6px; border-radius: var(--radius-full); background: var(--color-tertiary); }
.tp-notes-empty-hero-dot.is-filled { background: var(--color-accent); }

/* Section accordion */
/* owner 2026-07-22 回報「行程航班的月曆會被外框壓住無法看到全部日期」：
 * 這裡原本有 overflow: hidden（用來裁 head hover 背景的圓角），但它同時把
 * .tp-date-popover（position: absolute）裁掉了 —— popover 的 z-index:1100 對
 * overflow clipping 無效，祖先一旦 hidden 就一定被切。
 * 改為不裁，圓角責任下放給唯一需要它的子元素（head 的 hover 背景）。 */
.tp-notes-section {
  margin-bottom: 12px;
  background: var(--color-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  transition: border-color 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
/* 收合時 head 就是整張卡 → 四角都跟著 section 圓；展開時底部接 body → 收成方角。 */
.tp-notes-section-head { border-radius: inherit; }
.tp-notes-section.is-open .tp-notes-section-head {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}
.tp-notes-section.is-open { border-color: var(--color-line-strong); }
.tp-notes-section.is-suggested { border-color: var(--color-accent-bg); }

.tp-notes-section-head {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px;
  min-height: 44px;
  cursor: pointer;
  user-select: none;
  width: 100%;
  background: transparent;
  border: none;
  text-align: left;
  font: inherit;
  color: inherit;
}
.tp-notes-section-head:hover { background: var(--color-tertiary); }
.tp-notes-section-head:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 2px var(--color-background); }

.tp-notes-section-icon {
  width: 36px; height: 36px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--radius-md);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  flex-shrink: 0;
  color: var(--color-foreground);
}
.tp-notes-section-icon.is-accent {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent-bg);
  color: var(--color-accent-deep);
}
.tp-notes-section-icon .svg-icon { width: 18px; height: 18px; }

.tp-notes-section-titles { flex: 1; min-width: 0; }
.tp-notes-section-title { font-size: var(--font-size-headline); font-weight: 700; line-height: 1.2; }
.tp-notes-section-meta { margin-top: 2px; font-size: var(--font-size-caption); color: var(--color-muted); }
.tp-notes-section-meta.is-warn { color: var(--color-accent-deep); font-weight: 600; }

.tp-notes-section-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

.tp-notes-ai-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
  font-size: var(--font-size-footnote); font-weight: 600;
  min-height: var(--spacing-tap-min);
  border: none;
  cursor: pointer;
  transition: background 150ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.tp-notes-ai-btn:hover { background: var(--color-accent-bg); }
.tp-notes-ai-btn[disabled] { opacity: 0.55; cursor: not-allowed; }

.tp-notes-ai-tools {
  display: grid; gap: 8px; padding: 12px 16px 4px;
}
.tp-notes-ai-status {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
  line-height: 1.45;
}
.tp-notes-ai-status.is-pending,
.tp-notes-ai-status.is-processing {
  border-color: var(--color-accent-bg);
  background: var(--color-accent-subtle);
  color: var(--color-accent-deep);
}
.tp-notes-ai-status.is-failed,
.tp-notes-ai-status.is-timedOut {
  border-color: var(--color-priority-high-dot);
  background: var(--color-priority-high-bg);
  color: var(--color-destructive);
}
.tp-notes-exclusions-btn {
  justify-self: start;
  min-height: var(--spacing-tap-min);
  padding: 6px 0;
  border: 0; background: transparent;
  color: var(--color-accent-deep);
  font: inherit; font-size: var(--font-size-footnote); font-weight: 650;
  cursor: pointer;
}
.tp-notes-exclusions-btn.is-empty { color: var(--color-muted); font-weight: 500; }
.tp-notes-exclusions-btn:hover { text-decoration: underline; }
.tp-notes-exclusions-btn:focus-visible {
  outline: 2px solid var(--color-focus-ring); outline-offset: 2px;
}

.tp-notes-section-chevron {
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--color-muted);
  transition: transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.tp-notes-section.is-open .tp-notes-section-chevron { transform: rotate(180deg); }
.tp-notes-section-chevron .svg-icon { width: 18px; height: 18px; }

.tp-notes-section-body {
  display: none;
  border-top: 1px solid var(--color-border);
}
.tp-notes-section.is-open .tp-notes-section-body { display: block; }
.tp-notes-section-body.is-placeholder {
  padding: 16px;
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
  text-align: center;
}

/* Skeleton (loading state) */
.tp-notes-skel {
  height: 78px;
  background: linear-gradient(90deg, var(--color-secondary) 0%, var(--color-tertiary) 50%, var(--color-secondary) 100%);
  background-size: 200% 100%;
  animation: tp-notes-shimmer 1.6s ease-in-out infinite;
  border-radius: var(--radius-lg);
  margin-bottom: 12px;
}
@keyframes tp-notes-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .tp-notes-skel { animation: none; }
}
`;

export default function TripNotesPage() {
  useRequireAuth();
  const user = useCurrentUser();
  const { tripId } = useParams<{ tripId: string }>();
  const handleBack = useNavigateBack(tripId ? routes.tripsSelected(tripId) : routes.trips());
  // Trip name 從 TripLayout 提供的 TripContext 取；不在 layout 範圍內 (test) 時 fallback。
  // v2.34.x QA F1: 對齊 canonical 顯示名 pattern (title || name)。?? 接不到空字串，
  // destination-named 行程 (title='') 會落到 name (如「東京都、青森縣」) 而非缺名。
  const tripCtx = useContext(TripContext);
  const tripName = tripCtx?.trip?.title?.trim() || tripCtx?.trip?.name?.trim() || null;

  const [data, setData] = useState<NotesAggregator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Mobile: 預設只展 'flights'。Desktop ≥768px：CSS 控所有 section 展（看 :host-context 受限，這裡用 set 全填）
  const [openSet, setOpenSet] = useState<Set<SectionKey>>(() => new Set<SectionKey>(['flights']));

  // Detect desktop on mount → 預展全部
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = (isDesktop: boolean) => {
      if (isDesktop) {
        setOpenSet(new Set<SectionKey>(SECTIONS.map((s) => s.key)));
      } else {
        setOpenSet(new Set<SectionKey>(['flights']));
      }
    };
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const loadData = useCallback(async (showLoading = true) => {
    if (!tripId) return;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<NotesAggregator>(`/trips/${tripId}/notes`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入失敗');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const [aiJobs, setAiJobs] = useState<Record<NoteAiDocType, NoteAiJob>>(emptyAiJobs);
  const [exclusionsDialog, setExclusionsDialog] = useState<'pretrip' | 'emergency' | null>(null);
  const aiStateLoadedRef = useRef(false);
  const announcedJobsRef = useRef(new Set<string>());
  const aiStateRequestRef = useRef(0);
  const aiStateInFlightRef = useRef(false);
  const currentTripIdRef = useRef(tripId);
  currentTripIdRef.current = tripId;

  useEffect(() => {
    aiStateRequestRef.current++;
    aiStateInFlightRef.current = false;
    aiStateLoadedRef.current = false;
    announcedJobsRef.current.clear();
    setAiJobs(emptyAiJobs());
  }, [tripId]);

  const loadAiState = useCallback(async () => {
    if (!tripId || aiStateInFlightRef.current) return;
    aiStateInFlightRef.current = true;
    const requestToken = ++aiStateRequestRef.current;
    try {
      const response = await apiFetch<{ jobs?: Partial<NoteAiJob>[] }>(
        `/trips/${tripId}/notes/ai-state`,
      );
      if (requestToken !== aiStateRequestRef.current) return;
      if (!Array.isArray(response.jobs)) return;
      const next = emptyAiJobs();
      for (const raw of response.jobs) {
        if (!raw.docType || !NOTE_AI_TYPES.includes(raw.docType)) continue;
        next[raw.docType] = { ...next[raw.docType], ...raw };
      }
      if (!aiStateLoadedRef.current) {
        for (const job of Object.values(next)) {
          if (job.jobId && !isActiveAiJob(job) && job.status !== 'idle') {
            announcedJobsRef.current.add(`${job.jobId}:${job.status}`);
          }
        }
        aiStateLoadedRef.current = true;
      }
      setAiJobs(next);
    } catch {
      // 筆記內容仍可使用；job 狀態由下一次 polling / 手動觸發恢復。
    } finally {
      if (requestToken === aiStateRequestRef.current) {
        aiStateInFlightRef.current = false;
      }
    }
  }, [tripId]);

  useEffect(() => {
    void loadAiState();
  }, [loadAiState]);

  const hasActiveAiJob = Object.values(aiJobs).some(isActiveAiJob);
  useEffect(() => {
    if (!hasActiveAiJob) return;
    const timer = window.setInterval(() => void loadAiState(), 3000);
    return () => window.clearInterval(timer);
  }, [hasActiveAiJob, loadAiState]);

  useEffect(() => {
    if (!aiStateLoadedRef.current) return;
    for (const job of Object.values(aiJobs)) {
      if (!job.jobId || isActiveAiJob(job) || job.status === 'idle') continue;
      const key = `${job.jobId}:${job.status}`;
      if (announcedJobsRef.current.has(key)) continue;
      announcedJobsRef.current.add(key);
      if (job.status === 'completed') {
        void loadData(false);
        showToast(`${AI_LABELS[job.docType]}生成完成`, 'success', 4000);
      }
    }
  }, [aiJobs, loadData]);

  const handleAiTrigger = useCallback(async (docType: NoteAiDocType) => {
    if (!tripId || isActiveAiJob(aiJobs[docType])) return;
    try {
      const response = await apiFetch<{
        jobId: number;
        requestId: number;
        status: NoteAiStatus;
        generation: number;
        timeoutAt: string;
      }>(
        `/trips/${tripId}/notes/${docType}/generate`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      if (currentTripIdRef.current !== tripId) return;
      setAiJobs((current) => ({
        ...current,
        [docType]: {
          ...current[docType],
          jobId: response.jobId,
          requestId: response.requestId,
          status: response.status,
          generation: response.generation,
          timeoutAt: response.timeoutAt,
          createdAt: new Date().toISOString(),
          errorCode: null,
          errorMessage: null,
        },
      }));
    } catch (err) {
      if (currentTripIdRef.current !== tripId) return;
      setAiJobs((current) => ({
        ...current,
        [docType]: {
          ...current[docType],
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : 'AI 觸發失敗',
        },
      }));
    }
  }, [tripId, aiJobs]);

  const counts = useMemo(() => {
    if (!data) return { flights: 0, lodgings: 0, reservations: 0, pretrip: 0, emergency: 0, total: 0 };
    return {
      flights: data.flights.length,
      lodgings: data.lodgings.length,
      reservations: data.reservations.length,
      pretrip: data.pretripNotes.length,
      emergency: data.emergencyContacts.length,
      total: data.flights.length + data.lodgings.length + data.reservations.length + data.pretripNotes.length + data.emergencyContacts.length,
    };
  }, [data]);

  const toggleSection = useCallback((key: SectionKey) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const bodyContent = (
    <>
      <style>{SCOPED_STYLES}</style>

      <div className="tp-notes-page-body">
        {loading && (
          <>
            <div className="tp-notes-skel" data-testid="trip-notes-skeleton" />
            <div className="tp-notes-skel" />
            <div className="tp-notes-skel" />
          </>
        )}

        {error && !loading && (
          <AlertPanel
            variant="error"
            title="無法載入行程筆記"
            message={`${error}。你的編輯內容還在，請點重試。`}
            actionLabel="重試"
            onAction={() => void loadData()}
          />
        )}

        {!loading && !error && data && counts.total === 0 && (
          <div className="tp-notes-empty-hero" data-testid="trip-notes-empty-hero">
            <div className="tp-notes-empty-hero-bubble">
              <Icon name="file-text" />
            </div>
            <div className="tp-notes-empty-hero-eyebrow">{tripName ?? '此行程'}</div>
            <div className="tp-notes-empty-hero-title">建立行程筆記</div>
            <div className="tp-notes-empty-hero-sub">
              航班、住宿、預訂、行前須知、緊急聯絡 — 跨工具的雜訊集中在這一頁。
              AI 可代寫 行前須知 / 緊急聯絡。
            </div>
            <div className="tp-notes-empty-hero-progress" aria-label="完成 0 / 5">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="tp-notes-empty-hero-dot" />
              ))}
            </div>
          </div>
        )}

        {!loading && !error && data && SECTIONS.map((sec) => {
          const n = counts[sec.key as keyof typeof counts] as number;
          const isOpen = openSet.has(sec.key);
          const isSuggested = counts.total === 0 && sec.key === 'flights';
          const metaText = n === 0
            ? (sec.hasAI ? '空 · AI 可代寫' : (isSuggested ? '建議先填 · 純手動' : '尚未填寫'))
            : sec.countLabel(n);
          return (
            <div
              key={sec.key}
              className={`tp-notes-section${isOpen ? ' is-open' : ''}${isSuggested ? ' is-suggested' : ''}`}
              data-testid={`trip-notes-section-${sec.key}`}
            >
              <div
                role="button"
                tabIndex={0}
                className="tp-notes-section-head"
                onClick={() => toggleSection(sec.key)}
                onKeyDown={(e) => {
                  // Native-button parity: Enter/Space activate; preventDefault on
                  // Space stops page scroll. The header can't be a <button> because
                  // it contains interactive AI <button>s (invalid nested buttons).
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSection(sec.key);
                  }
                }}
                aria-expanded={isOpen}
                aria-controls={`trip-notes-body-${sec.key}`}
                data-testid={`trip-notes-section-head-${sec.key}`}
              >
                <div className={`tp-notes-section-icon${sec.iconAccent ? ' is-accent' : ''}`}>
                  <Icon name={sec.icon} />
                </div>
                <div className="tp-notes-section-titles">
                  <div className="tp-notes-section-title">{sec.title}</div>
                  <div className={`tp-notes-section-meta${isSuggested ? ' is-warn' : ''}`}>{metaText}</div>
                </div>
                <div className="tp-notes-section-actions" onClick={(e) => e.stopPropagation()}>
                  {/* v2.34.43 prod audit: AI button 只在 section 展開後才 render，
                     避免 user 想點 chevron 展開 section 時誤觸發 AI 生成 long-running job。 */}
                  {isOpen && sec.hasAI && sec.key === 'pretrip' && (
                    <>
                      <button
                        type="button"
                        className="tp-notes-ai-btn"
                        aria-label="AI 生成一般行前須知"
                        data-testid="trip-notes-ai-btn-pretrip"
                        onClick={(e) => { e.stopPropagation(); void handleAiTrigger('tips'); }}
                        disabled={isActiveAiJob(aiJobs.tips)}
                        title={isActiveAiJob(aiJobs.tips) ? '一般行前須知正在生成' : 'AI 生成一般行前須知（貨幣 / 通訊 / 簽證等）'}
                      >
                        <Icon name="sparkle" />
                        {isActiveAiJob(aiJobs.tips) ? '生成中…' : '一般'}
                      </button>
                      <button
                        type="button"
                        className="tp-notes-ai-btn"
                        aria-label="AI 生成住宿在地建議"
                        data-testid="trip-notes-ai-btn-pretrip-lodging"
                        onClick={(e) => {
                          e.stopPropagation();
                          // PR24 guard: lodging-tips 依賴 trip 飯店資料，0 lodging 時不應觸發
                          if (counts.lodgings === 0) {
                            showToast('請先在住宿 section 填寫至少 1 間飯店才能 AI 生成在地建議', 'info', 4000);
                            return;
                          }
                          void handleAiTrigger('lodging-tips');
                        }}
                        disabled={isActiveAiJob(aiJobs['lodging-tips']) || counts.lodgings === 0}
                        title={
                          isActiveAiJob(aiJobs['lodging-tips']) ? '住宿在地建議正在生成' :
                          counts.lodgings === 0 ? '需要先填寫住宿才能 AI 生成在地建議' :
                          'AI 生成住宿在地建議（基於行程飯店）'
                        }
                      >
                        <Icon name="sparkle" />
                        {isActiveAiJob(aiJobs['lodging-tips']) ? '生成中…' : '住宿'}
                      </button>
                    </>
                  )}
                  {isOpen && sec.hasAI && sec.key === 'emergency' && (
                    <button
                      type="button"
                      className="tp-notes-ai-btn"
                      aria-label="AI 生成緊急聯絡"
                      data-testid="trip-notes-ai-btn-emergency"
                      onClick={(e) => { e.stopPropagation(); void handleAiTrigger('emergency'); }}
                      disabled={isActiveAiJob(aiJobs.emergency)}
                      title={isActiveAiJob(aiJobs.emergency) ? '緊急聯絡正在生成' : 'AI 生成緊急聯絡（駐外館處 / 警察 / 救護）'}
                    >
                      <Icon name="sparkle" />
                      {isActiveAiJob(aiJobs.emergency) ? '生成中…' : 'AI'}
                    </button>
                  )}
                  <span className="tp-notes-section-chevron" aria-hidden="true">
                    <Icon name="chevron-down" />
                  </span>
                </div>
              </div>
              {sec.key === 'flights' && tripId ? (
                <div
                  id={`trip-notes-body-${sec.key}`}
                  className="tp-notes-section-body"
                  data-testid={`trip-notes-section-body-${sec.key}`}
                >
                  <FlightsSection
                    tripId={tripId}
                    items={data.flights}
                    onChange={(next) => setData({ ...data, flights: next })}
                  />
                </div>
              ) : sec.key === 'lodgings' && tripId ? (
                <div
                  id={`trip-notes-body-${sec.key}`}
                  className="tp-notes-section-body"
                  data-testid={`trip-notes-section-body-${sec.key}`}
                >
                  <LodgingsSection
                    tripId={tripId}
                    items={data.lodgings}
                    onChange={(next) => setData({ ...data, lodgings: next })}
                  />
                </div>
              ) : sec.key === 'reservations' && tripId ? (
                <div
                  id={`trip-notes-body-${sec.key}`}
                  className="tp-notes-section-body"
                  data-testid={`trip-notes-section-body-${sec.key}`}
                >
                  <ReservationsSection
                    tripId={tripId}
                    items={data.reservations}
                    onChange={(next) => setData({ ...data, reservations: next })}
                  />
                </div>
              ) : sec.key === 'pretrip' && tripId ? (
                <div
                  id={`trip-notes-body-${sec.key}`}
                  className="tp-notes-section-body"
                  data-testid={`trip-notes-section-body-${sec.key}`}
                >
                  <div className="tp-notes-ai-tools">
                    <AiJobStatus job={aiJobs.tips} />
                    <AiJobStatus job={aiJobs['lodging-tips']} />
                    <button
                      type="button"
                      className={`tp-notes-exclusions-btn${aiJobs.tips.exclusionCount + aiJobs['lodging-tips'].exclusionCount === 0 ? ' is-empty' : ''}`}
                      data-testid="trip-notes-exclusions-pretrip"
                      onClick={() => setExclusionsDialog('pretrip')}
                    >
                      已排除 {aiJobs.tips.exclusionCount + aiJobs['lodging-tips'].exclusionCount} 項
                    </button>
                  </div>
                  <PretripSection
                    tripId={tripId}
                    items={data.pretripNotes}
                    onChange={(next) => setData({ ...data, pretripNotes: next })}
                    onAiStateChange={() => void loadAiState()}
                  />
                </div>
              ) : sec.key === 'emergency' && tripId ? (
                <div
                  id={`trip-notes-body-${sec.key}`}
                  className="tp-notes-section-body"
                  data-testid={`trip-notes-section-body-${sec.key}`}
                >
                  <div className="tp-notes-ai-tools">
                    <AiJobStatus job={aiJobs.emergency} />
                    <button
                      type="button"
                      className={`tp-notes-exclusions-btn${aiJobs.emergency.exclusionCount === 0 ? ' is-empty' : ''}`}
                      data-testid="trip-notes-exclusions-emergency"
                      onClick={() => setExclusionsDialog('emergency')}
                    >
                      已排除 {aiJobs.emergency.exclusionCount} 項
                    </button>
                  </div>
                  <EmergencySection
                    tripId={tripId}
                    items={data.emergencyContacts}
                    onChange={(next) => setData({ ...data, emergencyContacts: next })}
                    onAiStateChange={() => void loadAiState()}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {tripId && (
        <NoteAiExclusionsDialog
          open={exclusionsDialog !== null}
          tripId={tripId}
          docTypes={exclusionsDialog === 'pretrip' ? PRETRIP_AI_TYPES : EMERGENCY_AI_TYPES}
          title={exclusionsDialog === 'pretrip' ? '已排除的行前須知' : '已排除的緊急聯絡'}
          onClose={() => setExclusionsDialog(null)}
          onRestored={() => void loadAiState()}
        />
      )}
    </>
  );

  return (
    <OperationShell
      shellClassName="tp-notes-shell"
      testId="trip-notes-page"
      title={tripName ? `行程筆記 — ${tripName}` : '行程筆記'}
      back={handleBack}
      bottomNav={<GlobalBottomNav authed={user !== null} />}
    >
      {bodyContent}
    </OperationShell>
  );
}
