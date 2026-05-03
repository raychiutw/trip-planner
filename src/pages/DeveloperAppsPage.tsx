/**
 * DeveloperAppsPage — V2-P4 OAuth client_app management for developers
 *
 * Route: /developer/apps
 * Backend: PR #291 GET/POST /api/dev/apps
 *
 * Flow:
 *   1. List user's client_apps
 *   2. 「建立新應用」→ form modal (app_name, redirect_uris, client_type, scopes)
 *   3. Submit → POST /api/dev/apps → 切換成 secret reveal modal
 *      - 顯示 client_id (永久) + client_secret (一次性，必須立即複製)
 *      - 確認複製 → 重新 fetch 列表 + 關閉 modal
 *
 * 安全 UX：
 *   - client_secret 只 reveal 一次，明確警示
 *   - 預設 client_type='public'（PKCE 強制，不需 secret）
 *   - redirect_uris textarea: HTTPS-only validation 由後端做
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import TitleBar from '../components/shell/TitleBar';
import ErrorBanner from '../components/shared/ErrorBanner';

const SCOPED_STYLES = `
.tp-dev-shell {
  min-height: 100dvh; padding: 32px 16px 64px;
  background: var(--color-secondary);
}
.tp-dev-inner { max-width: 920px; margin: 0 auto; }

/* page heading 改用統一 <TitleBar> + .tp-page-eyebrow / .tp-page-meta inline (2026-05-03 PageHeader 退役)。 */

.tp-list-table {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.tp-list-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr auto;
  align-items: center;
  gap: 16px; padding: 14px 20px;
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-subheadline);
}
.tp-list-row:last-child { border-bottom: none; }
.tp-list-header {
  background: var(--color-secondary);
  font-size: var(--font-size-caption2);
  font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-muted);
}
.tp-app-name { font-weight: 600; }
.tp-app-cid {
  font-family: 'SF Mono', ui-monospace, monospace;
  font-size: var(--font-size-caption);
  color: var(--color-muted);
}
.tp-pill {
  display: inline-flex; padding: 2px 8px;
  border-radius: var(--radius-xs);
  font-size: var(--font-size-caption2);
  font-weight: 700; letter-spacing: 0.04em;
  text-transform: uppercase;
}
.tp-pill-active { background: var(--color-success-bg); color: var(--color-success); }
.tp-pill-pending { background: var(--color-warning-bg); color: var(--color-warning); }
.tp-pill-suspended { background: var(--color-tertiary); color: var(--color-muted); }

/* .tp-btn family 移到 css/tokens.css 共用。 */

