import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import '../../css/tokens.css';
import ToastContainer, { showToast } from '../components/shared/Toast';
import PageNav from '../components/shared/PageNav';
import { apiFetchRaw } from '../lib/apiClient';
import { useDarkMode } from '../hooks/useDarkMode';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOfflineToast } from '../hooks/useOfflineToast';
import { useRequests, RawRequest } from '../hooks/useRequests';
import { useRequestSSE } from '../hooks/useRequestSSE';
import { useTripSelector } from '../hooks/useTripSelector';
import { sanitizeHtml } from '../lib/sanitize';
import { lsGet, lsSet, LS_KEY_TRIP_PREF } from '../lib/localStorage';

import { marked } from 'marked';

/* ===== API types ===== */
interface MyTrip {
  tripId: string;
}

interface TripInfo {
  tripId: string;
  name: string;
  published: number | boolean;
}

/** Render Markdown text to sanitized HTML with table wrapping. */
function renderMarkdown(text: string): string {
  return sanitizeHtml(marked.parse(text) as string)
    .replace(/<table([^>]*)>/g, '<div class="table-wrap"><table$1>')
    .replace(/<\/table>/g, '</table></div>');
}

/* ===== Helpers ===== */
function formatDate(iso: string): string {
  return new Date(iso + 'Z').toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const MARKDOWN_STRIP_RE = /[#*_~`>\-|[\]()]/g;
function truncate(text: string, max: number): string {
  const plain = text.replace(MARKDOWN_STRIP_RE, '').trim();
  return plain.length > max ? plain.slice(0, max) + '…' : plain;
}

/* ===== Status Badge ===== */
const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-[var(--badge-completed-bg)] text-[var(--badge-completed-text)]',
  processing: 'bg-[var(--badge-processing-bg)] text-[var(--badge-processing-text)]',
  failed: 'bg-[var(--badge-failed-bg)] text-[var(--badge-failed-text)]',
  open: 'bg-[var(--badge-open-bg)] text-[var(--badge-open-text)]',
};
const STATUS_LABELS: Record<string, string> = {
  completed: '已完成',
  processing: '處理中',
  failed: '處理失敗',
  open: '已送出',
};
function getStatusStyle(status: string): string {
  return STATUS_STYLES[status] || 'bg-[var(--badge-open-bg)] text-[var(--badge-open-text)]';
}
function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || '已送出';
}

/* ===== Processor Icons ===== */
function ProcessorIcon({ processedBy }: { processedBy: string | null }) {
  if (!processedBy) return null;
  if (processedBy === 'api') {
    return (
      <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="inline-block text-muted" aria-hidden="true">
        <title>即時處理</title>
        <path d="M6 1v5l2.5 2.5" /><path d="M2 6a4 4 0 1 0 0-.01" /><path d="M10 3l-1 2.5-2.5-1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="inline-block text-muted" aria-hidden="true">
      <title>排程處理</title>
      <circle cx="6" cy="6" r="4.5" /><path d="M6 3.5v3l2 1.5" />
    </svg>
  );
}

/* ===== Processing Spinner ===== */
function ProcessingSpinner() {
  return <span className="inline-block w-2.5 h-2.5 border-[1.5px] border-[var(--badge-processing-text)] border-t-transparent rounded-full animate-spin" />;
}

/* ===== Processing elapsed time ===== */
function ElapsedTime({ updatedAt }: { updatedAt: string | null }) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!updatedAt) return;
    const update = () => {
      const ts = updatedAt.endsWith('Z') || updatedAt.includes('+') ? updatedAt : updatedAt + 'Z';
      const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
      setElapsed(diff > 0 ? ` · ${diff} 分鐘` : '');
    };
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, [updatedAt]);
  return <>{elapsed}</>;
}

