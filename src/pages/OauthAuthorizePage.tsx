/**
 * OauthAuthorizePage — 新 api 的第一方 App「瀏覽器登入」授權頁（設計稿 C：帳號晶片＋單一按鈕）。
 *
 * URL: /oauth/authorize?request_id=…（由新 api 的 GET /api/oauth/authorize 302 過來）
 *
 * 流程：
 *   1. 還原登入（refresh token＋金鑰）；還原不到 → 顯示登入表單（新 api 的第一方登入，tripline-web）。
 *   2. 讀授權請求（client 名稱、scope）與目前帳號 → 「以 {名稱} 的身分繼續？」＋一顆「繼續」，權限收在可展開區。
 *   3. 「繼續」→ POST approve → 導向 api 回傳的 redirect_to（server 端存的、驗過的 callback；這裡只再擋掉非 https／loopback）。
 *   「使用其他帳號」→ 登出本機憑證回到登入表單。沒有「拒絕」按鈕（設計稿決定：不是本人要求就直接關閉頁面）。
 *
 * 流程（狀態機、登入、批准）在 hooks/useAuthorizeFlow，這裡只負責呈現；網址參數白名單見 lib/auth/authorizeContract。
 * 只需要 VITE_API_BASE_URL（見 getAuthorizeAuth）。
 */
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ErrorBanner from '../components/shared/ErrorBanner';
import PasswordToggle, { usePasswordVisibility } from '../components/auth/PasswordToggle';
import { useAuthorizeFlow } from '../hooks/useAuthorizeFlow';
import { BIOMETRIC_BUTTON, REAUTH_TITLE, parseBiometricHint, parseReauth } from '../lib/auth/authorizeContract';

const SCOPE_NAMES: Record<string, { name: string; description: string }> = {
  openid: { name: '身分識別', description: '識別您的身分（唯一 ID）' },
  profile: { name: '基本資料', description: '名稱與頭像' },
  email: { name: '電子郵件', description: '您的電子郵件地址' },
  offline_access: { name: '離線存取', description: '保持登入，不必每次重新輸入' },
  'trips:read': { name: '查看行程', description: '讀取您的行程資料' },
  'trips:write': { name: '修改行程', description: '建立／修改您的行程' },
};