.tp-empty {
  padding: 64px 24px; text-align: center;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
.tp-empty h3 {
  font-size: var(--font-size-headline); font-weight: 700;
  margin: 0 0 6px;
}
.tp-empty p {
  font-size: var(--font-size-footnote); color: var(--color-muted);
  margin: 0 0 16px;
}

/* 2026-05-03 modal-to-fullpage migration: tp-modal* / tp-form* / tp-radio* /
 * tp-secret* / tp-code-block* CSS 已搬到 src/pages/DeveloperAppNewPage.tsx
 * (form 全頁化 + secret reveal modal block 跟著走)。 */

.tp-loading, .tp-error-banner {
  padding: 32px; text-align: center;
  color: var(--color-muted);
}
.tp-error-banner { color: var(--color-destructive); }
`;

interface ClientApp {
  client_id: string;
  client_type: 'public' | 'confidential';
  app_name: string;
  app_description: string | null;
  homepage_url: string | null;
  redirect_uris: string[];
  allowed_scopes: string[];
  status: 'active' | 'pending_review' | 'suspended';
  created_at: string;
  updated_at: string;
}

// 2026-05-03 modal-to-fullpage migration: NewAppResult + SCOPE_OPTIONS 已搬到
// src/pages/DeveloperAppNewPage.tsx (form 全頁化後 list page 不需要)。

function statusPill(status: string): { className: string; label: string } {
  if (status === 'active') return { className: 'tp-pill tp-pill-active', label: 'ACTIVE' };
  if (status === 'pending_review') return { className: 'tp-pill tp-pill-pending', label: 'PENDING' };
  return { className: 'tp-pill tp-pill-suspended', label: status.toUpperCase() };
}

export default function DeveloperAppsPage() {
  useRequireAuth(); // V2 sole-auth: redirect to /login if no tripline_session
  const navigate = useNavigate();
  const [apps, setApps] = useState<ClientApp[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadApps() {
    setError(null);
    try {
      const res = await fetch('/api/dev/apps', { credentials: 'same-origin' });
      if (!res.ok) {
        setError('無法載入應用列表，請重新整理頁面。');
        return;
      }
      const json = (await res.json()) as { apps: ClientApp[] };
      setApps(json.apps);
    } catch {
      setError('網路連線失敗，請重新整理頁面。');
    }
  }

  useEffect(() => { void loadApps(); }, []);

  // 2026-05-03 modal-to-fullpage migration: 建立新應用走 /developer/apps/new 全頁。
  // page submit 成功 + ack secret → dispatch tp-developer-app-created 讓列表
  // 自動 refresh，不用 user 手動重整。
  useEffect(() => {
    function handleAppCreated() { void loadApps(); }
    window.addEventListener('tp-developer-app-created', handleAppCreated);
    return () => window.removeEventListener('tp-developer-app-created', handleAppCreated);
  }, []);

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      main={<>
      <style>{SCOPED_STYLES}</style>
      <div className="tp-dev-shell" data-testid="developer-apps-page">
      <TitleBar
        title="應用"
        actions={
          <button
            type="button"
            className="tp-titlebar-action"
            onClick={() => navigate('/developer/apps/new')}
            aria-label="建立新應用"
            data-testid="dev-apps-new"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="tp-titlebar-action-label">建立新應用</span>
          </button>
        }
      />
      <div className="tp-dev-inner">
        <p className="tp-page-eyebrow">開發者後台</p>
        <p className="tp-page-meta">管理你的 OAuth client。每個 app 對應一組 client_id。</p>

        {error && <ErrorBanner message={error} testId="dev-apps-error" />}

        {apps === null && !error && (
          <div className="tp-loading" data-testid="dev-apps-loading">載入中…</div>
        )}

        {apps !== null && apps.length === 0 && (
          <div className="tp-empty" data-testid="dev-apps-empty">
            <h3>尚未建立任何應用</h3>
            <p>建立第一個 OAuth client 來接入「Sign in with Tripline」。</p>
            <button
              className="tp-btn tp-btn-primary tp-btn-lg"
              onClick={() => navigate('/developer/apps/new')}
              data-testid="dev-apps-empty-cta"
            >
              建立第一個應用
            </button>
          </div>
        )}

        {apps !== null && apps.length > 0 && (
          <div className="tp-list-table">
            <div className="tp-list-row tp-list-header">
              <div>應用</div>
              <div>狀態</div>
              <div>建立日期</div>
              <div></div>
            </div>
            {apps.map((app) => {
              const pill = statusPill(app.status);
              return (
                <div className="tp-list-row" key={app.client_id} data-testid={`dev-apps-row-${app.client_id}`}>
                  <div>
                    <div className="tp-app-name">{app.app_name}</div>
                    <div className="tp-app-cid">{app.client_id}</div>
                  </div>
                  <div><span className={pill.className}>{pill.label}</span></div>
                  <div>{new Date(app.created_at).toLocaleDateString('zh-TW')}</div>
                  <div></div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>

      {/* 2026-05-03 modal-to-fullpage migration: create-app modal 已搬到
        * src/pages/DeveloperAppNewPage.tsx (/developer/apps/new)。secret reveal
        * 仍是 modal-style (critical attention UX 例外)，由 NewPage 在 submit
        * 成功後 mount。NewPage ack 後 dispatch tp-developer-app-created event，
        * 列表會 auto-refresh (useEffect listener above)。 */}
      </>}
    />
  );
}