/* ===== Chat Bubble ===== */
const ChatBubble = memo(function ChatBubble({ req }: { req: RawRequest }) {
  const messageHtml = useMemo(() => renderMarkdown(req.message), [req.message]);
  const replyHtml = useMemo(() => req.reply ? renderMarkdown(req.reply) : '', [req.reply]);

  return (
    <div className="flex flex-col gap-2">
      {/* User bubble — right aligned, coral */}
      <div className="flex justify-end">
        <div className="max-w-[85%] md:max-w-[70%]">
          <div className="bg-accent text-accent-foreground rounded-2xl rounded-br-sm px-4 py-2.5">
            <div className="text-body leading-normal break-words" data-reply-content="" dangerouslySetInnerHTML={{ __html: messageHtml }} />
          </div>
          {/* Meta: time + mode + status + processor */}
          <div className="flex items-center gap-2 mt-1 justify-end px-1 flex-wrap">
            <span className="text-caption2 text-muted">{formatDate(req.created_at)}</span>
            <span className={`text-caption2 font-medium ${req.mode === 'trip-edit' ? 'text-accent' : 'text-plan-text'}`}>
              {req.mode === 'trip-edit' ? '改行程' : '問建議'}
            </span>
            <span className={`inline-flex items-center gap-1 py-0.5 px-1.5 rounded-full text-caption2 font-semibold ${getStatusStyle(req.status)}`}>
              {req.status === 'processing' && <ProcessingSpinner />}
              {req.status === 'completed' && <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2.5 6l2.5 2.5 4.5-5" /></svg>}
              {req.status === 'failed' && <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3l6 6M9 3l-6 6" /></svg>}
              {getStatusLabel(req.status)}
              {req.status === 'processing' && <ElapsedTime updatedAt={req.updated_at} />}
            </span>
            {(req.status === 'completed' || req.status === 'failed') && <ProcessorIcon processedBy={req.processed_by} />}
          </div>
        </div>
      </div>

      {/* AI reply bubble — left aligned, sand */}
      {(req.reply || req.status === 'open' || req.status === 'processing') && (
        <div className="flex justify-start">
          <div className="max-w-[85%] md:max-w-[70%]">
            {/* Avatar + name */}
            <div className="flex items-center gap-1.5 mb-1 px-1">
              <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                <svg viewBox="0 0 32 32" fill="none" width="14" height="14">
                  <path d="M4 16 Q10 11, 16 16 Q22 21, 28 16" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                </svg>
              </div>
              <span className="text-caption2 font-semibold text-muted">Tripline</span>
            </div>
            <div className="bg-secondary text-foreground rounded-2xl rounded-bl-sm px-4 py-2.5">
              {req.reply ? (
                <>
                  <div className="border-l-[3px] border-accent bg-black/[0.06] rounded-r-sm px-2.5 py-1.5 mb-2 text-caption text-muted line-clamp-2">
                    {truncate(req.message, 80)}
                  </div>
                  <div className="text-body leading-normal break-words" data-reply-content="" dangerouslySetInnerHTML={{ __html: replyHtml }} />
                </>
              ) : (
                <div className="flex items-center gap-1 py-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="inline-block w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="inline-block w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

/* ===== Page State ===== */
type PageState =
  | { kind: 'loading' }
  | { kind: 'auth-required' }
  | { kind: 'no-permission'; message: string }
  | { kind: 'ready' };

export default function ManagePage() {
  useDarkMode();
  const isOnline = useOnlineStatus();

  /* ----- State ----- */
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' });
  const [filteredTrips, setFilteredTrips] = useState<{ tripId: string; name: string }[]>([]);
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'trip-edit' | 'trip-plan'>('trip-edit');
  const [submitting, setSubmitting] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useOfflineToast(isOnline);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ----- Shared trip selector hook ----- */
  const { currentTripIdRef, handleClose } = useTripSelector(currentTripId);

  /* ----- Requests hook ----- */
  const {
    requests,
    requestsLoading,
    requestsError,
    hasMore,
    loadingMore,
    loadRequests,
    appendRequest,
    updateRequestStatus,
    refreshRequest,
    sentinelRef,
  } = useRequests(currentTripIdRef);

  /* ----- SSE for latest request ----- */
  const [sseRequestId, setSseRequestId] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  /* ----- SSE: track status of the latest non-terminal request ----- */
  const sse = useRequestSSE(sseRequestId);
  useEffect(() => {
    if (sse.status && sseRequestId) {
      updateRequestStatus(sseRequestId, sse.status, sse.processedBy);
      if (sse.status === 'completed') {
        refreshRequest(sseRequestId);
        showToast('你的請求已處理完成！', 'success', 3000);
        setSseRequestId(null);
      } else if (sse.status === 'failed') {
        showToast('處理失敗，請稍後重新提交', 'error', 5000);
        setSseRequestId(null);
      }
    }
  }, [sse.status, sse.processedBy, sseRequestId, updateRequestStatus]);

  /* ----- SSE disconnect warning ----- */
  const sseWasConnectedRef = useRef(false);
  useEffect(() => {
    if (sse.isConnected) {
      sseWasConnectedRef.current = true;
    } else if (sseWasConnectedRef.current && sseRequestId) {
      showToast('連線中斷，狀態可能延遲', 'info');
    }
  }, [sse.isConnected, sseRequestId]);
  // Reset on new SSE session
  useEffect(() => { sseWasConnectedRef.current = false; }, [sseRequestId]);

  /* ----- Scroll to bottom helper ----- */
  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  /* ----- Scroll to bottom on initial load (not on loadMore) ----- */
  const isInitialLoadRef = useRef(true);
  useEffect(() => {
    if (requestsLoading) {
      isInitialLoadRef.current = true;
    } else if (isInitialLoadRef.current && requests.length > 0) {
      isInitialLoadRef.current = false;
      scrollToBottom();
    }
  }, [requestsLoading, requests.length, scrollToBottom]);

  /* ----- Auto-resize textarea (1→5 lines) ----- */
  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 20;
    const maxHeight = lineHeight * 5 + 16; // 5 lines + padding
    ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px';
    ta.style.overflowY = ta.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  /* ----- Init: fetch trips ----- */
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const [myRes, allTripsResult] = await Promise.all([
        apiFetchRaw('/my-trips'),
        apiFetchRaw('/trips?all=1').then(r => r.ok ? r.json() as Promise<TripInfo[]> : Promise.resolve([] as TripInfo[])).catch(() => [] as TripInfo[]),
      ]);

      if (myRes.status === 401 || myRes.status === 403) {
        if (!cancelled) setPageState({ kind: 'no-permission', message: '無法存取，請重新整理頁面' });
        return;
      }
      if (!myRes.ok) {
        if (!cancelled) setPageState({ kind: 'no-permission', message: '無法載入行程資料' });
        return;
      }

      const trips = (await myRes.json()) as MyTrip[];
      if (!trips || trips.length === 0) {
        if (!cancelled) setPageState({ kind: 'no-permission', message: '你目前沒有任何行程權限，請聯繫管理者' });
        return;
      }

      const allTrips = allTripsResult;
      const tripMap: Record<string, TripInfo> = {};
      allTrips.forEach((t) => { tripMap[t.tripId] = t; });

      const filtered = trips.filter((t) => {
        const info = tripMap[t.tripId];
        return !info || (info.published !== 0 && info.published !== false);
      });

      if (filtered.length === 0) {
        if (!cancelled) setPageState({ kind: 'no-permission', message: '目前沒有上架的行程' });
        return;
      }

      const displayList = filtered.map((t) => ({
        tripId: t.tripId,
        name: tripMap[t.tripId]?.name || t.tripId,
      }));

      const savedTrip = lsGet<string>(LS_KEY_TRIP_PREF);
      let initialTrip = filtered[0]?.tripId ?? '';
      if (savedTrip && filtered.some((t) => t.tripId === savedTrip)) {
        initialTrip = savedTrip;
      }

      if (!cancelled) {
        setFilteredTrips(displayList);
        setCurrentTripId(initialTrip);
        setPageState({ kind: 'ready' });
      }
    }

    init().catch(() => {
      if (!cancelled) setPageState({ kind: 'no-permission', message: '無法載入行程資料' });
    });

    return () => { cancelled = true; };
  }, []);

  /* ----- Load requests when trip changes ----- */
  useEffect(() => {
    if (currentTripId && pageState.kind === 'ready') {
      loadRequests(currentTripId);
    }
  }, [currentTripId, pageState.kind, loadRequests]);

  /* ----- Submit request ----- */
  const submitRequest = useCallback(async () => {
    const trimmed = text.trim();
    const tripId = currentTripIdRef.current;
    if (!trimmed || !tripId || submitting) return;

    setSubmitting(true);

    try {
      const res = await apiFetchRaw('/requests', {
        method: 'POST',
        body: JSON.stringify({ tripId, mode, message: trimmed }),
      });

      if (res.status === 201 || res.status === 200) {
        const newReq = (await res.json()) as RawRequest;
        showToast('已送出', 'success');
        setText('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.overflowY = 'hidden';
        }
        // Optimistic append + start SSE
        appendRequest(newReq);
        setSseRequestId(newReq.id);
        setTimeout(scrollToBottom, 50);
      } else if (res.status === 403) {
        throw new Error('你沒有此行程的權限');
      } else {
        throw new Error('送出失敗（' + res.status + '）');
      }
    } catch (err) {
      const errMsg = (err instanceof Error ? err.message : '送出失敗') + '（請重新整理確認是否已送出）';
      showToast(errMsg, 'error', 5000);
    } finally {
      setSubmitting(false);
    }
  }, [text, mode, submitting, appendRequest, scrollToBottom, currentTripIdRef]);

  /* ----- Trip select change ----- */
  function handleTripSelect(tripId: string) {
    lsSet(LS_KEY_TRIP_PREF, tripId);
    setCurrentTripId(tripId);
    setDropdownOpen(false);
  }

  /* ----- Close dropdown on click outside ----- */
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  /* ----- Textarea handlers ----- */
  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
  }

  useEffect(() => { autoResize(); }, [text, autoResize]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && text.trim().length > 0) {
      e.preventDefault();
      submitRequest();
    }
  }

  /* ===== Nav center: trip dropdown ===== */
  const navCenter = pageState.kind === 'ready' ? (
    <div ref={dropdownRef}>
      <button
        className="flex items-center gap-1.5 bg-secondary text-foreground text-[length:var(--font-size-body)] font-semibold py-2 pl-3 pr-2.5 rounded-full min-h-tap-min cursor-pointer border-none transition-colors duration-fast hover:bg-tertiary focus-visible:outline-none"
        aria-label="選擇行程"
        onClick={() => setDropdownOpen(!dropdownOpen)}
      >
        <span className="truncate max-w-[60vw] md:max-w-[300px]">
          {filteredTrips.find(t => t.tripId === currentTripId)?.name || ''}
        </span>
        <svg viewBox="0 0 10 7" fill="none" width="10" height="7" className={`shrink-0 transition-transform duration-fast ${dropdownOpen ? 'rotate-180' : ''}`}>
          <path d="M1 1.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
        </svg>
      </button>
      {dropdownOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-secondary rounded-lg shadow-lg border border-border/50 py-1 min-w-full max-h-[50vh] overflow-y-auto z-(--z-sticky-nav)">
          {filteredTrips.map((t) => (
            <button
              key={t.tripId}
              className={[
                'w-full text-left px-4 py-2.5 border-none bg-transparent cursor-pointer text-[length:var(--font-size-body)] transition-colors duration-fast whitespace-nowrap hover:bg-hover focus-visible:outline-none',
                t.tripId === currentTripId ? 'text-accent font-semibold' : 'text-foreground',
              ].join(' ')}
              onClick={() => handleTripSelect(t.tripId)}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  ) : null;

  /* ===== Render ===== */
  return (
    <div className="flex min-h-dvh">
      <div className="flex-1 min-w-0 max-w-full mx-auto">
        <PageNav isOnline={isOnline} onClose={handleClose} center={navCenter} />

        <ToastContainer />

        {/* Main Content */}
        <main
          className={!isOnline ? 'opacity-50 pointer-events-none' : ''}
          id="manageMain"
        >
          {pageState.kind === 'loading' && (
            <div className="text-center py-10 text-muted">載入中...</div>
          )}

          {pageState.kind === 'auth-required' && (
            <div className="text-muted text-callout text-center py-8 px-4 bg-secondary rounded-md mx-padding-h my-10">
              請先登入
            </div>
          )}

          {pageState.kind === 'no-permission' && (
            <div className="text-muted text-callout text-center py-8 px-4 bg-secondary rounded-md mx-padding-h my-10">
              {pageState.message}
            </div>
          )}

          {/* Ready: chat UI */}
          {pageState.kind === 'ready' && (
            <div className="flex flex-col h-content-h md:max-w-page-max-w mx-auto px-padding-h">
              {/* Messages area */}
              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden">
                <div className="py-4">
                  {/* Sentinel at TOP for loading older messages (ASC mode) */}
                  {hasMore && (
                    <div ref={sentinelRef} className="py-2" aria-hidden="true">
                      {loadingMore && (
                        <div className="text-muted text-caption text-center">載入更多…</div>
                      )}
                    </div>
                  )}

                  {requestsLoading && (
                    <div className="text-muted text-callout text-center py-8">
                      載入中…
                    </div>
                  )}
                  {!requestsLoading && requestsError && (
                    <div className="text-muted text-callout text-center py-8 px-4 bg-secondary rounded-md">
                      {requestsError}
                    </div>
                  )}
                  {!requestsLoading && !requestsError && requests.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-muted">
                      <svg viewBox="0 0 48 48" fill="none" width="48" height="48" className="mb-3 opacity-40">
                        <rect x="4" y="8" width="40" height="32" rx="8" stroke="currentColor" strokeWidth="2" />
                        <path d="M4 16h40" stroke="currentColor" strokeWidth="2" />
                        <circle cx="12" cy="28" r="2" fill="currentColor" />
                        <circle cx="20" cy="28" r="2" fill="currentColor" />
                        <circle cx="28" cy="28" r="2" fill="currentColor" />
                      </svg>
                      <span className="text-callout">開始跟 Tripline 聊天吧</span>
                    </div>
                  )}
                  {!requestsLoading && !requestsError && requests.length > 0 && (
                    <div className="flex flex-col gap-4">
                      {requests.map((req) => (
                        <ChatBubble key={req.id} req={req} />
                      ))}
                    </div>
                  )}

                </div>
              </div>

              {/* Input bar */}
              <div className="shrink-0 pb-[max(32px,env(safe-area-inset-bottom,32px))] pt-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-2 px-1">
                    <button
                      className={[
                        'text-caption font-medium py-1 px-3 rounded-full border transition-colors duration-fast focus-visible:outline-none',
                        mode === 'trip-edit'
                          ? 'border-accent bg-accent-bg text-accent'
                          : 'border-border bg-transparent text-muted hover:bg-hover',
                      ].join(' ')}
                      onClick={() => setMode('trip-edit')}
                    >
                      修改
                    </button>
                    <button
                      className={[
                        'text-caption font-medium py-1 px-3 rounded-full border transition-colors duration-fast focus-visible:outline-none',
                        mode === 'trip-plan'
                          ? 'border-plan-text bg-plan-bg text-plan-text'
                          : 'border-border bg-transparent text-muted hover:bg-hover',
                      ].join(' ')}
                      onClick={() => setMode('trip-plan')}
                    >
                      提問
                    </button>
                  </div>

                  <div className="flex items-end gap-2 bg-secondary rounded-2xl pl-4 pr-1 py-2 shadow-md border border-border/50">
                    <textarea
                      ref={textareaRef}
                      className="flex-1 py-1.5 border-none bg-transparent text-[length:var(--font-size-body)] font-[family-name:var(--font-family-system)] text-foreground resize-none leading-normal overflow-y-hidden focus-visible:outline-none placeholder:text-muted"
                      id="manageText"
                      maxLength={65536}
                      placeholder="輸入你的請求…"
                      rows={1}
                      value={text}
                      onChange={handleTextChange}
                      onKeyDown={handleKeyDown}
                    />
                    <button
                      className={[
                        'w-tap-min h-tap-min border-none rounded-full flex items-center justify-center shrink-0 transition-all duration-normal',
                        text.trim().length === 0 || submitting
                          ? 'bg-border text-muted cursor-not-allowed scale-[0.92]'
                          : 'bg-accent text-accent-foreground cursor-pointer scale-100 hover:brightness-110 active:scale-95',
                      ].join(' ')}
                      id="submitBtn"
                      disabled={text.trim().length === 0 || submitting}
                      aria-label="送出"
                      onClick={submitRequest}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