const SCOPED_STYLES = `
.tp-authz-shell { min-height: 100dvh; display: flex; flex-direction: column; align-items: center; padding: 32px 20px; background: var(--color-background); color: var(--color-foreground); }
.tp-authz-wrap { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 20px; }
.tp-authz-brand { font-size: var(--font-size-eyebrow); font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-muted); text-align: center; }
.tp-authz-title { font-size: var(--font-size-title2); font-weight: 700; letter-spacing: -0.01em; text-align: center; margin: 0; }
.tp-authz-card { border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-background); padding: 22px 20px; display: flex; flex-direction: column; gap: 16px; }
.tp-authz-field { display: flex; flex-direction: column; gap: 6px; }
.tp-authz-label { font-size: var(--font-size-footnote); font-weight: 600; }
.tp-authz-input { font: inherit; font-size: var(--font-size-callout); padding: 12px 14px; min-height: var(--spacing-tap-min); border-radius: var(--radius-md); border: 1px solid var(--color-border); background: var(--color-background); color: var(--color-foreground); }
.tp-authz-input:focus-visible, .tp-authz-btn:focus-visible, .tp-authz-link:focus-visible, .tp-authz-disc summary:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
.tp-authz-scopes { background: var(--color-accent-subtle); border-radius: var(--radius-md); padding: 14px; margin: 0 12px 12px; display: flex; flex-direction: column; gap: 10px; }
.tp-authz-scope { display: flex; gap: 8px; font-size: var(--font-size-footnote); align-items: flex-start; }
.tp-authz-scope svg { width: 18px; height: 18px; flex-shrink: 0; color: var(--color-accent); margin-top: 1px; }
.tp-authz-btn { font: inherit; font-size: var(--font-size-callout); font-weight: 600; min-height: var(--spacing-tap-min); padding: 12px 20px; border-radius: var(--radius-md); cursor: pointer; border: 1px solid var(--color-accent-fill); background: var(--color-accent-fill); color: var(--color-accent-foreground); }
.tp-authz-btn-out { background: transparent; color: var(--color-accent-text); border-color: var(--color-accent-text); display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; }
.tp-authz-btn-out svg { width: 22px; height: 22px; flex: none; }
.tp-authz-or { display: flex; align-items: center; gap: 12px; color: var(--color-muted); font-size: var(--font-size-footnote); }
.tp-authz-or::before, .tp-authz-or::after { content: ""; flex: 1; height: 1px; background: var(--color-border); }
.tp-authz-btn[disabled] { opacity: 0.6; cursor: default; }
.tp-authz-link { background: none; border: 0; font: inherit; font-size: var(--font-size-footnote); color: var(--color-accent-text); text-decoration: underline; cursor: pointer; padding: 8px; min-height: var(--spacing-tap-min); }
.tp-authz-note { font-size: var(--font-size-footnote); color: var(--color-muted); text-align: center; margin: 0; }
.tp-authz-chip { display: flex; align-items: center; gap: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 12px 14px; }
.tp-authz-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--color-accent-bg); color: var(--color-accent-text-on-tonal); display: grid; place-items: center; font-weight: 700; flex-shrink: 0; }
.tp-authz-chip-main { flex: 1; min-width: 0; }
.tp-authz-chip-main strong { display: block; font-size: var(--font-size-callout); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-authz-chip-main span { font-size: var(--font-size-footnote); color: var(--color-muted); display: block; }
.tp-authz-disc { border: 1px solid var(--color-border); border-radius: var(--radius-md); }
.tp-authz-disc summary { padding: 12px 14px; cursor: pointer; font-size: var(--font-size-footnote); font-weight: 600; min-height: var(--spacing-tap-min); display: flex; align-items: center; }
`;

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
  </svg>
);

