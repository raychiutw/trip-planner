import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import Icon from '../components/shared/Icon';
import TriplineLogo from '../components/shared/TriplineLogo';
import Toast from '../components/shared/Toast';
import RequestStepper from '../components/shared/RequestStepper';
import { apiFetch } from '../hooks/useApi';
import { useDarkMode } from '../hooks/useDarkMode';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOfflineToast } from '../hooks/useOfflineToast';
import { sanitizeHtml } from '../lib/sanitize';
import { lsGet, lsSet, LS_KEY_TRIP_PREF } from '../lib/localStorage';

import { marked } from 'marked';

/* ===== Raw API types (snake_case from D1) ===== */

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

/* ===== Request Item Component ===== */

function formatDate(iso: string): string {
  return new Date(iso + 'Z').toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function RequestItem({ req }: { req: RawRequest }) {
  const replyHtml = req.reply
    ? sanitizeHtml(marked.parse(req.reply) as string).replace(
        /<table([^>]*)>/g,
        '<div class="table-wrap"><table$1>',
      ).replace(/<\/table>/g, '</table></div>')
    : '';

  return (
    <div className="px-4 py-3 bg-[var(--color-secondary)] rounded-[var(--radius-md)] transition-colors duration-150 hover:bg-[var(--color-hover)] overflow-hidden max-w-full">
      {/* Header: mode badge + time */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={clsx(
            'inline-flex items-center px-2 py-1 rounded-full text-[var(--font-size-caption)] font-semibold whitespace-nowrap shrink-0 min-h-6 leading-none',
            req.mode === 'trip-edit'
              ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]'
              : 'bg-[var(--color-plan-bg)] text-[var(--color-plan-text)]',
          )}
        >
          {req.mode === 'trip-edit' ? '改行程' : '問建議'}
        </span>
        <span className="text-[var(--font-size-footnote)] text-[var(--color-muted)] ml-auto">
          {formatDate(req.created_at)}
        </span>
      </div>

      {/* Message */}
      <div className="text-[var(--font-size-callout)] text-[var(--color-foreground)] mt-2 leading-[var(--line-height-normal)] break-words md:text-[var(--font-size-title3)]">
        {req.message}
      </div>

      {/* Submitted by */}
      {req.submitted_by && (
        <div className="text-[var(--font-size-footnote)] text-[var(--color-muted)] mt-1">
          {req.submitted_by}
        </div>
      )}

      {/* Stepper */}
      <RequestStepper status={req.status} />

      {/* Reply (if completed) */}
      {req.reply && (
        <>
          <hr className="border-none border-t border-[var(--color-border)] my-3" />
          <div
            className={clsx(
              'text-[var(--font-size-body)] text-[var(--color-foreground)] leading-[var(--line-height-normal)] break-words',
              '[&_a]:text-[var(--color-accent)] [&_a]:no-underline [&_a:hover]:underline',
              '[&_h2]:text-[var(--font-size-title3)] [&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-[var(--color-foreground)]',
              '[&_h3]:text-[var(--font-size-title3)] [&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:text-[var(--color-foreground)]',
              '[&_h2:first-child]:mt-0 [&_h3:first-child]:mt-0',
              '[&_p]:my-1',
              '[&_strong]:font-semibold',
              '[&_ul]:pl-5 [&_ul]:my-1',
              '[&_ol]:pl-5 [&_ol]:my-1',
              '[&_hr]:border-none [&_hr]:border-t [&_hr]:border-[var(--color-border)] [&_hr]:my-3',
              '[&_.table-wrap]:overflow-x-auto [&_.table-wrap]:my-2',
              '[&_table]:w-full [&_table]:border-collapse [&_table]:m-0',
              '[&_th]:border [&_th]:border-[var(--color-border)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:bg-[var(--color-tertiary)] [&_th]:font-semibold [&_th]:whitespace-nowrap',
              '[&_td]:border [&_td]:border-[var(--color-border)] [&_td]:px-3 [&_td]:py-2 [&_td]:text-left',
              '[&_blockquote]:my-2 [&_blockquote]:py-2 [&_blockquote]:px-3 [&_blockquote]:border-l-[3px] [&_blockquote]:border-l-[var(--color-accent)] [&_blockquote]:bg-[var(--color-accent-subtle)] [&_blockquote]:rounded-r-[var(--radius-sm)]',
              '[&_code]:bg-[var(--color-tertiary)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded-[var(--radius-xs)] [&_code]:text-[var(--font-size-callout)]',
              '[&_pre]:bg-[var(--color-tertiary)] [&_pre]:p-3 [&_pre]:rounded-[var(--radius-sm)] [&_pre]:overflow-x-auto [&_pre]:my-2',
              '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
            )}
            dangerouslySetInnerHTML={{ __html: replyHtml }}
          />
        </>
      )}
    </div>
  );
}

/* ===== ManagePage Component ===== */

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
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'trip-edit' | 'trip-plan'>('trip-edit');
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { showOffline, showReconnect } = useOfflineToast(isOnline);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ----- Auto-resize textarea ----- */
  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }, []);

  /* ----- Load requests for a trip ----- */
  const loadRequests = useCallback(async (tripId: string) => {
    setRequestsLoading(true);
    setRequestsError(null);
    setRequests([]);

    try {
      const res = await fetch('/api/requests?tripId=' + encodeURIComponent(tripId), {
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.status === 403) throw new Error('你沒有此行程的權限');
      if (!res.ok) throw new Error('載入失敗');
      const data = (await res.json()) as RawRequest[];
      setRequests(data);
    } catch (err) {
      setRequestsError(err instanceof Error ? err.message : '載入失敗');
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  /* ----- Init: fetch trips ----- */
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Step 1: get my-trips
      const myRes = await fetch('/api/my-trips', {
        headers: { 'Content-Type': 'application/json' },
      });

      if (myRes.status === 401) {
        if (!cancelled) setPageState({ kind: 'auth-required' });
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

      // Step 2: fetch all trips for names + published status
      let allTrips: TripInfo[] = [];
      try {
        allTrips = await apiFetch<TripInfo[]>('/trips?all=1');
      } catch {
        // ignore — fallback to tripId as name
      }

      const tripMap: Record<string, TripInfo> = {};
      allTrips.forEach((t) => { tripMap[t.tripId] = t; });

      // Only keep published trips the user has permission for
      const filtered = trips.filter((t) => {
        const info = tripMap[t.tripId];
        return !info || (info.published !== 0 && info.published !== false);
      });

      if (filtered.length === 0) {
        if (!cancelled) setPageState({ kind: 'no-permission', message: '目前沒有上架的行程' });
        return;
      }

      // Build display list
      const displayList = filtered.map((t) => ({
        tripId: t.tripId,
        name: tripMap[t.tripId]?.name || t.tripId,
      }));

      // Decide initial trip: localStorage > first
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

  /* ----- Submit request ----- */
  const submitRequest = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !currentTripId || submitting) return;

    setSubmitting(true);
    setSubmitStatus(null);

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: currentTripId,
          mode,
          message: trimmed,
        }),
      });

      if (res.status === 201 || res.status === 200) {
        const req = (await res.json()) as RawRequest;
        setSubmitStatus({ type: 'success', message: '已送出' });
        setText('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        // Reload list to reflect latest state (including dedup 200 case)
        if (currentTripId) {
          await loadRequests(currentTripId);
        } else {
          setRequests((prev) => [req, ...prev]);
        }
      } else if (res.status === 403) {
        throw new Error('你沒有此行程的權限');
      } else {
        throw new Error('送出失敗（' + res.status + '）');
      }
    } catch (err) {
      // 失敗後重新載入列表，讓使用者確認是否已送出
      if (currentTripId) {
        await loadRequests(currentTripId).catch(() => {/* ignore reload error */});
      }
      setSubmitStatus({
        type: 'error',
        message: (err instanceof Error ? err.message : '送出失敗') + '（請重新整理確認是否已送出）',
      });
    } finally {
      setSubmitting(false);
    }
  }, [text, currentTripId, mode, submitting]);

  /* ----- Handle trip select change ----- */
  const handleTripChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      lsSet(LS_KEY_TRIP_PREF, val);
      setCurrentTripId(val);
    },
    [],
  );

  /* ----- Handle textarea input ----- */
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      setSubmitStatus(null);
    },
    [],
  );

  /* ----- Auto-resize on text change ----- */
  useEffect(() => {
    autoResize();
  }, [text, autoResize]);

  /* ----- Handle Enter to submit ----- */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (text.trim().length > 0) {
          e.preventDefault();
          submitRequest();
        }
      }
    },
    [text, submitRequest],
  );

  /* ----- Close button ----- */
  const handleClose = useCallback(() => {
    const tripId = lsGet<string>(LS_KEY_TRIP_PREF);
    navigate(tripId ? `/trip/${tripId}` : '/');
  }, [navigate]);

  /* ===== Render ===== */

  return (
    <div className="page-layout">
      <div className="container">
        {/* ----- Sticky Nav ----- */}
        <div className="sticky-nav" id="stickyNav">
          <TriplineLogo isOnline={isOnline} />
          {pageState.kind === 'ready' && (
            <select
              className={clsx(
                'appearance-none border-none bg-[var(--color-secondary)] text-[var(--color-foreground)]',
                'font-[inherit] text-[var(--font-size-callout)] font-semibold',
                'py-2 pl-3 pr-7 rounded-full cursor-pointer min-h-[var(--tap-min)]',
                'bg-no-repeat bg-[right_10px_center] max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap',
                'transition-colors duration-150 hover:bg-[var(--color-tertiary)]',
                'focus-visible:outline-none focus-visible:shadow-[var(--shadow-ring)]',
                '[background-image:url("data:image/svg+xml,%3Csvg%20xmlns%3D\'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg\'%20width%3D\'10\'%20height%3D\'7\'%20fill%3D\'none\'%3E%3Cpath%20d%3D\'M1%201.5l4%204%204-4\'%20stroke%3D\'%236B6B6B\'%20stroke-width%3D\'1.5\'%20stroke-linecap%3D\'round\'%20stroke-linejoin%3D\'round\'%2F%3E%3C%2Fsvg%3E")]',
                'absolute left-1/2 -translate-x-1/2',
              )}
              aria-label="選擇行程"
              value={currentTripId || ''}
              onChange={handleTripChange}
            >
              {filteredTrips.map((t) => (
                <option key={t.tripId} value={t.tripId}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <button
            className="nav-close-btn ml-auto"
            id="navCloseBtn"
            aria-label="關閉"
            onClick={handleClose}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Toast notifications — conditionally rendered to avoid hidden DOM nodes */}
        {showOffline && (
          <Toast
            message="已離線 — 無法送出修改請求"
            icon="offline"
            visible={showOffline}
          />
        )}
        {showReconnect && (
          <Toast
            message="已恢復連線"
            icon="online"
            visible={showReconnect}
          />
        )}

        {/* ----- Main Content ----- */}
        <main className={clsx(!isOnline && 'offline-disabled')} id="manageMain">
          {/* Loading state */}
          {pageState.kind === 'loading' && (
            <div className="text-center p-10 text-[var(--color-muted)]">
              載入中...
            </div>
          )}

          {/* Auth required */}
          {pageState.kind === 'auth-required' && (
            <div className="text-[var(--color-muted)] text-[var(--font-size-callout)] text-center py-8 px-4 bg-[var(--color-secondary)] rounded-[var(--radius-md)] mx-[var(--padding-h)] my-10">
              請先登入
            </div>
          )}

          {/* No permission / no published trips */}
          {pageState.kind === 'no-permission' && (
            <div className="text-[var(--color-muted)] text-[var(--font-size-callout)] text-center py-8 px-4 bg-[var(--color-secondary)] rounded-[var(--radius-md)] mx-[var(--padding-h)] my-10">
              {pageState.message}
            </div>
          )}

          {/* Ready: chat UI */}
          {pageState.kind === 'ready' && (
            <div className="chat-container">
              {/* Messages area */}
              <div className="chat-messages">
                <div
                  className={clsx(
                    'chat-messages-inner',
                    requests.length === 0 && 'chat-messages-inner--centered',
                  )}
                >
                  <div id="manageRequests">
                    {requestsLoading && (
                      <div className="text-[var(--color-muted)] text-[var(--font-size-callout)] text-center py-8 px-4 bg-[var(--color-secondary)] rounded-[var(--radius-md)]">
                        載入中…
                      </div>
                    )}
                    {!requestsLoading && requestsError && (
                      <div className="text-[var(--color-muted)] text-[var(--font-size-callout)] text-center py-8 px-4 bg-[var(--color-secondary)] rounded-[var(--radius-md)]">
                        {requestsError}
                      </div>
                    )}
                    {!requestsLoading && !requestsError && requests.length === 0 && (
                      <div className="text-[var(--color-muted)] text-[var(--font-size-callout)] text-center py-8 px-4 bg-[var(--color-secondary)] rounded-[var(--radius-md)]">
                        尚無請求紀錄
                      </div>
                    )}
                    {!requestsLoading && !requestsError && requests.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {requests.map((req) => (
                          <RequestItem key={req.id} req={req} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Input bar */}
              <div
                className="shrink-0 px-[var(--padding-h)] pt-2 overflow-y-hidden [scrollbar-gutter:stable]"
                style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}
              >
                <div className="bg-[var(--color-secondary)] rounded-[var(--radius-lg)] px-3 pt-3 pb-2 shadow-[var(--shadow-md)] md:max-w-[var(--page-max-w)] md:mx-auto">
                  <textarea
                    ref={textareaRef}
                    className={clsx(
                      'w-full py-2 px-1 border-none bg-transparent font-[inherit]',
                      'text-[var(--font-size-body)] text-[var(--color-foreground)] resize-none',
                      'leading-[var(--line-height-normal)] min-h-[3.6em] max-h-[30vh] overflow-y-auto',
                      'focus-visible:outline-none focus-visible:shadow-[var(--shadow-ring)] focus-visible:rounded-[var(--radius-xs)]',
                    )}
                    id="manageText"
                    maxLength={65536}
                    placeholder={
                      '例如：\n· Day 3 午餐換成通堂拉麵\n· 刪除美麗海水族館，改去萬座毛\n· Day 5 下午加一個 AEON 購物'
                    }
                    rows={1}
                    value={text}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                  />
                  <div className="flex items-center gap-2 mt-2 justify-between">
                    <div className="flex items-center gap-1" id="requestMode" data-value={mode}>
                      <button
                        className={clsx(
                          'appearance-none border-none font-[inherit] text-[var(--font-size-callout)] font-normal',
                          'py-2 px-3 rounded-full cursor-pointer min-h-[var(--tap-min)]',
                          'transition-colors duration-150',
                          'focus-visible:outline-none focus-visible:shadow-[var(--shadow-ring)]',
                          mode === 'trip-edit'
                            ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)] !font-semibold hover:bg-[var(--color-accent-bg)] hover:brightness-95'
                            : 'bg-transparent text-[var(--color-muted)] hover:bg-[var(--color-hover)]',
                        )}
                        data-mode="trip-edit"
                        onClick={() => setMode('trip-edit')}
                      >
                        改行程
                      </button>
                      <button
                        className={clsx(
                          'appearance-none border-none font-[inherit] text-[var(--font-size-callout)] font-normal',
                          'py-2 px-3 rounded-full cursor-pointer min-h-[var(--tap-min)]',
                          'transition-colors duration-150',
                          'focus-visible:outline-none focus-visible:shadow-[var(--shadow-ring)]',
                          mode === 'trip-plan'
                            ? 'bg-[var(--color-plan-bg)] text-[var(--color-plan-text)] !font-semibold hover:bg-[var(--color-plan-hover)]'
                            : 'bg-transparent text-[var(--color-muted)] hover:bg-[var(--color-hover)]',
                        )}
                        data-mode="trip-plan"
                        onClick={() => setMode('trip-plan')}
                      >
                        問建議
                      </button>
                    </div>
                    <div id="submitStatus" aria-live="polite">
                      {submitStatus && (
                        <div
                          className={clsx(
                            'text-[var(--font-size-footnote)] rounded-[var(--radius-sm)]',
                            submitStatus.type === 'success' && 'text-[var(--color-success)] flex items-center gap-1',
                            submitStatus.type === 'error' && 'text-[var(--color-destructive)]',
                          )}
                        >
                          {submitStatus.type === 'success' && <Icon name="check-circle" />}
                          {submitStatus.type === 'error' && <Icon name="x-circle" />}
                          {submitStatus.type === 'error' ? ' ' : ''}
                          {submitStatus.message}
                        </div>
                      )}
                    </div>
                    <button
                      className={clsx(
                        'w-[var(--tap-min)] h-[var(--tap-min)] border-none rounded-full',
                        'flex items-center justify-center shrink-0',
                        'transition-[background-color,color,transform] duration-[250ms]',
                        text.trim().length === 0 || submitting
                          ? 'bg-[var(--color-border)] text-[var(--color-muted)] cursor-not-allowed scale-[0.92] dark:bg-[var(--color-hover)] dark:text-[var(--color-muted)]'
                          : 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)] cursor-pointer scale-100 hover:brightness-110 active:scale-[0.95]',
                      )}
                      id="submitBtn"
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
