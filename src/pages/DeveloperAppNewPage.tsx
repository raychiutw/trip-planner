/**
 * DeveloperAppNewPage — 建立新 OAuth client 全頁 form
 *
 * Route: /developer/apps/new
 *
 * 2026-05-03 modal-to-fullpage migration (PR series 5/N): 從原
 * src/pages/DeveloperAppsPage.tsx createDeveloperAppModal block 抽出。
 * 9+ field form (app_name + redirect_uris textarea + client_type radio cards
 * + scopes checkboxes) 是 DESIGN.md 2026-05-03「複雜 form 流程必走全頁」
 * 規範範圍。Form submit 成功後，secret reveal 仍以 modal-style 呈現 (critical
 * attention UX，DESIGN.md 允許 confirm-style modal 例外)，「我已複製，繼續」
 * → navigate 回 /developer/apps + dispatch tp-developer-app-created event
 * 讓列表頁 refresh。
 *
 * 結構: AppShell + sticky TitleBar(返回 + 「建立新應用」 + 「建立」 action with
 *       .tp-titlebar-action.is-primary) + form (name + redirect_uris +
 *       client_type radio + scopes checkbox + InlineError) + secret modal
 *       (driven by submit success state)。
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { routes } from '../lib/routes';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import TitleBar from '../components/shell/TitleBar';
import TitleBarPrimaryAction from '../components/shell/TitleBarPrimaryAction';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import { useCurrentUser } from '../hooks/useCurrentUser';
import InlineError from '../components/shared/InlineError';

const SCOPED_STYLES = `
.tp-dev-new-shell {
  min-height: 100dvh;
  background: var(--color-secondary);
}
.tp-dev-new-inner {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 96px;
}
.tp-dev-new-card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 28px 32px;
}
.tp-dev-new-intro h2 {
  margin: 0 0 6px;
  font-size: var(--font-size-headline);
  font-weight: 800;
  color: var(--color-foreground);
}
.tp-dev-new-intro p {
  margin: 0 0 24px;
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
}

/* Form rows — 沿用原 modal CSS 規格 */
.tp-form { display: flex; flex-direction: column; gap: 16px; }
.tp-form-row { display: flex; flex-direction: column; gap: 6px; }
.tp-form-row label {
  font-size: var(--font-size-footnote); font-weight: 600;
  display: flex; justify-content: space-between; align-items: baseline;
}
.tp-form-row .tp-hint {
  font-size: var(--font-size-caption2);
  color: var(--color-muted); font-weight: 500;
}
.tp-form-row input, .tp-form-row textarea {
  font-family: inherit; font-size: var(--font-size-callout);
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
}
.tp-form-row textarea {
  font-family: 'SF Mono', ui-monospace, monospace;
  font-size: var(--font-size-footnote);
  min-height: 80px; resize: vertical;
}
.tp-form-row input:focus, .tp-form-row textarea:focus {
  outline: 2px solid var(--color-accent); outline-offset: -2px;
  border-color: var(--color-accent);
}

.tp-radio-group {
  display: flex; gap: 8px;
}
.tp-radio-card {
  flex: 1; padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex; gap: 10px; align-items: center;
}
.tp-radio-card input { margin: 0; }
.tp-radio-card-active {
  border: 2px solid var(--color-accent);
  padding: 11px;
}
.tp-radio-card-content strong {
  display: block;
  font-size: var(--font-size-footnote); font-weight: 700;
}
.tp-radio-card-content span {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
}

.tp-pill {
  display: inline-flex; padding: 2px 8px;
  border-radius: var(--radius-xs);
  font-size: var(--font-size-caption2);
  font-weight: 700; letter-spacing: 0.04em;
  text-transform: uppercase;
}
.tp-pill-pending { background: var(--color-warning-bg); color: var(--color-warning); }

/* sticky bottom bar 已移到 css/tokens.css .tp-page-bottom-bar 共用,DeveloperAppNew 用 --end variant + buttons flex:1 撐滿。 */
.tp-page-bottom-bar.tp-page-bottom-bar--end .tp-btn { flex: 1; }

/* .tp-btn family 移到 css/tokens.css 共用。 */

/* Secret reveal modal — 沿用原 DeveloperAppsPage block，critical attention UX */
.tp-modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(15, 18, 24, 0.45);
  display: grid; place-items: center;
  z-index: 200; padding: 16px;
}
.tp-modal {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  width: 100%; max-width: 540px;
  max-height: 90dvh; overflow-y: auto;
  box-shadow: 0 12px 48px rgba(15, 18, 24, 0.18);
}
.tp-modal-header {
  padding: 24px 28px 16px;
  border-bottom: 1px solid var(--color-border);
}
.tp-modal-header h3 {
  font-size: var(--font-size-headline); font-weight: 800;
  margin: 0 0 4px;
}
.tp-modal-header p {
  font-size: var(--font-size-footnote); color: var(--color-muted);
  margin: 0;
}
.tp-modal-body { padding: 24px 28px; }
.tp-modal-footer {
  padding: 16px 24px 24px;
  display: flex; gap: 8px;
}
.tp-modal-footer .tp-btn { flex: 1; }

