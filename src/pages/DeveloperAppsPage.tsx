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
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { apiFetch } from '../lib/apiClient';
import { ApiError } from '../lib/errors';
import { EVENT } from '../lib/events';
import { parseUtcDate } from '../lib/parseUtcDate';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import ErrorBanner from '../components/shared/ErrorBanner';
import PageErrorState from '../components/shared/PageErrorState';

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
.tp-pill-active { background: var(--color-success-bg); color: var(--color-foreground); }
.tp-pill-pending { background: var(--color-warning-bg); color: var(--color-foreground); }
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
.tp-dev-permission-banner { max-width: 920px; margin: 16px auto 0; }
.tp-dev-page-error {
  padding: 32px 24px; background: var(--color-background);
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  text-align: center;
}
.tp-dev-page-error-title { margin: 0 0 12px; font-weight: 700; color: var(--color-foreground); }
.tp-dev-page-error-desc { margin: 0 0 12px; color: var(--color-muted); font-size: var(--font-size-footnote); }
.tp-dev-page-error-actions { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
.tp-dev-page-error-btn {
  min-height: var(--spacing-tap-min); padding: 8px 16px;
  border: 1px solid var(--color-border); border-radius: var(--radius-full);
  background: var(--color-secondary); color: var(--color-foreground);
  font: inherit; font-weight: 600; cursor: pointer;
}
.tp-dev-page-error-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
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
  if (status === 'active') return { className: 'tp-pill tp-pill-active', label: '使用中' };
  if (status === 'pending_review') return { className: 'tp-pill tp-pill-pending', label: '審核中' };
  if (status === 'suspended') return { className: 'tp-pill tp-pill-suspended', label: '已停用' };
  return { className: 'tp-pill tp-pill-suspended', label: status };
}

export default function DeveloperAppsPage() {
  useRequireAuth(); // V2 sole-auth: redirect to /login if no tripline_session
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const [apps, setApps] = useState<ClientApp[] | null>(null);
  const [error, setError] = useState<'forbidden' | 'failed' | null>(null);
  const [retrying, setRetrying] = useState(false);
  const loadSequence = useRef(0);
  const titlebarActionRef = useRef<HTMLButtonElement>(null);

  async function loadApps() {
    const sequence = ++loadSequence.current;
    setError(null);
    try {
      const json = await apiFetch<{ apps: ClientApp[] }>('/dev/apps');
      if (sequence === loadSequence.current) setApps(json.apps);
    } catch (err) {
      if (sequence === loadSequence.current) {
        setApps(null);
        setError(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'failed');
      }
    }
  }

  useEffect(() => { void loadApps(); }, []);

  // tp-developer-app-created event 觸發 refetch。曾經做過 in-place append 優化
  // (PR #452) 但有 race：listener 跟 initial fetch 順序不定 + DeveloperAppNew
  // 假造 created_at/updated_at 跟 server 真值不一致。改 always refetch，犧牲
  // 一次 GET 換正確性。
  useEffect(() => {
    function handleAppCreated() { void loadApps(); }
    window.addEventListener(EVENT.developerAppCreated, handleAppCreated);
    return () => window.removeEventListener(EVENT.developerAppCreated, handleAppCreated);
  }, []);

  const actionLabel = retrying ? '載入中…' : error === 'forbidden' ? '返回帳號' : error === 'failed' ? '重新載入應用列表' : '建立新應用';
  async function retryApps() {
    setRetrying(true);
    try { await loadApps(); }
    finally { setRetrying(false); }
  }
  function handleTitleBarAction() {
    if (retrying) return;
    if (error === 'forbidden') navigate('/account');
    else if (error === 'failed') void retryApps();
    else navigate('/developer/apps/new');
  }

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      bottomNav={<GlobalBottomNav authed={user !== null} />}
      main={<>
      <style>{SCOPED_STYLES}</style>
      <div className="tp-dev-shell" data-testid="developer-apps-page">
      <TitleBar
        title="應用"
        back={() => navigate('/account')}
        actions={
          <button
            type="button"
            ref={titlebarActionRef}
            className="tp-titlebar-action"
            onClick={handleTitleBarAction}
            aria-label={actionLabel}
            aria-disabled={retrying}
            aria-busy={retrying}
            title={actionLabel}
            data-testid={!error && !retrying ? 'dev-apps-new' : undefined}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              {error === 'forbidden' && <path d="M19 12H5m7-7-7 7 7 7" />}
              {(error === 'failed' || retrying) && <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />}
              {!error && !retrying && <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>}
            </svg>
            <span className="tp-titlebar-action-label">{actionLabel}</span>
          </button>
        }
      />
      {error === 'forbidden' && <ErrorBanner
        message="沒有權限查看開發者應用，請返回帳號。"
        className="tp-dev-permission-banner"
        testId="dev-apps-error"
      />}
      <div className="tp-dev-inner" data-testid="dev-apps-content">
        <p className="tp-page-eyebrow">開發者後台</p>
        <p className="tp-page-meta">管理你的 OAuth client。每個應用程式對應一組 client_id。</p>

        {error === 'failed' && <PageErrorState
          className="tp-dev-page-error"
          title="無法載入應用列表"
          message="資料暫時無法取得，請重試。"
          onRetry={() => { titlebarActionRef.current?.focus(); void retryApps(); }}
          testId="dev-apps-error"
        >
          <div className="tp-dev-page-error-actions">
            <button type="button" className="tp-btn tp-btn-secondary" onClick={() => navigate('/account')}>返回帳號</button>
          </div>
        </PageErrorState>}

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
                  <div>{parseUtcDate(app.created_at)?.toLocaleDateString('zh-TW') ?? app.created_at}</div>
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
