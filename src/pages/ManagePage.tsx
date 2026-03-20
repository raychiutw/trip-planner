import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '../components/shared/Icon';
import { apiFetch } from '../hooks/useApi';
import { useDarkMode } from '../hooks/useDarkMode';
import { sanitizeHtml } from '../lib/sanitize';
import { lsGet, lsSet } from '../lib/localStorage';

import { marked } from 'marked';

/* ===== Raw API types (snake_case from D1) ===== */

interface RawRequest {
  id: number;
  trip_id: string;
  mode: string;
  title: string;
  body: string;
  submitted_by?: string | null;
  reply?: string | null;
  status: string;
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

function RequestItem({ req }: { req: RawRequest }) {
  const date = new Date(req.created_at + 'Z').toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const stateClass = req.status === 'open' ? 'open' : 'closed';
  const badgeText = req.status === 'open' ? '處理中' : '已處理';
  const badgeIconName = req.status === 'open' ? 'circle-dot' : 'check-circle';
  const mode = req.mode === 'trip-plan' ? 'plan' : 'edit';
  const modeBadgeText = mode === 'plan' ? '問建議' : '改行程';

  const replyHtml = req.reply
    ? sanitizeHtml(marked.parse(req.reply) as string).replace(
        /<table([^>]*)>/g,
        '<div class="table-wrap"><table$1>',
      ).replace(/<\/table>/g, '</table></div>')
    : '';

  return (
    <div className={`request-item ${stateClass}`}>
      <div className="request-item-header">
        <span className={`request-badge ${stateClass}`}>
          <Icon name={badgeIconName} />
          {badgeText}
        </span>
        <span className={`request-mode-badge mode-${mode}`}>{modeBadgeText}</span>
        <span className="request-item-title">{req.title}</span>
      </div>
      {req.body && <div className="request-item-body">{req.body}</div>}
      <div className="request-item-meta">
        #{req.id} · {date}
        {req.submitted_by && <> · {req.submitted_by}</>}
      </div>
      {req.reply && (
        <div
          className="request-reply"
          dangerouslySetInnerHTML={{ __html: replyHtml }}
        />
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
      const savedTrip = lsGet<string>('trip-pref');
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

    const title = trimmed.substring(0, 50);

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: currentTripId,
          mode,
          title,
          body: trimmed,
        }),
      });

      if (res.status === 201) {
        const req = (await res.json()) as RawRequest;
        setSubmitStatus({ type: 'success', message: '已送出' });
        setText('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        // Optimistic insert to top
        setRequests((prev) => [req, ...prev]);
      } else if (res.status === 403) {
        throw new Error('你沒有此行程的權限');
      } else {
        throw new Error('送出失敗（' + res.status + '）');
      }
    } catch (err) {
      setSubmitStatus({
        type: 'error',
        message: err instanceof Error ? err.message : '送出失敗',
      });
    } finally {
      setSubmitting(false);
    }
  }, [text, currentTripId, mode, submitting]);

  /* ----- Handle trip select change ----- */
  const handleTripChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      lsSet('trip-pref', val);
      setCurrentTripId(val);
    },
    [],
  );

  /* ----- Handle textarea input ----- */
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      // clear submit status when typing
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
    window.location.href = '../index.html';
  }, []);

  /* ===== Render ===== */

  // Determine whether to show empty-centered state
  const hasRequests = requests.length > 0;
  const showEmptyOrLoading = requestsLoading || requestsError !== null || !hasRequests;

  return (
    <div className="page-layout">
      <div className="container">
        {/* ----- Sticky Nav ----- */}
        <div className="sticky-nav" id="stickyNav">
          {pageState.kind === 'ready' && (
            <select
              className="manage-trip-select manage-trip-select--center"
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
            className="nav-close-btn"
            id="navCloseBtn"
            aria-label="關閉"
            onClick={handleClose}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* ----- Main Content ----- */}
        <main className="manage-main" id="manageMain">
          {/* Loading state */}
          {pageState.kind === 'loading' && (
            <div className="text-center p-10 text-[var(--color-muted)]">
              載入中...
            </div>
          )}

          {/* Auth required */}
          {pageState.kind === 'auth-required' && (
            <div className="manage-no-permission mx-[var(--padding-h)] my-10">
              請先登入
            </div>
          )}

          {/* No permission / no published trips */}
          {pageState.kind === 'no-permission' && (
            <div className="manage-no-permission mx-[var(--padding-h)] my-10">
              {pageState.message}
            </div>
          )}

          {/* Ready: chat UI */}
          {pageState.kind === 'ready' && (
            <div className="chat-container">
              {/* Messages area */}
              <div className="chat-messages">
                <div
                  className={`chat-messages-inner${
                    showEmptyOrLoading && !hasRequests ? ' chat-messages-inner--centered' : ''
                  }`}
                >
                  <div id="manageRequests">
                    {requestsLoading && (
                      <div className="manage-loading">載入中…</div>
                    )}
                    {!requestsLoading && requestsError && (
                      <div className="manage-empty">{requestsError}</div>
                    )}
                    {!requestsLoading && !requestsError && !hasRequests && (
                      <div className="manage-empty">尚無請求紀錄</div>
                    )}
                    {!requestsLoading && !requestsError && hasRequests && (
                      <div className="request-list">
                        {requests.map((req) => (
                          <RequestItem key={req.id} req={req} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Input bar */}
              <div className="manage-input-bar">
                <div className="manage-input-card">
                  <textarea
                    ref={textareaRef}
                    className="manage-textarea"
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
                  <div className="manage-input-toolbar">
                    <div className="manage-mode-toggle" id="requestMode" data-value={mode}>
                      <button
                        className={`manage-mode-pill${mode === 'trip-edit' ? ' selected' : ''}`}
                        data-mode="trip-edit"
                        onClick={() => setMode('trip-edit')}
                      >
                        改行程
                      </button>
                      <button
                        className={`manage-mode-pill${mode === 'trip-plan' ? ' selected-plan' : ''}`}
                        data-mode="trip-plan"
                        onClick={() => setMode('trip-plan')}
                      >
                        問建議
                      </button>
                    </div>
                    <div id="submitStatus" aria-live="polite">
                      {submitStatus && (
                        <div className={`manage-status ${submitStatus.type}`}>
                          {submitStatus.type === 'success' && <Icon name="check-circle" />}
                          {submitStatus.type === 'error' && <Icon name="x-circle" />}
                          {submitStatus.type === 'error' ? ' ' : ''}
                          {submitStatus.message}
                        </div>
                      )}
                    </div>
                    <button
                      className="manage-send-btn"
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
