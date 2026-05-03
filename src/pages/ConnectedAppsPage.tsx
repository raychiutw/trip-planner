/**
 * ConnectedAppsPage — V2-P5 user-side OAuth grant management
 *
 * Route: /settings/connected-apps
 * 列出 current user 授權的 OAuth client_apps + 撤銷功能。
 *
 * Auth required (依賴 /api/account/connected-apps requireSession)。
 *
 * 安全 UX：撤銷必須二次確認（modal）— 破壞性操作。
 */
import { useEffect, useState } from 'react';
import { useRequireAuth } from '../hooks/useRequireAuth';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import TitleBar from '../components/shell/TitleBar';
import ErrorBanner from '../components/shared/ErrorBanner';
import ConfirmModal from '../components/shared/ConfirmModal';

const SCOPED_STYLES = `
.tp-settings-shell {
  min-height: 100dvh; padding: 32px 16px 64px;
  background: var(--color-secondary);
}
.tp-settings-inner {
  max-width: 720px; margin: 0 auto;
}
/* page heading 改用統一 <TitleBar> + .tp-page-eyebrow / .tp-page-meta inline (2026-05-03 PageHeader 退役)。 */

.tp-section {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  margin-bottom: 16px;
  overflow: hidden;
}
.tp-section-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  display: flex; align-items: center; justify-content: space-between;
}
.tp-section-header h2 {
  font-size: var(--font-size-headline); font-weight: 700;
  margin: 0;
}
.tp-section-count {
  font-size: var(--font-size-caption2); font-weight: 600;
  color: var(--color-muted);
  padding: 2px 8px;
  background: var(--color-tertiary);
  border-radius: var(--radius-full);
}

.tp-app-row {
  display: flex; align-items: center; gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}
.tp-app-row:last-child { border-bottom: none; }
.tp-app-logo {
  width: 48px; height: 48px;
  border-radius: var(--radius-md);
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  display: grid; place-items: center;
  font-weight: 700; font-size: 18px;
  flex-shrink: 0;
}
.tp-app-info { flex: 1; min-width: 0; }
.tp-app-name {
  font-size: var(--font-size-callout); font-weight: 700;
  margin-bottom: 2px;
}
.tp-app-meta {
  font-size: var(--font-size-caption); color: var(--color-muted);
  display: flex; gap: 12px; flex-wrap: wrap;
}
.tp-scope-pill {
  background: var(--color-tertiary); padding: 2px 6px;
  border-radius: var(--radius-xs);
  font-family: 'SF Mono', ui-monospace, monospace;
  font-size: var(--font-size-caption2);
  color: var(--color-foreground);
}
.tp-app-actions {
  display: flex; gap: 8px; flex-shrink: 0;
}

.tp-btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 8px 14px; border-radius: var(--radius-sm);
  font-family: inherit; font-size: var(--font-size-footnote);
  font-weight: 600; border: 1px solid var(--color-border);
  background: var(--color-background); color: var(--color-foreground);
  cursor: pointer; min-height: 36px;
  transition: background 120ms;
}
.tp-btn:hover:not(:disabled) { background: var(--color-hover); }
.tp-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.tp-btn-destructive {
  color: var(--color-destructive); border-color: var(--color-destructive);
}
.tp-btn-destructive:hover:not(:disabled) { background: var(--color-destructive-bg); }
.tp-btn-primary { background: var(--color-accent); color: #fff; border: none; }
.tp-btn-primary:hover:not(:disabled) { filter: brightness(0.92); }
.tp-btn-block { width: 100%; min-height: 48px; padding: 12px 20px; font-size: var(--font-size-callout); }

.tp-empty {
  padding: 48px 24px; text-align: center;
}
.tp-empty-icon-circle {
  width: 56px; height: 56px;
  border-radius: var(--radius-full);
  background: var(--color-tertiary);
  color: var(--color-muted);
  display: grid; place-items: center;
  margin: 0 auto 16px;
}
.tp-empty-icon-circle svg { width: 28px; height: 28px; }
.tp-empty h3 {
  font-size: var(--font-size-headline); font-weight: 700;
  margin: 0 0 6px;
}
.tp-empty p {
  font-size: var(--font-size-footnote); color: var(--color-muted);
  margin: 0;
}

/* 2026-05-03 P3 confirm-modal cleanup: tp-modal-* CSS (backdrop / shell /
 * header / icon-circle / body / footer) 已退役。撤銷確認 dialog 改用
 * 標準化 <ConfirmModal>，視覺由 ConfirmModal SCOPED_STYLES 統一管。 */

.tp-loading, .tp-error-banner {
  padding: 32px; text-align: center;
  color: var(--color-muted);
}
.tp-error-banner { color: var(--color-destructive); }
`;

