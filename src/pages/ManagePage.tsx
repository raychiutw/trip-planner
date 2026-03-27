import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../css/tokens.css';
import TriplineLogo from '../components/shared/TriplineLogo';
import Toast from '../components/shared/Toast';
import RequestStepper from '../components/shared/RequestStepper';
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

/* ===== Scoped styles ===== */
const SCOPED_STYLES = `
body.dark [data-send-btn]:disabled { background: var(--color-hover); color: var(--color-muted); }
[data-reply-content] { font-size: var(--font-size-body); color: var(--color-foreground); line-height: var(--line-height-normal); overflow-wrap: break-word; word-break: break-word; }
[data-reply-content] a { color: var(--color-accent); text-decoration: none; }
[data-reply-content] a:hover { text-decoration: underline; }
[data-reply-content] h2, [data-reply-content] h3 { font-size: var(--font-size-title3); margin: 12px 0 8px; color: var(--color-foreground); }
[data-reply-content] h2:first-child, [data-reply-content] h3:first-child { margin-top: 0; }
[data-reply-content] p { margin: 4px 0; }
[data-reply-content] strong { font-weight: 600; }
[data-reply-content] ul, [data-reply-content] ol { padding-left: 20px; margin: 4px 0; }
[data-reply-content] hr { border: none; border-top: 1px solid var(--color-border); margin: 12px 0; }
[data-reply-content] .table-wrap { overflow-x: auto; margin: 8px 0; }
[data-reply-content] table { width: 100%; border-collapse: collapse; margin: 0; }
[data-reply-content] th, [data-reply-content] td { border: 1px solid var(--color-border); padding: 8px 12px; text-align: left; }
[data-reply-content] th { background: var(--color-tertiary); font-weight: 600; white-space: nowrap; }
[data-reply-content] blockquote { margin: 8px 0; padding: 8px 12px; border-left: 3px solid var(--color-accent); background: var(--color-accent-subtle); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
[data-reply-content] code { background: var(--color-tertiary); padding: 4px 4px; border-radius: var(--radius-xs); font-size: var(--font-size-callout); }
[data-reply-content] pre { background: var(--color-tertiary); padding: 12px; border-radius: var(--radius-sm); overflow-x: auto; margin: 8px 0; }
[data-reply-content] pre code { background: none; padding: 0; }
`;

/* ===== Chevron SVG ===== */
const SELECT_CHEVRON = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'7\' fill=\'none\'%3E%3Cpath d=\'M1 1.5l4 4 4-4\' stroke=\'%236B6B6B\' stroke-width=\'1.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")';
const SELECT_STYLE: React.CSSProperties = { backgroundImage: SELECT_CHEVRON, backgroundPosition: 'right 10px center' };
const EMPTY_LIST_STYLE: React.CSSProperties = { minHeight: '100%' };

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

