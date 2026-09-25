/**
 * SessionsPage — V2-P6 multi-device session management UI
 *
 * Route: /settings/sessions
 * 配 mockup section 6「多裝置登入管理」。
 *
 * Features:
 *   - List user's active sessions (current marked highlighted)
 *   - Revoke specific session（破壞性，需 confirm modal — 但因不影響跨 user
 *     資料而是只影響自己的 device list，UX 上可不二次確認）
 *   - 「登出其他全部裝置」mass revoke（除當前外）
 *   - 異地裝置警示（不同 ip_hash_prefix → 警示樣式）— optional V2-P6 future
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { apiFetch, apiFetchRaw } from '../lib/apiClient';
import { ApiError } from '../lib/errors';
import { parseUtcDate } from '../lib/parseUtcDate';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import ThemeToggle from '../components/shared/ThemeToggle';
import ErrorBanner from '../components/shared/ErrorBanner';
import ConfirmModal from '../components/shared/ConfirmModal';
import { writeAuthHint } from '../lib/authHint';

const SCOPED_STYLES = `
.tp-sessions-shell {
  min-height: 100dvh; padding: 32px 16px 64px;
  background: var(--color-secondary);
}
.tp-sessions-inner { max-width: 920px; margin: 0 auto; }

/* page heading 改用統一 <TitleBar> + .tp-page-eyebrow / .tp-page-meta inline (2026-05-03 PageHeader 退役)。 */

.tp-list {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.tp-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 16px;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}
.tp-row:last-child { border-bottom: none; }
.tp-row-header {
  background: var(--color-secondary);
  font-size: var(--font-size-caption2);
  font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-muted);
}
.tp-row-current {
  background: var(--color-accent-subtle);
}

.tp-device-info { display: flex; align-items: center; gap: 12px; }
.tp-device-icon {
  width: 36px; height: 36px;
  border-radius: var(--radius-md);
  background: var(--color-tertiary);
  color: var(--color-foreground);
  display: grid; place-items: center;
  flex-shrink: 0;
}
.tp-device-icon svg { width: 18px; height: 18px; }
.tp-device-icon-current {
  background: var(--color-accent-fill);
  color: var(--color-accent-foreground);
}
.tp-device-meta { font-size: var(--font-size-subheadline); }
.tp-device-name { font-weight: 600; display: flex; align-items: center; gap: 8px; }
.tp-pill {
  display: inline-flex; padding: 2px 8px;
  border-radius: var(--radius-xs);
  font-size: var(--font-size-caption2);
  font-weight: 700; letter-spacing: 0.04em;
  text-transform: uppercase;
}
.tp-pill-current { background: var(--color-success-bg); color: var(--color-foreground); }
.tp-device-detail {
  font-size: var(--font-size-caption); color: var(--color-muted);
  margin-top: 2px;
}

.tp-time { font-size: var(--font-size-footnote); color: var(--color-muted); }

/* .tp-btn family 移到 css/tokens.css 共用。 */

.tp-banner {
  display: flex; gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-subheadline); line-height: 1.5;
  margin-top: 16px;
}
/* 底是同色系淡底（tonal）→ 走 -text-on-tonal（DESIGN.md §Color Approach 通則）。
 * 原本 --color-accent 疊 --color-accent-subtle 只有 3.24:1，低於 AA 的 4.5；現為 5.76:1。
 * 全 codebase 只有本檔 :330 真的 render 這個 class —— LoginPage / ResetPasswordPage 也各有
 * 一份同名規則但沒有對應 JSX，那兩份已在本次刪除（見 #1157）。 */
.tp-banner-info { background: var(--color-accent-subtle); color: var(--color-accent-text-on-tonal); }
.tp-banner-error { background: var(--color-destructive-bg); color: var(--color-destructive); }
.tp-banner svg { flex-shrink: 0; width: 20px; height: 20px; margin-top: 1px; }

.tp-loading, .tp-empty {
  padding: 32px; text-align: center;
  color: var(--color-muted);
}

/* PR-O 2026-04-26：登出區搬到頁面最下方（user 指示）+ 簡化為純 logout button。
 * 深淺模式 toggle 仍留在帳號頁但移到 logout 上方，跟 logout 共用同一容器。 */
