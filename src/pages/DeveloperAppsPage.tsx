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
import { useRequireAuth } from '../hooks/useRequireAuth';

const SCOPED_STYLES = `
.tp-dev-shell {
  min-height: 100dvh; padding: 32px 16px 64px;
  background: var(--color-secondary);
}
.tp-dev-inner { max-width: 920px; margin: 0 auto; }

.tp-page-heading {
  display: flex; align-items: flex-end;
  justify-content: space-between; gap: 16px;
  margin-bottom: 24px; flex-wrap: wrap;
}
.tp-page-heading-text { flex: 1 1 auto; }
.tp-page-heading-crumb {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--color-muted); margin-bottom: 8px;
}
.tp-page-heading h1 {
  font-size: var(--font-size-title); font-weight: 800;
  letter-spacing: -0.02em; margin: 0 0 6px;
}
.tp-page-heading p {
  color: var(--color-muted); font-size: var(--font-size-subheadline);
  margin: 0;
}

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

.tp-btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 6px;
  padding: 8px 14px; border-radius: var(--radius-sm);
  font-family: inherit; font-size: var(--font-size-footnote);
  font-weight: 600; border: 1px solid var(--color-border);
  background: var(--color-background); color: var(--color-foreground);
  cursor: pointer; min-height: 36px;
  transition: background 120ms;
}
.tp-btn:hover:not(:disabled) { background: var(--color-hover); }
.tp-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.tp-btn-primary { background: var(--color-accent); color: #fff; border: none; }
.tp-btn-primary:hover:not(:disabled) { filter: brightness(0.92); }
.tp-btn-block { width: 100%; min-height: 48px; padding: 12px 20px; font-size: var(--font-size-callout); }
.tp-btn-lg { min-height: 44px; padding: 10px 18px; font-size: var(--font-size-callout); }

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

.tp-modal-backdrop {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(42, 31, 24, 0.45);
  display: grid; place-items: center;
  padding: 24px; overflow-y: auto;
}
.tp-modal {
  background: var(--color-background);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  max-width: 520px; width: 100%;
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
.tp-form-row .tp-error {
  font-size: var(--font-size-caption);
  color: var(--color-destructive);
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
  padding: 11px; /* compensate */
}
.tp-radio-card-content strong {
  display: block;
  font-size: var(--font-size-footnote); font-weight: 700;
}
.tp-radio-card-content span {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
}

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

function statusPill(status: string): { className: string; label: string } {
  if (status === 'active') return { className: 'tp-pill tp-pill-active', label: 'ACTIVE' };
  if (status === 'pending_review') return { className: 'tp-pill tp-pill-pending', label: 'PENDING' };
  return { className: 'tp-pill tp-pill-suspended', label: status.toUpperCase() };
}

export default function DeveloperAppsPage() {
  useRequireAuth(); // V2 sole-auth: redirect to /login if no tripline_session
  const [apps, setApps] = useState<ClientApp[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    app_name: '',
    redirect_uris: '',
    client_type: 'public' as 'public' | 'confidential',
    scopes: new Set(SCOPE_OPTIONS.filter((o) => o.default).map((o) => o.key)),
  });
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [secretResult, setSecretResult] = useState<NewAppResult | null>(null);

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

  function resetForm() {
    setCreateForm({
      app_name: '',
      redirect_uris: '',
      client_type: 'public',
      scopes: new Set(SCOPE_OPTIONS.filter((o) => o.default).map((o) => o.key)),
    });
    setCreateError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    const redirect_uris = createForm.redirect_uris
      .split('\n').map((s) => s.trim()).filter(Boolean);
    if (createForm.app_name.trim().length < 2) {
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
          app_name: createForm.app_name.trim(),
          client_type: createForm.client_type,
          redirect_uris,
          allowed_scopes: Array.from(createForm.scopes),
        }),
      });
      if (res.ok) {
        const result = (await res.json()) as NewAppResult;
        setCreating(false);
        resetForm();
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

  function toggleScope(key: string) {
    setCreateForm((f) => {
      const next = new Set(f.scopes);
      if (next.has(key)) next.delete(key); else next.add(key);
      return { ...f, scopes: next };
    });
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore — user can manually select
    }
  }

  function closeSecretModal() {
    setSecretResult(null);
    void loadApps();
  }

  return (
    <main className="tp-dev-shell" data-testid="developer-apps-page">
      <style>{SCOPED_STYLES}</style>
      <div className="tp-dev-inner">
        <div className="tp-page-heading">
          <div className="tp-page-heading-text">
            <div className="tp-page-heading-crumb">開發者後台</div>
            <h1>應用</h1>
            <p>管理你的 OAuth client。每個 app 對應一組 client_id。</p>
          </div>
          <button
            className="tp-btn tp-btn-primary tp-btn-lg"
            onClick={() => setCreating(true)}
            data-testid="dev-apps-new"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            建立新應用
          </button>
        </div>

        {error && (
          <div className="tp-error-banner" role="alert" data-testid="dev-apps-error">{error}</div>
        )}

        {apps === null && !error && (
          <div className="tp-loading" data-testid="dev-apps-loading">載入中…</div>
        )}

        {apps !== null && apps.length === 0 && (
          <div className="tp-empty" data-testid="dev-apps-empty">
            <h3>尚未建立任何應用</h3>
            <p>建立第一個 OAuth client 來接入「Sign in with Tripline」。</p>
            <button
              className="tp-btn tp-btn-primary tp-btn-lg"
              onClick={() => setCreating(true)}
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

      {creating && (
        <div className="tp-modal-backdrop" role="dialog" aria-modal="true" data-testid="dev-apps-create-modal">
          <div className="tp-modal">
            <div className="tp-modal-header">
              <h3>建立新應用</h3>
              <p>填寫基本資訊，下一步將產生 client_id 與 client_secret。</p>
            </div>
            <form className="tp-form" onSubmit={handleCreate} noValidate>
              <div className="tp-modal-body">
                <div className="tp-form-row">
                  <label htmlFor="da-name">應用名稱 <span className="tp-hint">使用者會在同意畫面看到</span></label>
                  <input
                    id="da-name"
                    type="text"
                    value={createForm.app_name}
                    onChange={(e) => setCreateForm({ ...createForm, app_name: e.target.value })}
                    required
                    minLength={2}
                    maxLength={80}
                    data-testid="dev-apps-name"
                  />
                </div>
                <div className="tp-form-row">
                  <label htmlFor="da-uris">Redirect URIs <span className="tp-hint">每行一個，HTTPS only（localhost 例外）</span></label>
                  <textarea
                    id="da-uris"
                    rows={3}
                    value={createForm.redirect_uris}
                    onChange={(e) => setCreateForm({ ...createForm, redirect_uris: e.target.value })}
                    placeholder="https://your-app.com/auth/callback"
                    data-testid="dev-apps-uris"
                  />
                </div>
                <div className="tp-form-row">
                  <label>類型</label>
                  <div className="tp-radio-group">
                    <label className={`tp-radio-card ${createForm.client_type === 'public' ? 'tp-radio-card-active' : ''}`}>
                      <input
                        type="radio"
                        name="client_type"
                        checked={createForm.client_type === 'public'}
                        onChange={() => setCreateForm({ ...createForm, client_type: 'public' })}
                        data-testid="dev-apps-type-public"
                      />
                      <div className="tp-radio-card-content">
                        <strong>Public</strong>
                        <span>App 端 / SPA — 無 secret，PKCE 強制</span>
                      </div>
                    </label>
                    <label className={`tp-radio-card ${createForm.client_type === 'confidential' ? 'tp-radio-card-active' : ''}`}>
                      <input
                        type="radio"
                        name="client_type"
                        checked={createForm.client_type === 'confidential'}
                        onChange={() => setCreateForm({ ...createForm, client_type: 'confidential' })}
                        data-testid="dev-apps-type-confidential"
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
                          checked={createForm.scopes.has(opt.key)}
                          onChange={() => toggleScope(opt.key)}
                          data-testid={`dev-apps-scope-${opt.key}`}
                        />
                        <span>{opt.label}</span>
                        {opt.risky && <span className="tp-pill tp-pill-pending">高風險</span>}
                      </label>
                    ))}
                  </div>
                </div>
                {createError && (
                  <div className="tp-error" role="alert" data-testid="dev-apps-create-error">{createError}</div>
                )}
              </div>
              <div className="tp-modal-footer">
                <button
                  type="button"
                  className="tp-btn"
                  onClick={() => { setCreating(false); resetForm(); }}
                  disabled={submitting}
                  data-testid="dev-apps-create-cancel"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="tp-btn tp-btn-primary"
                  disabled={submitting}
                  data-testid="dev-apps-create-submit"
                >
                  {submitting ? '建立中…' : '建立應用'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {secretResult && (
        <div className="tp-modal-backdrop" role="dialog" aria-modal="true" data-testid="dev-apps-secret-modal">
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
                  <code data-testid="dev-apps-secret-client-id">{secretResult.client_id}</code>
                  <button type="button" onClick={() => void copy(secretResult.client_id)}>複製</button>
                </div>
              </div>
              {secretResult.client_secret && (
                <div className="tp-form-row">
                  <label style={{ color: 'var(--color-destructive)' }}>Client Secret</label>
                  <div className="tp-code-block tp-code-block-secret">
                    <code data-testid="dev-apps-secret-client-secret">{secretResult.client_secret}</code>
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
                onClick={closeSecretModal}
                data-testid="dev-apps-secret-acknowledge"
              >
                我已複製，繼續
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