.tp-secret-icon-circle {
  width: 56px; height: 56px;
  border-radius: var(--radius-full);
  background: var(--color-success-bg);
  color: var(--color-success);
  display: grid; place-items: center;
  margin: 0 auto 12px;
}
.tp-secret-icon-circle svg { width: 28px; height: 28px; }

.tp-code-block {
  background: var(--color-foreground);
  color: var(--color-background);
  font-family: 'SF Mono', ui-monospace, monospace;
  font-size: var(--font-size-caption);
  padding: 12px 16px;
  border-radius: var(--radius-md);
  overflow-x: auto;
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; word-break: break-all;
}
.tp-code-block-secret {
  background: var(--color-destructive); color: #fff;
}
.tp-code-block code { flex: 1; user-select: all; }
.tp-code-block button {
  flex-shrink: 0; padding: 4px 10px;
  border-radius: var(--radius-xs);
  background: rgba(255, 255, 255, 0.18); color: var(--color-background);
  border: none; font-size: var(--font-size-caption2);
  font-weight: 600; cursor: pointer; font-family: inherit;
}
.tp-code-block-secret button {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}
.tp-secret-warning {
  font-size: var(--font-size-caption);
  color: var(--color-destructive);
  margin-top: 4px;
}
`;

interface NewAppResult {
  client_id: string;
  client_secret: string | null;
  app_name: string;
  client_type: string;
  status: string;
  redirect_uris: string[];
  allowed_scopes: string[];
}

const SCOPE_OPTIONS: Array<{ key: string; label: string; default?: boolean; risky?: boolean }> = [
  { key: 'openid', label: 'openid — OIDC 識別', default: true },
  { key: 'profile', label: 'profile — 名稱/頭像', default: true },
  { key: 'email', label: 'email — Email 地址', default: true },
  { key: 'trips.read', label: 'trips.read — 讀取行程' },
  { key: 'trips.write', label: 'trips.write — 修改行程', risky: true },
];

export default function DeveloperAppNewPage() {
  const auth = useRequireAuth();
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const handleCancel = useNavigateBack(routes.developerApps());

  const [form, setForm] = useState({
    app_name: '',
    redirect_uris: '',
    client_type: 'public' as 'public' | 'confidential',
    scopes: new Set(SCOPE_OPTIONS.filter((o) => o.default).map((o) => o.key)),
  });
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [secretResult, setSecretResult] = useState<NewAppResult | null>(null);

  function toggleScope(key: string) {
    setForm((f) => {
      const next = new Set(f.scopes);
      if (next.has(key)) next.delete(key); else next.add(key);
      return { ...f, scopes: next };
    });
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setCreateError(null);
    const redirect_uris = form.redirect_uris
      .split('\n').map((s) => s.trim()).filter(Boolean);
    if (form.app_name.trim().length < 2) {
      setCreateError('app_name 至少 2 字');
      return;
    }
    if (redirect_uris.length === 0) {
      setCreateError('redirect_uris 至少需要 1 個');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/dev/apps', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          app_name: form.app_name.trim(),
          client_type: form.client_type,
          redirect_uris,
          allowed_scopes: Array.from(form.scopes),
        }),
      });
      if (res.ok) {
        const result = (await res.json()) as NewAppResult;
        setSecretResult(result);
        return;
      }
      const errJson = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
      setCreateError(errJson?.error?.message ?? '建立失敗，請稍後再試。');
    } catch {
      setCreateError('網路連線失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }


  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore — user can manually select
    }
  }

  function ackSecret() {
    setSecretResult(null);
    // Notify list page to refetch — picked up by DeveloperAppsPage 'tp-developer-app-created' listener
    window.dispatchEvent(new CustomEvent('tp-developer-app-created'));
    navigate(routes.developerApps());
  }

  if (!auth.user) return null;

  const titleBarActions = (
    <TitleBarPrimaryAction
      label="建立"
      busyLabel="建立中⋯"
      busy={submitting}
      onClick={() => void handleSubmit()}
      testId="dev-app-new-titlebar-submit"
    />
  );

  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      main={<>
        <style>{SCOPED_STYLES}</style>
        <div className="tp-dev-new-shell" data-testid="dev-app-new-page">
          <TitleBar
            title="建立新應用"
            back={handleCancel}
            backLabel="返回應用列表"
            actions={titleBarActions}
          />
          <div className="tp-dev-new-inner">
            <div className="tp-dev-new-card">
              <div className="tp-dev-new-intro">
                <h2>OAuth Client 設定</h2>
                <p>填寫基本資訊，下一步將產生 client_id 與 client_secret。</p>
              </div>
              <form className="tp-form" onSubmit={handleSubmit} noValidate>
                <div className="tp-form-row">
                  <label htmlFor="da-name">應用名稱 <span className="tp-hint">使用者會在同意畫面看到</span></label>
                  <input
                    id="da-name"
                    type="text"
                    value={form.app_name}
                    onChange={(e) => setForm({ ...form, app_name: e.target.value })}
                    required
                    minLength={2}
                    maxLength={80}
                    data-testid="dev-app-new-name"
                  />
                </div>
                <div className="tp-form-row">
                  <label htmlFor="da-uris">Redirect URIs <span className="tp-hint">每行一個，HTTPS only（localhost 例外）</span></label>
                  <textarea
                    id="da-uris"
                    rows={3}
                    value={form.redirect_uris}
                    onChange={(e) => setForm({ ...form, redirect_uris: e.target.value })}
                    placeholder="https://your-app.com/auth/callback"
                    data-testid="dev-app-new-uris"
                  />
                </div>
                <div className="tp-form-row">
                  <label>類型</label>
                  <div className="tp-radio-group">
                    <label className={`tp-radio-card ${form.client_type === 'public' ? 'tp-radio-card-active' : ''}`}>
                      <input
                        type="radio"
                        name="client_type"
                        checked={form.client_type === 'public'}
                        onChange={() => setForm({ ...form, client_type: 'public' })}
                        data-testid="dev-app-new-type-public"
                      />
                      <div className="tp-radio-card-content">
                        <strong>Public</strong>
                        <span>App 端 / SPA — 無 secret，PKCE 強制</span>
                      </div>
                    </label>
                    <label className={`tp-radio-card ${form.client_type === 'confidential' ? 'tp-radio-card-active' : ''}`}>
                      <input
                        type="radio"
                        name="client_type"
                        checked={form.client_type === 'confidential'}
                        onChange={() => setForm({ ...form, client_type: 'confidential' })}
                        data-testid="dev-app-new-type-confidential"
                      />
                      <div className="tp-radio-card-content">
                        <strong>Confidential</strong>
                        <span>Server-side — 配 client_secret</span>
                      </div>
                    </label>
                  </div>
                </div>
                <div className="tp-form-row">
                  <label>申請的 scopes</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {SCOPE_OPTIONS.map((opt) => (
                      <label key={opt.key} style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: 'var(--font-size-footnote)' }}>
                        <input
                          type="checkbox"
                          checked={form.scopes.has(opt.key)}
                          onChange={() => toggleScope(opt.key)}
                          data-testid={`dev-app-new-scope-${opt.key}`}
                        />
                        <span>{opt.label}</span>
                        {opt.risky && <span className="tp-pill tp-pill-pending">高風險</span>}
                      </label>
                    ))}
                  </div>
                </div>
                {createError && <InlineError message={createError} testId="dev-app-new-error" />}
              </form>
            </div>
          </div>

          <div className="tp-page-bottom-bar tp-page-bottom-bar--end">
            <button
              type="button"
              className="tp-btn"
              onClick={handleCancel}
              disabled={submitting}
              data-testid="dev-app-new-cancel"
            >
              取消
            </button>
            <button
              type="button"
              className="tp-btn tp-btn-primary"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              data-testid="dev-app-new-submit"
            >
              {submitting ? '建立中…' : '建立應用'}
            </button>
          </div>
        </div>

        {/* Secret reveal — 沿用 modal-style 是 critical attention UX 例外
          * (DESIGN.md 允許 confirm-style modal)。secret 是 server response 一次性
          * client-side state，不適合走 page (back / share / refresh 都會丟資料)。 */}
        {secretResult && (
          <div className="tp-modal-backdrop" role="dialog" aria-modal="true" data-testid="dev-app-new-secret-modal">
            <div className="tp-modal">
              <div className="tp-modal-header" style={{ textAlign: 'center' }}>
                <div className="tp-secret-icon-circle" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3>應用建立成功</h3>
                <p>{secretResult.client_secret ? '請立即複製 client_secret — 為了安全，這是它唯一一次顯示' : 'Client ID 已產生'}</p>
              </div>
              <div className="tp-modal-body">
                <div className="tp-form-row" style={{ marginBottom: '12px' }}>
                  <label>Client ID</label>
                  <div className="tp-code-block">
                    <code data-testid="dev-app-new-secret-client-id">{secretResult.client_id}</code>
                    <button type="button" onClick={() => void copy(secretResult.client_id)}>複製</button>
                  </div>
                </div>
                {secretResult.client_secret && (
                  <div className="tp-form-row">
                    <label style={{ color: 'var(--color-destructive)' }}>Client Secret</label>
                    <div className="tp-code-block tp-code-block-secret">
                      <code data-testid="dev-app-new-secret-client-secret">{secretResult.client_secret}</code>
                      <button type="button" onClick={() => void copy(secretResult.client_secret as string)}>複製</button>
                    </div>
                    <div className="tp-secret-warning">
                      ⚠ 此 secret 不會再顯示。請存到密碼管理器或環境變數。
                    </div>
                  </div>
                )}
              </div>
              <div className="tp-modal-footer">
                <button
                  type="button"
                  className="tp-btn tp-btn-primary tp-btn-block"
                  onClick={ackSecret}
                  data-testid="dev-app-new-secret-acknowledge"
                >
                  我已複製，繼續
                </button>
              </div>
            </div>
          </div>
        )}
      </>}
      bottomNav={<GlobalBottomNav authed={!!user} />}
    />
  );
}
