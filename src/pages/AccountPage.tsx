/**
 * AccountPage — Section 2 (terracotta-account-hub-page) unified 帳號 hub
 *
 * Route: /account
 * 對應 mockup section 19 (line 7425-7583)。Profile hero + 3 group settings
 * rows，整合既有分散的 /settings/* page 為 entry hub。
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { apiFetch } from '../lib/apiClient';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import Icon from '../components/shared/Icon';

interface AccountStats {
  tripCount: number;
  totalDays: number;
  collaboratorCount: number;
}

const SCOPED_STYLES = `
.tp-account-shell {
  min-height: 100%;
  background: var(--color-secondary);
  overflow-y: auto;
}
.tp-account-inner {
  max-width: 720px; margin: 0 auto;
  padding: 24px 16px 64px;
  display: flex; flex-direction: column; gap: 24px;
}
@media (min-width: 768px) {
  .tp-account-inner { padding: 40px 24px 80px; gap: 32px; }
}

/* Profile hero (mockup line 7437-7448) */
.tp-account-hero {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 24px;
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  text-align: center;
}
.tp-account-hero-avatar {
  width: 64px; height: 64px; border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  display: grid; place-items: center;
  font-size: 26px; font-weight: 800;
}
.tp-account-hero-name {
  font-size: var(--font-size-title2); font-weight: 800;
  color: var(--color-foreground);
  margin: 0;
}
.tp-account-hero-email {
  font-size: var(--font-size-callout);
  color: var(--color-muted);
}
.tp-account-hero-stats {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 12px; width: 100%;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}
.tp-account-hero-stat { text-align: center; }
.tp-account-hero-stat-value {
  font-size: var(--font-size-title3); font-weight: 800;
  color: var(--color-foreground);
  font-variant-numeric: tabular-nums;
  display: block;
}
.tp-account-hero-stat-label {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
  margin-top: 2px;
  display: block;
}