const RequestItem = memo(function RequestItem({ req }: { req: RawRequest }) {
  const messageHtml = useMemo(() => renderMarkdown(req.message), [req.message]);
  const replyHtml = useMemo(() => req.reply ? renderMarkdown(req.reply) : '', [req.reply]);

  return (
    <div className="py-3 px-4 bg-secondary rounded-md transition-colors duration-fast overflow-hidden max-w-full hover:bg-hover">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={[
            'inline-flex items-center py-1 px-2 rounded-full text-caption font-semibold whitespace-nowrap shrink-0 min-h-6 leading-none',
            req.mode === 'trip-edit'
              ? 'bg-accent-bg text-accent'
              : 'bg-plan-bg text-plan-text',
          ].join(' ')}
        >
          {req.mode === 'trip-edit' ? '改行程' : '問建議'}
        </span>
        <span className="text-footnote text-muted ml-auto">
          {formatDate(req.created_at)}
        </span>
      </div>

      <div className="text-callout md:text-title3 text-foreground mt-2 leading-normal break-words" data-reply-content="" dangerouslySetInnerHTML={{ __html: messageHtml }} />

      {req.submitted_by && (
        <div className="text-footnote text-muted mt-1">
          {req.submitted_by}
        </div>
      )}

      <RequestStepper status={req.status} />

      {req.reply && (
        <>
          <div className="border-t border-border my-3" />
          <div data-reply-content="" dangerouslySetInnerHTML={{ __html: replyHtml }} />
        </>
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
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'trip-edit' | 'trip-plan'>('trip-edit');
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { showOffline, showReconnect } = useOfflineToast(isOnline);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentTripIdRef = useRef(currentTripId);
  currentTripIdRef.current = currentTripId;
  const abortRef = useRef<AbortController | null>(null);

  /* ----- Auto-resize textarea ----- */
  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }, []);

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

  /* ----- Load more requests (next page) ----- */
  const loadMore = useCallback(async () => {
    const tripId = currentTripIdRef.current;
    if (!tripId || loadingMore || !hasMore) return;

    const last = requests[requests.length - 1];
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
  }, [requests, loadingMore, hasMore]);

  /* ----- Init: fetch trips ----- */
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 並行發送：my-trips（需 auth）+ trips（公開）
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
      loadRequests(currentTripId);
    }
  }, [currentTripId, pageState.kind, loadRequests]);

  /* ----- Infinite scroll: IntersectionObserver ----- */
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
    setSubmitStatus(null);

    try {
      const res = await apiFetchRaw('/requests', {
        method: 'POST',
        body: JSON.stringify({ tripId, mode, message: trimmed }),
      });

      if (res.status === 201 || res.status === 200) {
        await res.json();
        setSubmitStatus({ type: 'success', message: '已送出' });
        setText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        // 用 captured tripId，不 re-read ref — 避免 async gap 期間 trip 被切換
        await loadRequests(tripId);
      } else if (res.status === 403) {
        throw new Error('你沒有此行程的權限');
      } else {
        throw new Error('送出失敗（' + res.status + '）');
      }
    } catch (err) {
      // #4: 只在非 auth 錯誤時重載列表
      if (!(err instanceof Error && err.message.includes('權限'))) {
        await loadRequests(tripId).catch(() => {/* ignore */});
      }
      setSubmitStatus({
        type: 'error',
        message: (err instanceof Error ? err.message : '送出失敗') + '（請重新整理確認是否已送出）',
      });
    } finally {
      setSubmitting(false);
    }
  }, [text, mode, submitting, loadRequests]);

  /* ----- Trip select change ----- */
  function handleTripChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    lsSet(LS_KEY_TRIP_PREF, val);
    setCurrentTripId(val);
    setSubmitStatus(null);
  }

  /* ----- Textarea handlers ----- */
  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    setSubmitStatus(null);
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
      <style>{SCOPED_STYLES}</style>
      <div className="flex-1 min-w-0 max-w-full mx-auto">
        {/* Sticky Nav */}
        <div
          className="sticky top-0 z-(--z-sticky-nav) border-b border-border bg-(--color-glass-nav) backdrop-blur-xl backdrop-saturate-200 text-foreground py-2 px-padding-h flex items-center gap-2"
          id="stickyNav"
        >
          <TriplineLogo isOnline={isOnline} />
          {pageState.kind === 'ready' && (
            <select
              className="absolute left-1/2 -translate-x-1/2 appearance-none border-none bg-secondary text-foreground font-inherit text-callout font-semibold py-2 pl-3 pr-7 cursor-pointer bg-no-repeat rounded-full min-h-tap-min max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap transition-colors duration-fast hover:bg-tertiary focus-visible:outline-none focus-visible:shadow-ring"
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
            className="flex items-center justify-center w-tap-min h-tap-min p-0 border-none rounded-full bg-transparent text-foreground shrink-0 transition-colors duration-fast hover:text-accent hover:bg-accent-bg focus-visible:outline-none focus-visible:shadow-ring ml-auto"
            id="navCloseBtn"
            aria-label="關閉"
            onClick={handleClose}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {showOffline && <Toast message="已離線 — 無法送出修改請求" icon="offline" visible={showOffline} />}
        {showReconnect && <Toast message="已恢復連線" icon="online" visible={showReconnect} />}

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
            <div className="flex flex-col h-content-h">
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto py-4 px-padding-h">
                <div
                  className={[
                    'flex flex-col gap-3 md:max-w-page-max-w md:mx-auto md:pt-page-pt',
                    requests.length === 0 ? 'justify-center flex-1' : '',
                  ].join(' ')}
                  style={requests.length === 0 ? EMPTY_LIST_STYLE : undefined}
                >
                  <div id="manageRequests">
                    {requestsLoading && (
                      <div className="text-muted text-callout text-center py-8 px-4 bg-secondary rounded-md">
                        載入中…
                      </div>
                    )}
                    {!requestsLoading && requestsError && (
                      <div className="text-muted text-callout text-center py-8 px-4 bg-secondary rounded-md">
                        {requestsError}
                      </div>
                    )}
                    {!requestsLoading && !requestsError && requests.length === 0 && (
                      <div className="text-muted text-callout text-center py-8 px-4 bg-secondary rounded-md">
                        尚無請求紀錄
                      </div>
                    )}
                    {!requestsLoading && !requestsError && requests.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {requests.map((req) => (
                          <RequestItem key={req.id} req={req} />
                        ))}
                        {loadingMore && (
                          <div className="text-muted text-caption text-center py-4">載入更多…</div>
                        )}
                        {!hasMore && requests.length >= 10 && (
                          <div className="text-muted text-caption text-center py-4">沒有更多了</div>
                        )}
                        <div ref={sentinelRef} aria-hidden="true" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Input bar */}
              <div className="shrink-0 py-2 px-padding-h pb-[max(16px,env(safe-area-inset-bottom,16px))] overflow-y-hidden">
                <div className="bg-secondary rounded-lg pt-3 px-3 pb-2 shadow-md md:max-w-page-max-w md:mx-auto">
                  <textarea
                    ref={textareaRef}
                    className="w-full py-2 px-1 border-none bg-transparent font-inherit text-body text-foreground resize-none leading-normal min-h-[3.6em] max-h-[30vh] overflow-y-auto focus-visible:outline-none focus-visible:shadow-ring focus-visible:rounded-xs placeholder:text-muted"
                    id="manageText"
                    maxLength={65536}
                    placeholder={'例如：\n· Day 3 午餐換成通堂拉麵\n· 刪除美麗海水族館，改去萬座毛\n· Day 5 下午加一個 AEON 購物'}
                    rows={1}
                    value={text}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                  />
                  <div className="flex items-center gap-2 mt-2 justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        className={[
                          'appearance-none border-none bg-transparent text-muted font-inherit text-callout font-normal py-2 px-3 rounded-full cursor-pointer min-h-tap-min transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-ring',
                          mode === 'trip-edit'
                            ? 'bg-accent-bg !text-accent !font-semibold hover:brightness-95'
                            : 'hover:bg-hover',
                        ].join(' ')}
                        onClick={() => setMode('trip-edit')}
                      >
                        改行程
                      </button>
                      <button
                        className={[
                          'appearance-none border-none bg-transparent text-muted font-inherit text-callout font-normal py-2 px-3 rounded-full cursor-pointer min-h-tap-min transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-ring',
                          mode === 'trip-plan'
                            ? 'bg-plan-bg !text-plan-text !font-semibold hover:bg-plan-hover'
                            : 'hover:bg-hover',
                        ].join(' ')}
                        onClick={() => setMode('trip-plan')}
                      >
                        問建議
                      </button>
                    </div>

                    <div aria-live="polite" className="flex-1 min-w-0">
                      {submitStatus && (
                        <div
                          className={[
                            'text-footnote rounded-sm',
                            submitStatus.type === 'success'
                              ? 'text-success flex items-center gap-1'
                              : 'text-destructive',
                          ].join(' ')}
                        >
                          {submitStatus.type === 'success' && (
                            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                            </svg>
                          )}
                          {submitStatus.message}
                        </div>
                      )}
                    </div>

                    <button
                      className={[
                        'w-tap-min h-tap-min border-none rounded-full flex items-center justify-center shrink-0 transition-all duration-normal',
                        text.trim().length === 0 || submitting
                          ? 'bg-border text-muted cursor-not-allowed scale-[0.92]'
                          : 'bg-accent text-accent-foreground cursor-pointer scale-100 hover:brightness-110 active:scale-95',
                      ].join(' ')}
                      id="submitBtn"
                      data-send-btn=""
                      disabled={text.trim().length === 0 || submitting}
                      aria-label="送出"
                      onClick={submitRequest}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path d="M11 5.83L6.41 10.41 5 9l7-7 7 7-1.41 1.41L13 5.83V20h-2V5.83z" />
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
