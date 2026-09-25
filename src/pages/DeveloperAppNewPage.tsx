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
 * attention UX，DESIGN.md 允許 confirm-style modal 例外)，「我已安全保存，繼續」
 * → navigate 回 /developer/apps + dispatch tp-developer-app-created event
 * 讓列表頁 refresh。
 *
 * 結構: AppShell + sticky TitleBar(返回 + 「建立新應用」 + 「建立」 action with
 *       .tp-titlebar-action.is-primary) + form (name + redirect_uris +
 *       client_type radio + scopes checkbox + InlineError) + secret modal
 *       (driven by submit success state)。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSheetBehavior } from '../hooks/useSheetBehavior';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { apiFetch } from '../lib/apiClient';
import { ApiError } from '../lib/errors';
import { routes } from '../lib/routes';
import { EVENT } from '../lib/events';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import TitleBar from '../components/shell/TitleBar';
import TitleBarPrimaryAction from '../components/shell/TitleBarPrimaryAction';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import { SELF_SERVICE_SCOPES, SCOPE_DESCRIPTIONS } from '../lib/oauthScopes';
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

/* .tp-form / .tp-form-row / .tp-hint 移到 css/tokens.css 共用（DeveloperAppNew 用密集預設）。 */

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
  background: var(--color-destructive); color: var(--color-accent-foreground);
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
  color: var(--color-accent-foreground);
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

const SCOPE_OPTIONS = SELF_SERVICE_SCOPES.map(key => ({
  key, label: `${key} — ${SCOPE_DESCRIPTIONS[key]}`, default: key !== 'offline_access',
}));

