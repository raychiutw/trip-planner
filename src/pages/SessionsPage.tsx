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
import { useEffect, useState } from 'react';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import PageHeader from '../components/shell/PageHeader';
import ThemeToggle from '../components/shared/ThemeToggle';
import ErrorBanner from '../components/shared/ErrorBanner';

const SCOPED_STYLES = `
.tp-sessions-shell {
  min-height: 100dvh; padding: 32px 16px 64px;
  background: var(--color-secondary);
}
.tp-sessions-inner { max-width: 920px; margin: 0 auto; }

/* page heading 改用統一的 <PageHeader>（src/components/shell/PageHeader.tsx），舊 .tp-page-heading 已退役 */

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
  background: var(--color-accent);
  color: #fff;
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
.tp-pill-current { background: var(--color-success-bg); color: var(--color-success); }
.tp-device-detail {
  font-size: var(--font-size-caption); color: var(--color-muted);
  margin-top: 2px;
}

.tp-time { font-size: var(--font-size-footnote); color: var(--color-muted); }

.tp-btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 6px;
  padding: 8px 14px; border-radius: var(--radius-sm);
  font-family: inherit; font-size: var(--font-size-footnote);
  font-weight: 600; border: 1px solid var(--color-border);
  background: var(--color-background); color: var(--color-foreground);
  cursor: pointer; min-height: 36px;
  transition: background 120ms;
  text-decoration: none;
}
.tp-btn:hover:not(:disabled) { background: var(--color-hover); }
.tp-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.tp-btn-destructive {
  color: var(--color-destructive); border-color: var(--color-destructive);
}
.tp-btn-destructive:hover:not(:disabled) { background: var(--color-destructive-bg); }

.tp-banner {
  display: flex; gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-subheadline); line-height: 1.5;
  margin-top: 16px;
}
.tp-banner-info { background: var(--color-accent-subtle); color: var(--color-accent); }
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
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return '剛才';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const day = Math.floor(hr / 24);
  return `${day} 天前`;
}

export default function SessionsPage() {
  useRequireAuth(); // V2 sole-auth: redirect to /login if no tripline_session
  const { user } = useCurrentUser();
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokingSid, setRevokingSid] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  async function load() {
    setError(null);
    try {
      const res = await fetch('/api/account/sessions', { credentials: 'same-origin' });
      if (!res.ok) {
        setError('無法載入登入裝置，請重新整理頁面。');
        return;
      }
      const json = (await res.json()) as { sessions: SessionRow[] };
      setSessions(json.sessions);
    } catch {
      setError('網路連線失敗，請重新整理頁面。');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function revokeOne(sid: string) {
    setRevokingSid(sid);
    try {
      const res = await fetch(`/api/account/sessions/${encodeURIComponent(sid)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (res.ok) {
        setSessions((prev) => prev?.filter((s) => s.sid !== sid) ?? null);
      } else {
        setError('登出此裝置失敗，請稍後再試。');
      }
    } catch {
      setError('網路連線失敗，請稍後再試。');
    } finally {
      setRevokingSid(null);
    }
  }

  async function revokeAllOthers() {
    if (!confirm('確定要登出其他所有裝置嗎？目前裝置不受影響。')) return;
    setRevokingAll(true);
    try {
      const res = await fetch('/api/account/sessions', {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (res.ok) {
        // Optimistic: remove all non-current rows locally — match revokeOne() pattern,
        // saves a round-trip vs reloading the list
        setSessions((prev) => prev?.filter((s) => s.is_current) ?? null);
      } else {
        setError('登出其他裝置失敗，請稍後再試。');
      }
    } catch {
      setError('網路連線失敗，請稍後再試。');
    } finally {
      setRevokingAll(false);
    }
  }

  const otherSessions = sessions?.filter((s) => !s.is_current) ?? [];

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      bottomNav={<GlobalBottomNav authed={!!user} />}
      main={<>
      <style>{SCOPED_STYLES}</style>
      <div className="tp-sessions-shell" data-testid="sessions-page">
      <div className="tp-sessions-inner">
        <PageHeader
          eyebrow="帳號"
          title="帳號"
          meta={user?.email && <span data-testid="sessions-user-email">{user.email}</span>}
          actions={otherSessions.length > 0 && (
            <button
              className="tp-btn tp-btn-destructive"
              onClick={revokeAllOthers}
              disabled={revokingAll}
              data-testid="sessions-revoke-all"
            >
              {revokingAll ? '登出中…' : '登出其他全部裝置'}
            </button>
          )}
        />

        {sessions === null && !error && (
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
                      {s.ip_hash_prefix && ` · IP ${s.ip_hash_prefix}…`}
                    </div>
                  </div>
                </div>
                <div className="tp-time">{relativeTime(s.last_seen_at)}</div>
                <div>
                  {!s.is_current && (
                    <button
                      className="tp-btn tp-btn-destructive"
                      onClick={() => revokeOne(s.sid)}
                      disabled={revokingSid === s.sid}
                      data-testid={`sessions-revoke-${s.sid}`}
                    >
                      {revokingSid === s.sid ? '登出中…' : '登出'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <ErrorBanner message={error} testId="sessions-error" />}

        <div className="tp-banner tp-banner-info">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            登出某裝置後，該裝置上的 Tripline 會立即跳回登入畫面。
            OAuth 已連結 app 不受影響（請至「<a href="/settings/connected-apps">已連結的應用</a>」管理）。
          </div>
        </div>

        {/* PR-O 2026-04-26：深淺模式 + 登出搬到頁面最下方（user 指示）。 */}
        <div className="tp-account-footer" data-testid="account-footer">
          <div className="tp-account-footer-row">
            <span className="tp-account-footer-label">深淺模式</span>
            <ThemeToggle testId="sessions-theme" />
          </div>
          <a
            href="/api/oauth/logout"
            className="tp-account-logout-btn"
            data-testid="sessions-logout"
          >
            登出此帳號
          </a>
        </div>
      </div>
      </div>
      </>}
    />
  );
}
