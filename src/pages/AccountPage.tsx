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
import { apiFetch, apiFetchRaw } from '../lib/apiClient';
import { ApiError } from '../lib/errors';
import { showToast } from '../components/shared/Toast';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import Icon from '../components/shared/Icon';
import ConfirmModal from '../components/shared/ConfirmModal';

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
/* v2.33.122: name + edit pencil icon flex row (置中對齊 avatar 軸) */
.tp-account-hero-name-row {
  display: flex; align-items: center; gap: 8px;
  justify-content: center;
}
.tp-account-hero-name-edit {
  display: grid; place-items: center;
  width: 32px; height: 32px;
  background: transparent; border: none;
  border-radius: var(--radius-md);
  color: var(--color-muted);
  cursor: pointer;
  transition: background-color 150ms, color 150ms;
}
.tp-account-hero-name-edit:hover {
  background: var(--color-hover);
  color: var(--color-accent);
}
.tp-account-hero-name-edit:focus-visible {
  outline: none; box-shadow: var(--shadow-ring);
}
.tp-account-hero-name-edit .svg-icon { width: 16px; height: 16px; }
.tp-account-hero-email {
  font-size: var(--font-size-callout);
  color: var(--color-muted);
}

/* v2.33.122: 編輯名稱 modal — overlay + dialog 對齊 ConfirmModal 視覺 */
.tp-account-edit-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: grid; place-items: center;
  z-index: var(--z-modal, 1000);
  padding: 24px;
  animation: tp-account-edit-fade 150ms ease-out;
}
@keyframes tp-account-edit-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
.tp-account-edit-dialog {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 24px;
  max-width: 420px;
  width: 100%;
  box-shadow: var(--shadow-lg);
}
.tp-account-edit-title {
  font-size: var(--font-size-title3);
  font-weight: 700;
  margin: 0 0 8px;
  color: var(--color-foreground);
}
.tp-account-edit-help {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  margin: 0 0 16px;
  line-height: 1.5;
}
.tp-account-edit-input {
  width: 100%;
  padding: 12px 14px;
  font: inherit;
  font-size: var(--font-size-body);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  box-sizing: border-box;
}
.tp-account-edit-input:focus-visible {
  outline: none; border-color: var(--color-accent);
  box-shadow: var(--shadow-ring);
}
.tp-account-edit-input:disabled {
  opacity: 0.5; cursor: not-allowed;
}
.tp-account-edit-actions {
  display: flex; gap: 8px;
  justify-content: flex-end;
  margin-top: 20px;
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

/* destructive variant — title + helper 都覆寫成紅字（不能只設 row color，
 * .tp-account-row-title/.tp-account-row-helper 有 explicit color 不繼承）。 */
.tp-account-row.is-danger { color: var(--color-priority-high-dot); }
.tp-account-row.is-danger .tp-account-row-title { color: var(--color-priority-high-dot); }
.tp-account-row.is-danger .tp-account-row-helper { color: var(--color-priority-high-dot); opacity: 0.78; }
.tp-account-row.is-danger .tp-account-row-icon {
  background: var(--color-priority-high-bg);
  color: var(--color-priority-high-dot);
}
.tp-account-row.is-danger:hover { background: var(--color-priority-high-bg); }

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
  const { user, reload: reloadUser } = useCurrentUser();
  const navigate = useNavigate();

  const [stats, setStats] = useState<AccountStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // v2.33.122: 編輯 display_name modal
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [savingName, setSavingName] = useState(false);

  function openEditName(): void {
    setEditingName(user?.displayName ?? '');
    setShowEditNameModal(true);
  }

  async function handleSaveName(): Promise<void> {
    setSavingName(true);
    try {
      const trimmed = editingName.trim();
      await apiFetch('/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({ displayName: trimmed.length === 0 ? null : trimmed }),
        headers: { 'content-type': 'application/json' },
      });
      reloadUser();
      setShowEditNameModal(false);
      showToast('名稱已更新', 'success');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : '更新失敗';
      showToast(msg, 'error');
    } finally {
      setSavingName(false);
    }
  }

  useEffect(() => {
    if (!auth.user) return;
    let cancelled = false;
    apiFetch<AccountStats>('/account/stats')
      .then((data) => { if (!cancelled) setStats(data); })
      // v2.33.47 round 7b: 不直接 surface raw error.message (可能 leak backend
      // detail / SQL fragment)。改 ApiError 與 network error 分開 generic 文案。
      .catch((e) => {
        if (cancelled) return;
        setStatsError(e instanceof ApiError ? '統計資料載入失敗' : '網路錯誤，請稍後再試');
      });
    return () => { cancelled = true; };
  }, [auth.user]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await apiFetchRaw('/oauth/logout', { method: 'POST' });
      // v2.33.47 round 7b: navigate 前先關 modal — success 路徑也要關 (避免在
      // /login 看到 stale modal 殘影 if route transition 慢)。
      setShowLogoutModal(false);
      navigate('/login', { replace: true });
    } catch {
      // v2.33.47 round 7b: 失敗路徑也關 modal + 顯 toast (之前 modal 卡死)。
      setLoggingOut(false);
      setShowLogoutModal(false);
      showToast('登出失敗，請稍後再試', 'error');
    }
  }, [navigate]);

  if (!auth.user || !user) return null;

  // v2.17.17:initial 用 displayName 對齊 sidebar(原本用 email.charAt 造成
  // displayName "Ray" + email "lean.lean@..." 時 hero 顯示「L」 但 sidebar 顯示「R」)。
  const displayName = user.displayName || user.email.split('@')[0] || user.email;
  const initial = displayName.charAt(0).toUpperCase();

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
        { key: 'connected-apps', icon: 'device', title: '已連結的應用程式', helper: '管理透過 Tripline 登入的應用程式', to: '/settings/connected-apps' },
        { key: 'developer', icon: 'code', title: '開發者選項', helper: 'OAuth 應用程式註冊', to: '/developer/apps' },
      ],
    },
    {
      key: 'account',
      label: '帳號',
      rows: [
        { key: 'sessions', icon: 'group', title: '已登入裝置', helper: '管理所有登入中的裝置', to: '/settings/sessions' },
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
            <div className="tp-account-hero-name-row">
              <h2 className="tp-account-hero-name">{displayName}</h2>
              <button
                type="button"
                className="tp-account-hero-name-edit"
                onClick={openEditName}
                aria-label="編輯名稱"
                title="編輯名稱"
                data-testid="account-edit-name-btn"
              >
                <Icon name="pencil" />
              </button>
            </div>
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

      <ConfirmModal
        open={showLogoutModal}
        title="確認登出？"
        message="此裝置會被登出，需要重新輸入 email 跟密碼才能再進來。"
        confirmLabel="確認登出"
        cancelLabel="取消"
        busy={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutModal(false)}
      />

      {/* v2.33.122: 編輯名稱 modal */}
      {showEditNameModal && (
        <div
          className="tp-account-edit-overlay"
          onClick={() => !savingName && setShowEditNameModal(false)}
          data-testid="account-edit-name-overlay"
        >
          <div
            className="tp-account-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tp-account-edit-name-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="tp-account-edit-name-title" className="tp-account-edit-title">編輯名稱</h3>
            <p className="tp-account-edit-help">顯示在 sidebar 與帳號頁面，留空會 fallback 顯 email 開頭。</p>
            <input
              type="text"
              className="tp-account-edit-input"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              maxLength={50}
              placeholder={user.email.split('@')[0]}
              autoFocus
              disabled={savingName}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !savingName) {
                  void handleSaveName();
                }
                if (e.key === 'Escape' && !savingName) {
                  setShowEditNameModal(false);
                }
              }}
              data-testid="account-edit-name-input"
            />
            <div className="tp-account-edit-actions">
              <button
                type="button"
                className="tp-new-modal-btn"
                onClick={() => setShowEditNameModal(false)}
                disabled={savingName}
                data-testid="account-edit-name-cancel"
              >
                取消
              </button>
              <button
                type="button"
                className="tp-new-modal-btn tp-new-modal-btn-primary"
                onClick={() => void handleSaveName()}
                disabled={savingName}
                data-testid="account-edit-name-save"
              >
                {savingName ? '儲存中⋯' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <AppShell sidebar={sidebar} main={main} bottomNav={<GlobalBottomNav authed={auth.user !== null} />} />
    </>
  );
}