interface ConnectedApp {
  client_id: string;
  app_name: string;
  app_logo_url: string | null;
  app_description: string | null;
  homepage_url: string | null;
  status: string;
  scopes: string[];
  granted_at: number;
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return '剛才';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} 個月前`;
  return `${Math.floor(month / 12)} 年前`;
}

export default function ConnectedAppsPage() {
  useRequireAuth(); // V2 sole-auth: redirect to /login if no tripline_session
  const [apps, setApps] = useState<ConnectedApp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  async function load() {
    setError(null);
    try {
      const res = await fetch('/api/account/connected-apps', { credentials: 'same-origin' });
      if (!res.ok) {
        setError('無法載入已連結應用，請重新整理頁面。');
        return;
      }
      const json = (await res.json()) as { apps: ConnectedApp[] };
      setApps(json.apps);
    } catch {
      setError('網路連線失敗，請重新整理頁面。');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function confirmRevoke(clientId: string) {
    setRevokeBusy(true);
    try {
      const res = await fetch(`/api/account/connected-apps/${encodeURIComponent(clientId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (res.ok) {
        setApps((prev) => prev?.filter((a) => a.client_id !== clientId) ?? null);
        setRevokingId(null);
      } else {
        setError('撤銷失敗，請稍後再試。');
      }
    } catch {
      setError('網路連線失敗，請稍後再試。');
    } finally {
      setRevokeBusy(false);
    }
  }

  const target = apps?.find((a) => a.client_id === revokingId);

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      main={<>
      <style>{SCOPED_STYLES}</style>
      <div className="tp-settings-shell" data-testid="connected-apps-page">
      <TitleBar title="已連結的應用" />
      <div className="tp-settings-inner">
        <p className="tp-page-eyebrow">設定</p>
        <p className="tp-page-meta">這些 app 可以使用你的 Tripline 帳號。撤銷後該 app 將立即失去存取權。</p>

        {error && <ErrorBanner message={error} testId="connected-apps-error" />}

        {apps === null && !error && (
          <div className="tp-loading" data-testid="connected-apps-loading">載入中…</div>
        )}

        {apps !== null && apps.length === 0 && (
          <div className="tp-section">
            <div className="tp-empty" data-testid="connected-apps-empty">
              <div className="tp-empty-icon-circle" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </div>
              <h3>還沒有任何應用連結到你的帳號</h3>
              <p>當你第一次用「Sign in with Tripline」登入第三方 app 時，會出現在這裡。</p>
            </div>
          </div>
        )}

        {apps !== null && apps.length > 0 && (
          <div className="tp-section">
            <div className="tp-section-header">
              <h2>授權中</h2>
              <span className="tp-section-count">{apps.length} 個</span>
            </div>
            {apps.map((app) => (
              <div className="tp-app-row" key={app.client_id} data-testid={`connected-apps-row-${app.client_id}`}>
                <div className="tp-app-logo" aria-hidden="true">
                  {app.app_name.slice(0, 1).toUpperCase()}
                </div>
                <div className="tp-app-info">
                  <div className="tp-app-name">{app.app_name}</div>
                  <div className="tp-app-meta">
                    {app.scopes.slice(0, 3).map((s) => (
                      <span className="tp-scope-pill" key={s}>{s}</span>
                    ))}
                    <span>授權 {relativeTime(app.granted_at)}</span>
                  </div>
                </div>
                <div className="tp-app-actions">
                  <button
                    className="tp-btn tp-btn-destructive"
                    onClick={() => setRevokingId(app.client_id)}
                    data-testid={`connected-apps-revoke-${app.client_id}`}
                  >
                    撤銷
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>

      {/* 2026-05-03 P3 confirm-modal cleanup: 取代手刻 tp-modal-backdrop。
        * ConfirmModal 提供 portal + ESC + focus trap + alertdialog a11y +
        * V2 Terracotta destructive 紅色 confirm button + body 自動 ESC dismiss。
        * 對齊 mockup S22 Dialogs system. e2e/unit testid 從 connected-apps-*-revoke
        * 改為 ConfirmModal 標準 testid (confirm-modal-confirm / -cancel)。 */}
      <ConfirmModal
        open={!!revokingId && !!target}
        title={target ? `撤銷 ${target.app_name} 的存取權？` : ''}
        message={target
          ? `撤銷後 ${target.app_name} 將立即無法讀取或修改你的行程。未來想再使用必須重新授權。`
          : ''}
        confirmLabel="確認撤銷"
        cancelLabel="取消"
        busy={revokeBusy}
        onConfirm={() => { if (revokingId) confirmRevoke(revokingId); }}
        onCancel={() => setRevokingId(null)}
      />
      </>}
    />
  );
}
