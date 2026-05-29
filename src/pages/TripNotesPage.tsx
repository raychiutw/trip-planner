/**
 * TripNotesPage — 行程筆記全頁
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
 */
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import TitleBar from '../components/shell/TitleBar';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import Icon from '../components/shared/Icon';
import AlertPanel from '../components/shared/AlertPanel';
import FlightsSection from '../components/trip-notes/FlightsSection';
import LodgingsSection from '../components/trip-notes/LodgingsSection';
import ReservationsSection from '../components/trip-notes/ReservationsSection';
import PretripSection from '../components/trip-notes/PretripSection';
import EmergencySection from '../components/trip-notes/EmergencySection';
import { apiFetch } from '../lib/apiClient';
import { showToast } from '../components/shared/Toast';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { useRequestSSE } from '../hooks/useRequestSSE';
import { routes } from '../lib/routes';
import { TripContext } from '../contexts/TripContext';

interface TripFlight { id: number; sortOrder: number; airline: string; flightNo: string; cabinClass: string; departAirport: string; arriveAirport: string; departAt: string; arriveAt: string; note: string; version: number; }
interface TripLodging { id: number; sortOrder: number; name: string; address: string; checkInAt: string; checkOutAt: string; bookingNo: string; phone: string; note: string; version: number; }
interface TripReservation { id: number; sortOrder: number; kind: 'restaurant' | 'experience' | 'ticket' | 'transport' | 'other'; title: string; reservedAt: string; partySize: number; reservationNo: string; phone: string; note: string; version: number; }
interface TripPretripNote { id: number; sortOrder: number; section: string; title: string; content: string; aiGenerated: number; aiSource: string | null; version: number; }
interface TripEmergencyContact { id: number; sortOrder: number; name: string; relationship: string; phone: string; email: string; kind: 'personal' | 'embassy' | 'police' | 'medical' | 'insurance' | 'hotel' | 'other'; aiGenerated: number; version: number; }

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

const SECTIONS: SectionMeta[] = [
  { key: 'flights', title: '航班', icon: 'plane', iconAccent: true, hasAI: false, countLabel: (n) => `${n} 個航段 · 純手動` },
  { key: 'lodgings', title: '住宿', icon: 'home', hasAI: false, countLabel: (n) => `${n} 間` },
  { key: 'reservations', title: '預訂', icon: 'check-square', hasAI: false, countLabel: (n) => `${n} 筆` },
  { key: 'pretrip', title: '行前須知', icon: 'info', hasAI: true, countLabel: (n) => `${n} 項` },
  { key: 'emergency', title: '緊急聯絡', icon: 'phone', hasAI: true, countLabel: (n) => `${n} 個聯絡人` },
];