.tp-account-footer {
  margin-top: 32px;
  padding: 20px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  display: flex; flex-direction: column; gap: 16px;
}
.tp-account-footer-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
}
.tp-account-footer-label {
  font-size: var(--font-size-callout);
  font-weight: 600;
  color: var(--color-foreground);
}
.tp-account-logout-btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 12px 16px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-destructive);
  background: transparent; color: var(--color-destructive);
  font: inherit; font-weight: 600; font-size: var(--font-size-callout);
  text-decoration: none;
  min-height: var(--spacing-tap-min);
  text-align: center;
  width: 100%;
}
.tp-account-logout-btn:hover { background: var(--color-destructive-bg); }
`;

interface SessionRow {
  sid: string;
  ua_summary: string | null;
  ip_hash_prefix: string | null;
  created_at: string;
  last_seen_at: string;
  is_current: boolean;
}

function relativeTime(iso: string): string {
  const d = parseUtcDate(iso);
  if (!d || !Number.isFinite(d.getTime())) return '時間不明';
  const ms = Date.now() - d.getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return '剛才';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const day = Math.floor(hr / 24);
  return `${day} 天前`;
}

type RevokeScope = { kind: 'session'; sid: string } | { kind: 'others' } | { kind: 'current' };

function readSessions(value: { current_sid: string | null; sessions: SessionRow[] }): SessionRow[] {
  if (!value || !(value.current_sid === null || typeof value.current_sid === 'string') || !Array.isArray(value.sessions)) throw new Error('invalid sessions');
  const ids = new Set<string>();
  for (const row of value.sessions) {
    if (!row || typeof row.sid !== 'string' || !row.sid || ids.has(row.sid) ||
        typeof row.is_current !== 'boolean' || row.is_current !== (row.sid === value.current_sid) ||
        !(row.ua_summary === null || typeof row.ua_summary === 'string') ||
        !(row.ip_hash_prefix === null || typeof row.ip_hash_prefix === 'string') ||
        typeof row.created_at !== 'string' || typeof row.last_seen_at !== 'string') throw new Error('invalid session');
    ids.add(row.sid);
  }
  return value.sessions;
}

export default function SessionsPage() {
  const { user } = useRequireAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [readAttempt, setReadAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<RevokeScope | null>(null);
  const pendingRef = useRef(false);
  const lifetime = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState('');
  const [revokeAllConfirmOpen, setRevokeAllConfirmOpen] = useState(false);
  useLayoutEffect(() => () => { lifetime.current++; }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const controller = new AbortController();
    setReadError(null);
    setSessions(null);
    apiFetch<{ current_sid: string | null; sessions: SessionRow[] }>('/account/sessions', { signal: controller.signal })
      .then(value => {
        const rows = readSessions(value);
        if (!controller.signal.aborted) setSessions(rows);
      })
      .catch(() => {
        if (!controller.signal.aborted) setReadError('無法載入登入裝置，請重試。');
      });
    return () => controller.abort();
  }, [user?.id, readAttempt]);

  async function revoke(scope: RevokeScope) {
    if (pendingRef.current || !user) return;
    if (scope.kind === 'session' && !sessions?.some(row => row.sid === scope.sid && !row.is_current)) return;
    if (scope.kind === 'others' && !sessions?.some(row => !row.is_current)) return;
    pendingRef.current = true;
    const operation = lifetime.current;
    const trigger = document.activeElement;
    setPending(scope);
    setError(null);
    setAnnouncement('');
    try {
      if (scope.kind === 'current') {
        const response = await apiFetchRaw('/oauth/logout', { method: 'POST' });
        if (!response.ok) throw await ApiError.fromResponse(response);
        if (operation !== lifetime.current) return;
        writeAuthHint(false);
        navigate('/login', { replace: true });
      } else {
        const path = scope.kind === 'session' ? `/account/sessions/${encodeURIComponent(scope.sid)}` : '/account/sessions';
        const result = await apiFetch<{ ok: boolean; revoked_sid?: string; revoked?: number }>(path, { method: 'DELETE' });
        if (operation !== lifetime.current) return;
        if (result?.ok !== true || (scope.kind === 'session'
          ? result.revoked_sid !== scope.sid
          : !Number.isSafeInteger(result.revoked) || result.revoked! < 0)) throw new Error('unconfirmed revocation');
        setSessions(prev => prev?.filter(row => scope.kind === 'session' ? row.sid !== scope.sid : row.is_current) ?? null);
        setAnnouncement(scope.kind === 'session' ? '已登出選取的裝置。' : '已登出其他裝置，目前裝置不受影響。');
        if (scope.kind === 'others') setRevokeAllConfirmOpen(false);
        else if (document.activeElement === trigger || document.activeElement === document.body) contentRef.current?.focus({ preventScroll: true });
      }
    } catch {
      if (operation !== lifetime.current) return;
      setError(scope.kind === 'session' ? '登出此裝置失敗，請稍後再試。' : scope.kind === 'others' ? '登出其他裝置失敗，請稍後再試。' : '登出目前裝置失敗，請稍後再試。');
    } finally {
      if (operation === lifetime.current) { pendingRef.current = false; setPending(null); }
    }
  }

  const otherSessions = sessions?.filter((s) => !s.is_current) ?? [];

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      bottomNav={<GlobalBottomNav authed={user !== null} />}
      main={<>
      <style>{SCOPED_STYLES}</style>
      <div className="tp-sessions-shell" data-testid="sessions-page">
      <TitleBar
        title="登入裝置"
        back={() => navigate('/account')}
        actions={otherSessions.length > 0 && (
          <button
            type="button"
            className="tp-titlebar-action"
            onClick={() => { setError(null); setRevokeAllConfirmOpen(true); }}
            disabled={pending !== null}
            aria-label="登出其他全部裝置"
            title="登出其他全部裝置"
            data-testid="sessions-revoke-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="tp-titlebar-action-label">{pending?.kind === 'others' ? '登出中…' : '登出其他裝置'}</span>
          </button>
        )}
      />
      <div className="tp-sessions-inner" ref={contentRef} tabIndex={-1} aria-label="登入裝置清單">
        <span role="status" className="sr-only">{announcement}</span>
        <p className="tp-page-eyebrow">帳號</p>
        {user?.email && <p className="tp-page-meta" data-testid="sessions-user-email">{user.email}</p>}

        {sessions === null && !readError && (
          <div className="tp-loading" data-testid="sessions-loading">載入中…</div>
        )}

        {sessions !== null && sessions.length === 0 && (
          <div className="tp-list">
            <div className="tp-empty" data-testid="sessions-empty">
              目前沒有登入裝置紀錄。
            </div>
          </div>
        )}

        {sessions !== null && sessions.length > 0 && (
          <div className="tp-list">
            <div className="tp-row tp-row-header">
              <div>裝置</div>
              <div>上次活動</div>
              <div></div>
            </div>
            {sessions.map((s) => (
              <div
                className={`tp-row ${s.is_current ? 'tp-row-current' : ''}`}
                key={s.sid}
                data-testid={`sessions-row-${s.sid}`}
              >
                <div className="tp-device-info">
                  <div
                    className={`tp-device-icon ${s.is_current ? 'tp-device-icon-current' : ''}`}
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </div>
                  <div>
                    <div className="tp-device-name">
                      {s.ua_summary ?? '未知裝置'}
                      {s.is_current && (
                        <span className="tp-pill tp-pill-current">目前</span>
                      )}
                    </div>
                    <div className="tp-device-detail">
                      建立 {relativeTime(s.created_at)}
                      {s.ip_hash_prefix && (
                        <span title="IP 位址的雜湊前綴（privacy）— 同一網路下相同">
                          {' · 裝置 ID '}{s.ip_hash_prefix}…
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="tp-time">{relativeTime(s.last_seen_at)}</div>
                <div>
                  {!s.is_current && (
                    <button
                      className="tp-btn tp-btn-destructive"
                      aria-label={`登出 ${s.ua_summary ?? '未知裝置'}`}
                      onClick={() => void revoke({ kind: 'session', sid: s.sid })}
                      disabled={pending !== null}
                      data-testid={`sessions-revoke-${s.sid}`}
                    >
                      {pending?.kind === 'session' && pending.sid === s.sid ? '登出中…' : '登出'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {readError && <>
          <ErrorBanner message={readError} testId="sessions-error" />
          <button type="button" className="tp-btn min-h-[44px]" disabled={pending !== null} onClick={() => setReadAttempt(n => n + 1)}>重試載入裝置</button>
        </>}
        {error && !revokeAllConfirmOpen && <ErrorBanner message={error} testId="sessions-error" />}

        <div className="tp-banner tp-banner-info">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            登出某裝置後，該裝置下次操作時需要重新登入。
            OAuth 已連結 app 不受影響（請至「<a href="/settings/connected-apps">已連結的應用</a>」管理）。
          </div>
        </div>

        {/* PR-O 2026-04-26：深淺模式 + 登出搬到頁面最下方（user 指示）。 */}
        <div className="tp-account-footer" data-testid="account-footer">
          <div className="tp-account-footer-row">
            <span className="tp-account-footer-label">深淺模式</span>
            <ThemeToggle testId="sessions-theme" />
          </div>
          {/* v2.33.46 round 7a security audit: 改 POST button — 之前 <a href>
              是 GET-trigger state-changing endpoint，任何 forum 內 <img src=
              "/api/oauth/logout"> 即可登出 victim (CSRF logout DoS)。對齊
              AccountPage 既有 POST pattern。 */}
          <button
            type="button"
            className="tp-account-logout-btn"
            data-testid="sessions-logout"
            disabled={pending !== null}
            onClick={() => void revoke({ kind: 'current' })}
          >
            {pending?.kind === 'current' ? '登出中…' : '登出目前裝置'}
          </button>
        </div>
      </div>
      </div>
      <ConfirmModal
        open={revokeAllConfirmOpen}
        title="登出其他所有裝置？"
        message="目前裝置不受影響。其他登入過的瀏覽器／手機下次操作時需要重新登入。"
        confirmLabel="登出全部"
        busy={pending?.kind === 'others'}
        fallbackFocusRef={contentRef}
        onConfirm={() => void revoke({ kind: 'others' })}
        onCancel={() => setRevokeAllConfirmOpen(false)}
      >{error && <ErrorBanner message={error} testId="sessions-error" />}</ConfirmModal>
      </>}
    />
  );
}
