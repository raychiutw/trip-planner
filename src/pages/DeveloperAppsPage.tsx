/** Developer-owned OAuth registry. Creation and one-time secret reveal live on the new-app page. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { ApiError } from '../lib/errors';
import { apiFetch } from '../lib/apiClient';
import { EVENT } from '../lib/events';
import { parseUtcDate } from '../lib/parseUtcDate';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
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
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px; padding: 14px 20px;
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-subheadline);
}
.tp-list-row > div { min-width: 0; overflow-wrap: anywhere; }
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
  const { user } = useRequireAuth();
  const navigate = useNavigate();
  const [apps, setApps] = useState<ClientApp[] | null>(null);
  const [error, setError] = useState<'denied' | 'failed' | null>(null);
  const readRequest = useRef<AbortController | null>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  const loadApps = useCallback(async () => {
    const retryFocused = document.activeElement === retryRef.current;
    readRequest.current?.abort();
    const request = new AbortController();
    readRequest.current = request;
    setLoading(true);
    try {
      const json = await apiFetch<{ apps: ClientApp[] }>('/dev/apps', { signal: request.signal });
      if (request.signal.aborted) return;
      if (!Array.isArray(json?.apps)) throw new Error('invalid registry');
      const ids = new Set<string>();
      for (const app of json.apps) {
        if (!app || typeof app.client_id !== 'string' || !app.client_id || ids.has(app.client_id) ||
            typeof app.app_name !== 'string' || typeof app.status !== 'string' || typeof app.created_at !== 'string' ||
            !Array.isArray(app.redirect_uris) || app.redirect_uris.some(uri => typeof uri !== 'string')) {
          throw new Error('invalid application metadata');
        }
        ids.add(app.client_id);
      }
      if (retryFocused && (document.activeElement === retryRef.current || document.activeElement === document.body)) {
        contentRef.current?.focus();
      }
      setApps(json.apps);
      setError(null);
    } catch (err) {
      if (request.signal.aborted) return;
      if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
        setApps(null);
        setError('denied');
      } else setError('failed');
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setApps(null);
    setError(null);
    setLoading(true);
    if (!user?.id) return;
    void loadApps();
    // Always read the server registry after creation; never fabricate a row.
    const refresh = () => { void loadApps(); };
    window.addEventListener(EVENT.developerAppCreated, refresh);
    return () => {
      readRequest.current?.abort();
      window.removeEventListener(EVENT.developerAppCreated, refresh);
    };
  }, [user?.id, loadApps]);

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
        actions={user && error !== 'denied' &&
          <button
            type="button"
            className="tp-titlebar-action"
            onClick={() => navigate('/developer/apps/new')}
            aria-label="建立新應用"
            title="建立新應用"
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
      <div className="tp-dev-inner" ref={contentRef} tabIndex={-1} aria-label="開發者應用清單">
        <p className="tp-page-eyebrow">開發者後台</p>
        <p className="tp-page-meta">管理你的 OAuth client。每個應用程式對應一組 client_id。</p>

        {error && <>
          <ErrorBanner message={error === 'denied' ? '目前沒有權限查看開發者應用。' : '無法載入應用列表，請重試。'} testId="dev-apps-error" />
          <button ref={retryRef} type="button" className="tp-btn tp-btn-secondary" disabled={loading} onClick={() => void loadApps()}>重試載入應用</button>
        </>}

        {loading && apps === null && !error && (
          <div className="tp-loading" data-testid="dev-apps-loading">載入中…</div>
        )}

        {!loading && !error && apps !== null && apps.length === 0 && (
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
                    {app.redirect_uris.map((uri, index) => <div className="tp-app-cid" key={index}>回呼 URI：{uri}</div>)}
                  </div>
                  <div><span className={pill.className}>{pill.label}</span></div>
                  <div>{parseUtcDate(app.created_at)?.toLocaleDateString('zh-TW') ?? '時間不明'}</div>
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