const SCOPED_STYLES = `
.tp-notes-shell { display: grid; grid-template-rows: auto 1fr auto; min-height: 100%; background: var(--color-background); }
.tp-notes-page-body { padding: 16px; max-width: 720px; margin: 0 auto; width: 100%; box-sizing: border-box; }
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
.tp-notes-section {
  margin-bottom: 12px;
  background: var(--color-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  overflow: hidden;
  transition: border-color 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
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
  min-height: 32px;
  border: none;
  cursor: pointer;
  transition: background 150ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.tp-notes-ai-btn:hover { background: var(--color-accent-bg); }
.tp-notes-ai-btn[disabled] { opacity: 0.55; cursor: not-allowed; }

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
@keyframes tp-notes-pulse {
  0%, 100% { opacity: 0.35; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.1); }
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
  // Trip name 從 TripLayout 提供的 TripContext 取；不在 layout 範圍內 (test) 時 fallback
  const tripCtx = useContext(TripContext);
  const tripName = tripCtx?.trip?.title ?? null;

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

  const loadData = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<NotesAggregator>(`/trips/${tripId}/notes`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ============================================================
  // v2.34.x PR12: AI generation state + polling
  // ============================================================
  const [aiJob, setAiJob] = useState<{ requestId: number; jobId: number; docType: 'lodging-tips' | 'tips' | 'emergency' } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiSse = useRequestSSE(aiJob?.requestId ?? null);
  const aiJobIdRef = useRef<number | null>(null);

  // Track terminal status — refetch + clear job on completed/failed
  useEffect(() => {
    if (!aiJob || !aiSse.status) return;
    if (aiSse.status === 'completed' || aiSse.status === 'failed') {
      // Avoid double-trigger if state lags
      if (aiJobIdRef.current === aiJob.jobId) return;
      aiJobIdRef.current = aiJob.jobId;
      const docType = aiJob.docType;
      setAiJob(null);
      void (async () => {
        if (aiSse.status === 'completed') {
          await loadData(); // refetch aggregator
          showToast(`AI 生成完成（${docType === 'emergency' ? '緊急聯絡' : '行前須知'}）`, 'success', 4000);
        } else {
          setAiError(aiSse.error?.message || 'AI 生成失敗');
        }
      })();
    }
  }, [aiSse.status, aiSse.error, aiJob, loadData]);

  const handleAiTrigger = useCallback(async (docType: 'lodging-tips' | 'tips' | 'emergency') => {
    if (!tripId || aiJob) return;
    setAiError(null);
    try {
      const res = await apiFetch<{ jobId: number; requestId: number; status: string; tripId: string; docType: string }>(
        `/trips/${tripId}/notes/${docType}/generate`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      setAiJob({ requestId: res.requestId, jobId: res.jobId, docType });
      aiJobIdRef.current = null;
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI 觸發失敗');
    }
  }, [tripId, aiJob]);

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

  const main = (
    <div className="tp-notes-shell" data-testid="trip-notes-page">
      <style>{SCOPED_STYLES}</style>
      <TitleBar title={tripName ? `行程筆記 — ${tripName}` : '行程筆記'} back={handleBack} backLabel="回行程" />

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

        {aiError && (
          <AlertPanel
            variant="error"
            title="AI 生成失敗"
            message={`${aiError}。可重試或手動填寫。`}
            actionLabel="關閉"
            onAction={() => setAiError(null)}
          />
        )}

        {aiJob && (
          <div data-testid="trip-notes-ai-pending" style={{
            padding: '12px 16px',
            background: 'var(--color-accent-subtle)',
            color: 'var(--color-accent-deep)',
            borderRadius: 'var(--radius-md)',
            margin: '12px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '14px',
            fontWeight: 600,
          }}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: 'var(--color-accent)',
              animation: 'tp-notes-pulse 1.4s ease-in-out infinite',
            }} />
            AI 正在生成{aiJob.docType === 'emergency' ? '緊急聯絡' : '行前須知'}…通常 3–7 分鐘完成
          </div>
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
              <button
                type="button"
                className="tp-notes-section-head"
                onClick={() => toggleSection(sec.key)}
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
                        disabled={aiJob !== null}
                        title={aiJob !== null ? 'AI 正在處理另一個請求' : 'AI 生成一般行前須知（貨幣 / 通訊 / 簽證等）'}
                      >
                        <Icon name="sparkle" />
                        {aiJob?.docType === 'tips' ? '生成中…' : '一般'}
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
                        disabled={aiJob !== null || counts.lodgings === 0}
                        title={
                          aiJob !== null ? 'AI 正在處理另一個請求' :
                          counts.lodgings === 0 ? '需要先填寫住宿才能 AI 生成在地建議' :
                          'AI 生成住宿在地建議（基於行程飯店）'
                        }
                      >
                        <Icon name="sparkle" />
                        {aiJob?.docType === 'lodging-tips' ? '生成中…' : '住宿'}
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
                      disabled={aiJob !== null}
                      title={aiJob !== null ? 'AI 正在處理另一個請求' : 'AI 生成緊急聯絡（駐外館處 / 警察 / 救護）'}
                    >
                      <Icon name="sparkle" />
                      {aiJob?.docType === 'emergency' ? '生成中…' : 'AI'}
                    </button>
                  )}
                  <span className="tp-notes-section-chevron" aria-hidden="true">
                    <Icon name="chevron-down" />
                  </span>
                </div>
              </button>
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
                  <PretripSection
                    tripId={tripId}
                    items={data.pretripNotes}
                    onChange={(next) => setData({ ...data, pretripNotes: next })}
                  />
                </div>
              ) : sec.key === 'emergency' && tripId ? (
                <div
                  id={`trip-notes-body-${sec.key}`}
                  className="tp-notes-section-body"
                  data-testid={`trip-notes-section-body-${sec.key}`}
                >
                  <EmergencySection
                    tripId={tripId}
                    items={data.emergencyContacts}
                    onChange={(next) => setData({ ...data, emergencyContacts: next })}
                  />
                </div>
              ) : (
                <div
                  id={`trip-notes-body-${sec.key}`}
                  className="tp-notes-section-body is-placeholder"
                  data-testid={`trip-notes-section-body-${sec.key}`}
                >
                  {n === 0 ? '尚未填寫，加項即可。' : `已有 ${n} 項，待後續 PR 接 CRUD UI。`}
                </div>
              )}
            </div>
          );
        })}
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