export default function DeveloperAppNewPage() {
  const auth = useRequireAuth();
  const { user } = auth;
  const navigate = useNavigate();
  const navigateBack = useNavigateBack(routes.developerApps());

  const [form, setForm] = useState({
    app_name: '',
    redirect_uris: '',
    client_type: 'public' as 'public' | 'confidential',
    scopes: new Set<string>(SCOPE_OPTIONS.filter((o) => o.default).map((o) => o.key)),
  });
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [registrationUncertain, setRegistrationUncertain] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<'name' | 'uris' | 'scopes' | null>(null);
  useEffect(() => {
    if (createError && errorField && !submitting) document.getElementById(`da-${errorField}`)?.focus();
  }, [createError, errorField, submitting]);
  const [secretResult, setSecretResult] = useState<NewAppResult | null>(null);
  const [copyStatus, setCopyStatus] = useState<{ target: 'Client ID' | 'Client Secret'; state: 'pending' | 'success' | 'failed' } | null>(null);
  const copyBusy = useRef(false);
  const copyTrigger = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (copyStatus && copyStatus.state !== 'pending' && document.activeElement === document.body) {
      copyTrigger.current?.focus();
    }
  }, [copyStatus]);
  const lifetime = useRef(0);
  useEffect(() => () => { lifetime.current++; }, [user?.id]);
  useEffect(() => {
    if (!secretResult?.client_secret) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [secretResult]);

  function handleCancel() {
    if (!submitting && !secretResult) navigateBack();
  }

  function toggleScope(key: string) {
    setForm((f) => {
      const next = new Set(f.scopes);
      if (next.has(key)) next.delete(key); else next.add(key);
      return { ...f, scopes: next };
    });
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (submittingRef.current) return;
    setCreateError(null);
    setErrorField(null);
    const uriLines = form.redirect_uris.split('\n').map((text, index) => ({ uri: text.trim(), line: index + 1 })).filter(row => row.uri);
    const redirect_uris = uriLines.map(row => row.uri);
    if (form.app_name.trim().length < 2 || form.app_name.trim().length > 80) {
      setErrorField('name');
      setCreateError('應用名稱需 2–80 字');
      return;
    }
    if (redirect_uris.length === 0) {
      setErrorField('uris');
      setCreateError('Redirect URIs 至少需要 1 個');
      return;
    }
    if (form.scopes.size === 0) {
      setErrorField('scopes');
      setCreateError('請至少選擇一項 scope。');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    const operation = lifetime.current;
    try {
      const result = await apiFetch<NewAppResult>('/dev/apps', {
        method: 'POST',
        body: JSON.stringify({
          app_name: form.app_name.trim(),
          client_type: form.client_type,
          redirect_uris,
          allowed_scopes: Array.from(form.scopes),
        }),
      });
      if (operation !== lifetime.current) return;
      if (!result || typeof result.client_id !== 'string' || !result.client_id.trim() ||
          result.client_type !== form.client_type ||
          (form.client_type === 'confidential' ? typeof result.client_secret !== 'string' || !result.client_secret.trim() : result.client_secret !== null)) {
        setRegistrationUncertain(true);
        setCreateError('伺服器未回傳完整憑證，應用可能已建立。請先返回應用列表確認；一次性密鑰無法重新取得，請勿重複送出。');
        return;
      }
      setSecretResult(result);
    } catch (err) {
      if (operation !== lifetime.current) return;
      submittingRef.current = false;
      if (err instanceof ApiError) {
        // ApiError.detail = backend `error.message` 人話；err.message = code (例 'invalid_redirect')
        const detail = err.detail ?? '建立失敗，請稍後再試。';
        setErrorField(detail.includes('redirect_uris') ? 'uris' : detail.includes('scope') ? 'scopes' : detail.includes('app_name') ? 'name' : null);
        setCreateError(detail.replace(/redirect_uris\[(\d+)\]/g, (match, index: string) => {
          const row = uriLines[Number(index)];
          return row ? `Redirect URI 第 ${row.line} 行` : match;
        }));
      } else {
        setCreateError('網路連線失敗，請稍後再試。');
      }
    } finally {
      if (operation === lifetime.current) setSubmitting(false);
    }
  }


  async function copy(target: 'Client ID' | 'Client Secret', value: string) {
    if (copyBusy.current) return;
    copyBusy.current = true;
    copyTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const operation = lifetime.current;
    setCopyStatus({ target, state: 'pending' });
    try {
      await navigator.clipboard.writeText(value);
      if (operation === lifetime.current) setCopyStatus({ target, state: 'success' });
    } catch {
      if (operation === lifetime.current) setCopyStatus({ target, state: 'failed' });
    } finally {
      if (operation === lifetime.current) copyBusy.current = false;
    }
  }

  function selectCredential(event: React.FocusEvent<HTMLElement>) {
    const range = document.createRange();
    range.selectNodeContents(event.currentTarget);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function ackSecret() {
    if (copyBusy.current) return;
    setSecretResult(null);
    setCopyStatus(null);
    // Notify DeveloperAppsPage to refetch — listener 跑 GET /api/dev/apps 拿
    // 真實 server row。不傳 detail (PR #452 client-side fabricate row 有 race +
    // 假造 created_at 不可靠，改 always refetch)。
    window.dispatchEvent(new CustomEvent(EVENT.developerAppCreated));
    navigate(routes.developerApps(), { replace: true });
  }

  /*
   * Secret modal 的 sheet 引擎（#1150 story 6）：它宣告 `aria-modal="true"` 卻沒有 focus
   * trap —— 鍵盤使用者一路 Tab 會跑到被 backdrop 遮住的表單上，而螢幕閱讀器已經照
   * aria-modal 把那些藏起來了。
   *
   * `canDismiss: false` 是刻意的：client_secret 是 server 回應的**一次性** state，
   * 一個誤按的 Escape 就永久丟失。只能走「我已安全保存，繼續」。
   * 初始焦點留在 panel（引擎預設）而不是確認鈕 —— 一開就聚焦確認鈕的話，一個
   * 順手的 Enter 會在使用者複製到 secret 之前就把它關掉。
   */
  const { panelRef, backdropRef, handlePanelKeyDown } = useSheetBehavior(
    secretResult !== null,
    ackSecret,
    { canDismiss: false },
  );

  if (!auth.user) return null;

  const titleBarActions = (
    <TitleBarPrimaryAction
      label="建立"
      busyLabel="建立中⋯"
      busy={submitting}
      disabled={!!secretResult || registrationUncertain}
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
                <p>填寫基本資訊以產生 Client ID。只有 Confidential 類型會產生一次性 Client Secret。</p>
              </div>
              <form className="tp-form" onSubmit={handleSubmit} noValidate>
                <div className="tp-form-row">
                  <label htmlFor="da-name">應用名稱 <span className="tp-hint">使用者會在同意畫面看到</span></label>
                  <input
                    disabled={submitting || !!secretResult || registrationUncertain}
                    id="da-name"
                    aria-invalid={errorField === 'name' || undefined}
                    aria-describedby={errorField === 'name' ? 'da-error' : undefined}
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
                  <label htmlFor="da-uris">Redirect URIs <span className="tp-hint">每行一個，最多 10 個</span></label>
                  <textarea
                    disabled={submitting || !!secretResult || registrationUncertain}
                    id="da-uris"
                    aria-invalid={errorField === 'uris' || undefined}
                    aria-describedby={errorField === 'uris' ? 'da-error da-uris-hint' : 'da-uris-hint'}
                    rows={3}
                    value={form.redirect_uris}
                    onChange={(e) => setForm({ ...form, redirect_uris: e.target.value })}
                    placeholder="https://your-app.com/auth/callback"
                    data-testid="dev-app-new-uris"
                  />
                  <p id="da-uris-hint" className="tp-hint">使用 HTTPS；本機開發可用 HTTP localhost／127.0.0.1／[::1]。不可包含帳密、?query 或 #fragment。</p>
                </div>
                <div className="tp-form-row" role="group" aria-labelledby="da-type-label">
                  <span id="da-type-label">類型</span>
                  <div className="tp-radio-group">
                    <label className={`tp-radio-card ${form.client_type === 'public' ? 'tp-radio-card-active' : ''}`}>
                      <input
                        disabled={submitting || !!secretResult || registrationUncertain}
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
                        disabled={submitting || !!secretResult || registrationUncertain}
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
                <div id="da-scopes" tabIndex={-1} className="tp-form-row" role="group" aria-labelledby="da-scopes-label" aria-invalid={errorField === 'scopes' || undefined} aria-describedby={errorField === 'scopes' ? 'da-error' : undefined}>
                  <span id="da-scopes-label">申請的 scopes</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {SCOPE_OPTIONS.map((opt) => (
                      <label key={opt.key} style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: 'var(--font-size-footnote)' }}>
                        <input
                          disabled={submitting || !!secretResult || registrationUncertain}
                          type="checkbox"
                          checked={form.scopes.has(opt.key)}
                          onChange={() => toggleScope(opt.key)}
                          data-testid={`dev-app-new-scope-${opt.key}`}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {createError && <InlineError id="da-error" message={createError} testId="dev-app-new-error" />}
              </form>
            </div>
          </div>

          <div className="tp-page-bottom-bar tp-page-bottom-bar--end">
            <button
              type="button"
              className="tp-btn"
              onClick={handleCancel}
              disabled={submitting || !!secretResult}
              data-testid="dev-app-new-cancel"
            >
              取消
            </button>
            <button
              type="button"
              className="tp-btn tp-btn-primary"
              onClick={() => void handleSubmit()}
              disabled={submitting || !!secretResult || registrationUncertain}
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
          <div ref={backdropRef} className="tp-modal-backdrop" data-testid="dev-app-new-secret-modal">
            {/* role="dialog" + aria-modal 掛在 panel 而非 backdrop —— dialog 的邊界是面板本身；
              * 掛在 backdrop 上會把遮罩也算進對話框範圍。順帶補 aria-label，原本這個
              * role="dialog" 沒有可及名稱、螢幕閱讀器只會念「dialog」。 */}
            <div
              ref={panelRef}
              tabIndex={-1}
              className="tp-modal"
              role="dialog"
              aria-modal="true"
              aria-label="應用程式憑證"
              onKeyDown={handlePanelKeyDown}
            >
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
                    <code tabIndex={0} aria-label="Client ID" onFocus={selectCredential} data-testid="dev-app-new-secret-client-id">{secretResult.client_id}</code>
                    <button type="button" aria-label="複製 Client ID" disabled={copyStatus?.state === 'pending'} onClick={() => void copy('Client ID', secretResult.client_id)}>複製</button>
                  </div>
                </div>
                {secretResult.client_secret && (
                  <div className="tp-form-row">
                    <label style={{ color: 'var(--color-destructive)' }}>Client Secret</label>
                    <div className="tp-code-block tp-code-block-secret">
                      <code tabIndex={0} aria-label="Client Secret" onFocus={selectCredential} data-testid="dev-app-new-secret-client-secret">{secretResult.client_secret}</code>
                      <button type="button" aria-label="複製 Client Secret" disabled={copyStatus?.state === 'pending'} onClick={() => void copy('Client Secret', secretResult.client_secret!)}>複製</button>
                    </div>
                    <div className="tp-secret-warning">
                      ⚠ 此 secret 關閉後無法重新取得，重新整理也會遺失。請先存到密碼管理器或環境變數；若遺失，需建立新的應用。
                    </div>
                  </div>
                )}
                {copyStatus?.state === 'failed' && <InlineError message={`${copyStatus.target} 複製失敗。請重試，或選取上方文字手動複製。`} />}
                {copyStatus?.state === 'success' && <p role="status">{copyStatus.target} 已複製。</p>}
              </div>
              <div className="tp-modal-footer">
                <button
                  type="button"
                  className="tp-btn tp-btn-primary tp-btn-block"
                  onClick={ackSecret}
                  disabled={copyStatus?.state === 'pending'}
                  data-testid="dev-app-new-secret-acknowledge"
                >
                  {secretResult.client_secret ? '我已安全保存，繼續' : '返回應用列表'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>}
      bottomNav={<GlobalBottomNav authed={user !== null} />}
    />
  );
}