const BioIcon = ({ faceId }: { faceId: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {faceId
      ? <><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M9 9.5v1.2M15 9.5v1.2M12 9.5v3.2l-1 .8M9 15.5c1.8 1.4 4.2 1.4 6 0" /></>
      : <path d="M6.5 8.5a6.5 6.5 0 0 1 11 0M5 12.5a7 7 0 0 1 .3-2M9 20c-.6-1.2-1-2.4-1-4a4 4 0 0 1 8 0c0 2 .5 3.4 1.5 4.6M12 16c0 2 .4 3.4 1.2 4.6M19 13c.3 1.6.2 3.4-.4 5" />}
  </svg>
);

export default function OauthAuthorizePage() {
  const [sp] = useSearchParams();
  const requestId = sp.get('request_id') ?? '';
  const hint = parseBiometricHint(sp.get('biometric_hint'));
  const bio = hint ? BIOMETRIC_BUTTON[hint] : null;
  const reauth = parseReauth(sp.get('reauth'));
  const reauthTitle = reauth ? REAUTH_TITLE[reauth] : null;
  const { view, busy, login, approve: onContinue, switchAccount: onSwitchAccount } = useAuthorizeFlow({ requestId, reauth });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const pw = usePasswordVisibility();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [bioMissing, setBioMissing] = useState(false);

  async function doLogin(enableBio: boolean) {
    if (busy) return;
    setBioMissing(false);
    await login(email, password, enableBio, () => setPassword(''));
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    await doLogin(false);
  }

  async function onBioLogin() {
    if (busy) return;
    if (!email.trim() || !password) {
      setBioMissing(true);
      (email.trim() ? passwordRef : emailRef).current?.focus();
      return;
    }
    await doLogin(true);
  }

  const credentialInvalid = view.kind === 'login' && view.credential === true;
  const describedBy = credentialInvalid ? 'authz-login-error' : bioMissing ? 'authz-bio-required' : undefined;
  return (
    <main className="tp-authz-shell" data-testid="oauth-authorize-page">
      <style>{SCOPED_STYLES}</style>
      <div className="tp-authz-wrap">
        <div className="tp-authz-brand">Tripline</div>

        {view.kind === 'init' && <p className="tp-authz-note">載入中…</p>}

        {view.kind === 'error' && <ErrorBanner message={view.message} testId="authz-error" />}

        {view.kind === 'login' && (
          <>
            <h1 className="tp-authz-title">{reauthTitle ?? '登入以繼續使用 Tripline App'}</h1>
            <form className="tp-authz-card" onSubmit={onLogin} data-testid="authz-login-form">
              {view.error && <ErrorBanner message={view.error} testId="authz-login-error" />}
              <label className="tp-authz-field"><span className="tp-authz-label">電子郵件</span>
                <input ref={emailRef} className="tp-authz-input" type="email" autoComplete="username" required value={email}
                  onChange={(e) => setEmail(e.target.value)} data-testid="authz-email"
                  aria-invalid={credentialInvalid || undefined} aria-describedby={describedBy} /></label>
              <label className="tp-authz-field"><span className="tp-authz-label">密碼</span>
                <input ref={passwordRef} className="tp-authz-input" type={pw.type} autoComplete="current-password" required value={password}
                  onChange={(e) => setPassword(e.target.value)} data-testid="authz-password"
                  aria-invalid={credentialInvalid || undefined} aria-describedby={describedBy} /></label>
              <PasswordToggle {...pw.toggleProps} testId="authz-password-toggle" />
              <button className="tp-authz-btn" type="submit" disabled={busy} data-testid="authz-login-submit">登入</button>
              {bio && !reauthTitle && (
                <>
                  <div className="tp-authz-or" aria-hidden="true">或</div>
                  <button className="tp-authz-btn tp-authz-btn-out" type="button" onClick={onBioLogin} disabled={busy} data-testid="authz-bio-login">
                    <BioIcon faceId={bio.faceId} /><span>{bio.text}</span>
                  </button>
                  {bioMissing && <ErrorBanner message="請先輸入電子郵件與密碼，再用此方式登入。" testId="authz-bio-required" />}
                </>
              )}
              <a className="tp-authz-link" href="/login/forgot" style={{ textAlign: 'center' }}>忘記密碼？</a>
            </form>
          </>
        )}

        {view.kind === 'confirm' && (
          <>
            <h1 className="tp-authz-title" data-testid="authz-title">
              以 {view.email.split('@')[0] || '此帳號'} 的身分繼續？
            </h1>
            <div className="tp-authz-card">
              <div className="tp-authz-chip" data-testid="authz-account">
                <div className="tp-authz-avatar" aria-hidden="true">{(view.email[0] ?? '?').toUpperCase()}</div>
                <div className="tp-authz-chip-main">
                  <strong>{view.email}</strong>
                  <span><span data-testid="authz-app-name">{view.request.appName}</span> App 將取得下列權限</span>
                </div>
              </div>
              <details className="tp-authz-disc">
                <summary>查看權限（{view.request.scopes.length}）</summary>
                <div className="tp-authz-scopes" role="group" aria-label="要求以下權限" data-testid="authz-scopes">
                  {view.request.scopes.map((raw) => {
                    const s = raw.slice(0, 64);
                    const d = SCOPE_NAMES[s];
                    return (
                      <div className="tp-authz-scope" key={s}>
                        <CheckIcon />
                        <span><strong>{d?.name ?? s}</strong>{d ? <> — {d.description}</> : null}</span>
                      </div>
                    );
                  })}
                </div>
              </details>
              <button className="tp-authz-btn" type="button" onClick={onContinue} disabled={busy} data-testid="authz-continue">繼續</button>
              <button className="tp-authz-link" type="button" onClick={onSwitchAccount} data-testid="authz-switch-account">使用其他帳號</button>
            </div>
          </>
        )}

        <p className="tp-authz-note">不是您本人要求的？直接關閉此頁即可。</p>
      </div>
    </main>
  );
}
