import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../css/tokens.css';
import TriplineLogo from '../components/shared/TriplineLogo';
import ToastContainer, { showToast } from '../components/shared/Toast';
import { apiFetch, apiFetchRaw } from '../hooks/useApi';
import { useDarkMode } from '../hooks/useDarkMode';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOfflineToast } from '../hooks/useOfflineToast';
import { sanitizeHtml } from '../lib/sanitize';
import { lsGet, lsSet, LS_KEY_TRIP_PREF } from '../lib/localStorage';

import { marked } from 'marked';

/* ===== API types ===== */
interface RawRequest {
  id: number;
  trip_id: string;
  mode: string;
  message: string;
  submitted_by: string | null;
  reply: string | null;
  status: 'open' | 'received' | 'processing' | 'completed';
  created_at: string;
}

interface MyTrip {
  tripId: string;
}

interface TripInfo {
  tripId: string;
  name: string;
  published: number | boolean;
}

/* ===== Chevron SVG ===== */
const SELECT_CHEVRON = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'7\' fill=\'none\'%3E%3Cpath d=\'M1 1.5l4 4 4-4\' stroke=\'%236B6B6B\' stroke-width=\'1.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")';
const SELECT_STYLE: React.CSSProperties = { backgroundImage: SELECT_CHEVRON, backgroundPosition: 'right 10px center' };

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
const STATUS_STYLES: Record<RawRequest['status'], string> = {
  completed: 'bg-[#D4EDDA] text-[#155724]',
  processing: 'bg-plan-bg text-plan-text',
  received: 'bg-[#FFF3CD] text-[#856404]',
  open: 'bg-[#FFF3CD] text-[#856404]',
};
const STATUS_LABELS: Record<RawRequest['status'], string> = {
  completed: '已回覆',
  processing: '處理中',
  received: '已接收',
  open: '等待中',
};

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
          {/* Meta: time + mode + status */}
          <div className="flex items-center gap-2 mt-1 justify-end px-1">
            <span className="text-caption2 text-muted">{formatDate(req.created_at)}</span>
            <span className={`text-caption2 font-medium ${req.mode === 'trip-edit' ? 'text-accent' : 'text-plan-text'}`}>
              {req.mode === 'trip-edit' ? '改行程' : '問建議'}
            </span>
            <span className={`inline-flex items-center py-0.5 px-1.5 rounded-full text-caption2 font-semibold ${STATUS_STYLES[req.status]}`}>
              {STATUS_LABELS[req.status]}
            </span>
          </div>
        </div>
      </div>

      {/* AI reply bubble — left aligned, sand */}
      {req.reply && (
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
              {/* Quote reply bar */}
              <div className="border-l-[3px] border-accent bg-black/[0.06] rounded-r-sm px-2.5 py-1.5 mb-2 text-caption text-muted line-clamp-2">
                {truncate(req.message, 80)}
              </div>
              <div className="text-body leading-normal break-words" data-reply-content="" dangerouslySetInnerHTML={{ __html: replyHtml }} />
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
  const navigate = useNavigate();

  /* ----- State ----- */
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' });
  const [filteredTrips, setFilteredTrips] = useState<{ tripId: string; name: string }[]>([]);
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const [requests, setRequests] = useState<RawRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestsRef = useRef(requests);
  requestsRef.current = requests;
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'trip-edit' | 'trip-plan'>('trip-edit');
  const [submitting, setSubmitting] = useState(false);

  useOfflineToast(isOnline);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true);
  const currentTripIdRef = useRef(currentTripId);
  currentTripIdRef.current = currentTripId;
  const abortRef = useRef<AbortController | null>(null);

  /* ----- Scroll to bottom ----- */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

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

  /* ----- Display messages: reversed (oldest first) ----- */
  const displayMessages = useMemo(() => [...requests].reverse(), [requests]);

  /* ----- Load requests for a trip (first page) ----- */
  const loadRequests = useCallback(async (tripId: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRequestsLoading(true);
    setRequestsError(null);
    setRequests([]);
    setHasMore(false);

    try {
      const res = await apiFetchRaw('/requests?tripId=' + encodeURIComponent(tripId) + '&limit=10', {
        signal: controller.signal,
      });
      if (res.status === 401) throw new Error('認證失敗，請重新整理頁面');
      if (res.status === 403) throw new Error('你沒有此行程的權限');
      if (!res.ok) throw new Error('載入失敗');
      const data = (await res.json()) as { items: RawRequest[]; hasMore: boolean };
      if (currentTripIdRef.current === tripId) {
        setRequests(data.items);
        setHasMore(data.hasMore);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      if (currentTripIdRef.current === tripId) {
        setRequestsError(err instanceof Error ? err.message : '載入失敗');
      }
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  /* ----- Load more requests (older, prepend) ----- */
  const loadMore = useCallback(async () => {
    const tripId = currentTripIdRef.current;
    if (!tripId || loadingMore || !hasMore) return;

    // "requests" is newest-first from API; oldest item is last in array
    const last = requestsRef.current[requestsRef.current.length - 1];
    if (!last) return;

    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        tripId,
        limit: '10',
        before: last.created_at,
        beforeId: String(last.id),
      });
      const res = await apiFetchRaw('/requests?' + params.toString());
      if (!res.ok) throw new Error('載入失敗');
      const data = (await res.json()) as { items: RawRequest[]; hasMore: boolean };
      if (currentTripIdRef.current === tripId) {
        setRequests(prev => [...prev, ...data.items]);
        setHasMore(data.hasMore);
      }
    } catch {
      // 靜默失敗 — 使用者可再次滾動觸發
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  /* ----- Init: fetch trips ----- */
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const [myRes, allTripsResult] = await Promise.all([
        apiFetchRaw('/my-trips'),
        apiFetch<TripInfo[]>('/trips?all=1').catch(() => [] as TripInfo[]),
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
      let initialTrip = filtered[0].tripId;
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
      isInitialLoadRef.current = true;
      loadRequests(currentTripId);
    }
  }, [currentTripId, pageState.kind, loadRequests]);

  /* ----- Scroll to bottom after initial load (not loadMore) ----- */
  useEffect(() => {
    if (!requestsLoading && requests.length > 0 && isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [requestsLoading, requests.length, scrollToBottom]);

  /* ----- Infinite scroll: sentinel at TOP for loading older messages ----- */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

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
        await res.json();
        showToast('已送出', 'success');
        setText('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.overflowY = 'hidden';
        }
        await loadRequests(tripId);
        setTimeout(() => scrollToBottom(), 150);
      } else if (res.status === 403) {
        throw new Error('你沒有此行程的權限');
      } else {
        throw new Error('送出失敗（' + res.status + '）');
      }
    } catch (err) {
      if (!(err instanceof Error && err.message.includes('權限'))) {
        await loadRequests(tripId).catch(() => {/* ignore */});
      }
      const errMsg = (err instanceof Error ? err.message : '送出失敗') + '（請重新整理確認是否已送出）';
      showToast(errMsg, 'error', 5000);
    } finally {
      setSubmitting(false);
    }
  }, [text, mode, submitting, loadRequests, scrollToBottom]);

  /* ----- Trip select change ----- */
  function handleTripChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    lsSet(LS_KEY_TRIP_PREF, val);
    setCurrentTripId(val);
  }

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

  /* ----- Close button ----- */
  function handleClose() {
    const tripId = lsGet<string>(LS_KEY_TRIP_PREF);
    navigate(tripId ? `/trip/${tripId}` : '/');
  }

  /* ===== Render ===== */
  return (
    <div className="flex min-h-dvh">
      <div className="flex-1 min-w-0 max-w-full mx-auto">
        {/* Sticky Nav — glassmorphism */}
        <div
          className="sticky top-0 z-(--z-sticky-nav) border-b border-border bg-(--color-glass-nav) backdrop-blur-xl backdrop-saturate-200 text-foreground py-2 px-padding-h flex items-center gap-2"
          id="stickyNav"
        >
          <TriplineLogo isOnline={isOnline} />
          {pageState.kind === 'ready' && (
            <select
              className="absolute left-1/2 -translate-x-1/2 appearance-none border-none bg-secondary text-foreground font-inherit text-callout font-semibold py-2 pl-3 pr-7 cursor-pointer bg-no-repeat rounded-full min-h-tap-min max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap transition-colors duration-fast hover:bg-tertiary focus-visible:outline-none"
              style={SELECT_STYLE}
              aria-label="選擇行程"
              value={currentTripId || ''}
              onChange={handleTripChange}
            >
              {filteredTrips.map((t) => (
                <option key={t.tripId} value={t.tripId}>{t.name}</option>
              ))}
            </select>
          )}
          <button
            className="flex items-center justify-center w-tap-min h-tap-min p-0 border-none rounded-full bg-transparent text-foreground shrink-0 transition-colors duration-fast hover:text-accent hover:bg-accent-bg focus-visible:outline-none ml-auto"
            id="navCloseBtn"
            aria-label="關閉"
            onClick={handleClose}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

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
            <div className="flex flex-col h-content-h max-w-page-max-w mx-auto px-padding-h">
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <div className="py-4">
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
                  {!requestsLoading && !requestsError && displayMessages.length > 0 && (
                    <div className="flex flex-col gap-4">
                      {displayMessages.map((req) => (
                        <ChatBubble key={req.id} req={req} />
                      ))}
                    </div>
                  )}

                  <div ref={messagesEndRef} aria-hidden="true" />
                </div>
              </div>

              {/* Input bar */}
              <div className="shrink-0 pb-[max(12px,env(safe-area-inset-bottom,12px))] pt-1">
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