/* Settings group + rows (mockup line 7450-7515) */
.tp-account-group { display: flex; flex-direction: column; gap: 8px; }
.tp-account-group-label {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--color-muted);
  padding: 0 4px;
}
.tp-account-rows {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.tp-account-row {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 16px;
  border: none;
  background: transparent;
  width: 100%; text-align: left;
  font: inherit;
  cursor: pointer;
  color: var(--color-foreground);
  text-decoration: none;
  border-bottom: 1px solid var(--color-border);
  min-height: var(--spacing-tap-min);
  transition: background 120ms;
}
.tp-account-row:last-child { border-bottom: none; }
.tp-account-row:hover { background: var(--color-hover); }
.tp-account-row-icon {
  width: 36px; height: 36px; border-radius: var(--radius-md);
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  display: grid; place-items: center;
  flex-shrink: 0;
}
.tp-account-row-icon .svg-icon { width: 18px; height: 18px; }
.tp-account-row-body {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 2px;
}
.tp-account-row-title {
  font-size: var(--font-size-callout); font-weight: 600;
  color: var(--color-foreground);
}
.tp-account-row-helper {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
}
.tp-account-row-chevron {
  color: var(--color-muted);
  flex-shrink: 0;
}
.tp-account-row-chevron .svg-icon { width: 14px; height: 14px; }

/* Logout destructive variant — 2026-04-29 加強 visual:title + helper 都繼承
 * destructive red(原本只 row color set,但 title/helper 用 explicit color
 * override,沒繼承到 red),對齊 mockup S19 「登出」 row 整 row 紅字 visual。
 * icon 從 arrow-left 改 x-mark 對齊 mockup destructive 語意。 */
.tp-account-row.is-danger { color: var(--color-priority-high-dot, #c0392b); }
.tp-account-row.is-danger .tp-account-row-title { color: var(--color-priority-high-dot, #c0392b); }
.tp-account-row.is-danger .tp-account-row-helper { color: var(--color-priority-high-dot, #c0392b); opacity: 0.78; }
.tp-account-row.is-danger .tp-account-row-icon {
  background: var(--color-priority-high-bg, rgba(192, 57, 43, 0.08));
  color: var(--color-priority-high-dot, #c0392b);
}
.tp-account-row.is-danger:hover { background: var(--color-priority-high-bg, rgba(192, 57, 43, 0.06)); }

/* Logout confirm modal */
.tp-logout-backdrop {
  position: fixed; inset: 0;
  z-index: 1000;
  background: rgba(20, 14, 9, 0.42);
  display: grid; place-items: center;
  padding: 20px;
}
.tp-logout-modal {
  width: min(420px, 100%);
  border-radius: var(--radius-xl);
  background: var(--color-background);
  color: var(--color-foreground);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border);
  padding: 18px;
}
.tp-logout-title { margin: 0; font-size: var(--font-size-title3); font-weight: 800; }
.tp-logout-copy { margin: 10px 0 16px; font-size: var(--font-size-callout); color: var(--color-muted); }
.tp-logout-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.tp-logout-actions button {
  flex: 1; min-width: 112px;
  min-height: var(--spacing-tap-min);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-secondary);
  color: var(--color-foreground);
  font: inherit; font-weight: 800; font-size: var(--font-size-footnote);
  cursor: pointer;
}
.tp-logout-actions button.danger {
  background: var(--color-priority-high-dot, #c0392b);
  border-color: var(--color-priority-high-dot, #c0392b);
  color: #fff;
}
.tp-logout-stats-error {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
}
`;

interface SettingsRow {
  key: string;
  icon: string;
  title: string;
  helper: string;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
}

export default function AccountPage() {
  const auth = useRequireAuth();
  const { user } = useCurrentUser();
  const navigate = useNavigate();

  const [stats, setStats] = useState<AccountStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!auth.user) return;
    let cancelled = false;
    apiFetch<AccountStats>('/account/stats')
      .then((data) => { if (!cancelled) setStats(data); })
      .catch((e) => { if (!cancelled) setStatsError((e as Error).message); });
    return () => { cancelled = true; };
  }, [auth.user]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/oauth/logout', { method: 'POST', credentials: 'same-origin' });
      navigate('/login');
    } catch {
      setLoggingOut(false);
    }
  }, [navigate]);

  if (!auth.user || !user) return null;

  const initial = user.email.charAt(0).toUpperCase();
  const displayName = user.displayName || user.email.split('@')[0] || user.email;

  const groups: { key: string; label: string; rows: SettingsRow[] }[] = [
    {
      key: 'application',
      label: '應用程式',
      rows: [
        { key: 'appearance', icon: 'palette', title: '外觀設定', helper: '主題色、深淺模式', to: '/account/appearance' },
        { key: 'notifications', icon: 'lightbulb', title: '通知設定', helper: '行程更新、旅伴邀請', to: '/account/notifications' },
      ],
    },
    {
      key: 'collab',
      label: '共編 & 整合',
      rows: [
        { key: 'connected-apps', icon: 'device', title: '已連結 App', helper: '管理透過 Tripline 登入的應用程式', to: '/settings/connected-apps' },
        { key: 'developer', icon: 'code', title: '開發者選項', helper: 'OAuth client app 註冊', to: '/settings/developer-apps' },
      ],
    },
    {
      key: 'account',
      label: '帳號',
      rows: [
        { key: 'sessions', icon: 'group', title: '已登入裝置', helper: '管理所有 active session', to: '/settings/sessions' },
        { key: 'logout', icon: 'x-mark', title: '登出', helper: '清除目前裝置的登入狀態', onClick: () => setShowLogoutModal(true), danger: true },
      ],
    },
  ];

  const sidebar = <DesktopSidebarConnected />;
  const main = (
    <div className="tp-account-shell" data-testid="account-page">
      <TitleBar title="帳號" />
      <div className="tp-account-inner">
        <section className="tp-account-hero" data-testid="account-hero">
          <div className="tp-account-hero-avatar" aria-hidden="true">{initial}</div>
          <div>
            <h2 className="tp-account-hero-name">{displayName}</h2>
            <div className="tp-account-hero-email">{user.email}</div>
          </div>
          <div className="tp-account-hero-stats">
            <div className="tp-account-hero-stat">
              <span className="tp-account-hero-stat-value">{stats?.tripCount ?? '—'}</span>
              <span className="tp-account-hero-stat-label">個行程</span>
            </div>
            <div className="tp-account-hero-stat">
              <span className="tp-account-hero-stat-value">{stats?.totalDays ?? '—'}</span>
              <span className="tp-account-hero-stat-label">天旅程</span>
            </div>
            <div className="tp-account-hero-stat">
              <span className="tp-account-hero-stat-value">{stats?.collaboratorCount ?? '—'}</span>
              <span className="tp-account-hero-stat-label">位旅伴</span>
            </div>
          </div>
          {statsError && (
            <div className="tp-logout-stats-error" role="status">數據載入失敗：{statsError}</div>
          )}
        </section>

        {groups.map((group) => (
          <section key={group.key} className="tp-account-group">
            <div className="tp-account-group-label" data-testid={`account-group-label-${group.key}`}>{group.label}</div>
            <div className="tp-account-rows">
              {group.rows.map((row) => {
                const className = `tp-account-row${row.danger ? ' is-danger' : ''}`;
                const inner = (
                  <>
                    <div className="tp-account-row-icon" aria-hidden="true"><Icon name={row.icon} /></div>
                    <div className="tp-account-row-body">
                      <div className="tp-account-row-title">{row.title}</div>
                      <div className="tp-account-row-helper">{row.helper}</div>
                    </div>
                    <span className="tp-account-row-chevron" aria-hidden="true"><Icon name="chevron-right" /></span>
                  </>
                );
                if (row.to) {
                  return (
                    <Link key={row.key} to={row.to} className={className} data-testid={`account-row-${row.key}`}>
                      {inner}
                    </Link>
                  );
                }
                return (
                  <button key={row.key} type="button" className={className} onClick={row.onClick} data-testid={`account-row-${row.key}`}>
                    {inner}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {showLogoutModal && (
        <div className="tp-logout-backdrop" role="presentation" onClick={() => setShowLogoutModal(false)}>
          <div
            className="tp-logout-modal"
            role="alertdialog"
            aria-modal="true"
            aria-label="確認登出"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="tp-logout-title">確認登出？</h3>
            <p className="tp-logout-copy">此裝置會被登出，需要重新輸入 email 跟密碼才能再進來。</p>
            <div className="tp-logout-actions">
              <button type="button" className="danger" onClick={handleLogout} disabled={loggingOut} data-testid="account-logout-confirm">
                {loggingOut ? '登出中…' : '確認登出'}
              </button>
              <button type="button" onClick={() => setShowLogoutModal(false)} disabled={loggingOut}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <AppShell sidebar={sidebar} main={main} bottomNav={<GlobalBottomNav authed={!!auth.user} />} />
    </>
  );
}
