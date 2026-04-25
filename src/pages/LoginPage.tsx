/**
 * LoginPage — V2-P1 sign-in UI（Google OIDC + 過渡期 CF Access fallback）
 *
 * Primary：「使用 Google 登入」button → redirect /api/oauth/authorize
 *   （後端 V2-P1 next slice 接 Google OIDC client flow）
 * Fallback：CF Access 入口連結（V2 完整上線前 /manage 仍走 CF Access）
 */

const SCOPED_STYLES = `
.tp-login-shell {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 100dvh; padding: 48px 24px; gap: 24px;
  text-align: center;
}
.tp-login-eyebrow {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--color-muted);
}
.tp-login-title {
  font-size: var(--font-size-title2); font-weight: 700;
  letter-spacing: -0.01em; color: var(--color-foreground);
}
.tp-login-actions {
  display: flex; flex-direction: column; gap: 12px;
  width: 100%; max-width: 340px;
}
.tp-login-google {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  font: inherit; font-size: var(--font-size-callout); font-weight: 600;
  padding: 12px 20px; border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-background); color: var(--color-foreground);
  cursor: pointer; min-height: var(--spacing-tap-min);
  transition: border-color 120ms, background-color 120ms;
}
.tp-login-google:hover { border-color: var(--color-accent); background: var(--color-accent-subtle); }
.tp-login-google:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.tp-login-divider {
  display: flex; align-items: center; gap: 12px;
  font-size: var(--font-size-footnote); color: var(--color-muted);
  width: 100%; max-width: 340px;
}
.tp-login-divider::before, .tp-login-divider::after {
  content: ''; flex: 1; height: 1px; background: var(--color-border);
}
.tp-login-cf {
  font-size: var(--font-size-callout); color: var(--color-muted);
  text-decoration: underline; text-underline-offset: 4px;
  padding: 8px 16px; border-radius: var(--radius-sm);
  min-height: var(--spacing-tap-min); display: inline-flex; align-items: center; justify-content: center;
}
.tp-login-cf:hover { color: var(--color-accent); }
.tp-login-note {
  font-size: var(--font-size-footnote); color: var(--color-muted);
  max-width: 340px;
}
`;

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M16.51 8.18c0-.55-.05-1.08-.14-1.59H9v3.01h4.21c-.18.97-.74 1.79-1.57 2.34v1.94h2.54c1.49-1.37 2.34-3.39 2.34-5.7z" />
      <path fill="#34A853" d="M9 16c2.13 0 3.92-.71 5.22-1.91l-2.54-1.94c-.71.48-1.61.76-2.68.76-2.06 0-3.81-1.39-4.43-3.26H2v2.01C3.3 14.06 5.96 16 9 16z" />
      <path fill="#FBBC04" d="M4.57 9.65c-.16-.48-.25-.99-.25-1.5s.09-1.02.25-1.5V4.64H2C1.36 5.79 1 7.13 1 8.55s.36 2.76 1 3.91l2.57-1.81z" />
      <path fill="#EA4335" d="M9 4.18c1.16 0 2.2.4 3.02 1.18l2.26-2.26C12.92 1.83 11.13 1 9 1 5.96 1 3.3 2.94 2 4.64l2.57 2.01C5.19 5.57 6.94 4.18 9 4.18z" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <main className="tp-login-shell" data-testid="login-page">
      <style>{SCOPED_STYLES}</style>
      <div className="tp-login-eyebrow">Welcome · Tripline</div>
      <h1 className="tp-login-title">登入您的帳號</h1>
      <div className="tp-login-actions">
        <a
          className="tp-login-google"
          href="/api/oauth/authorize?provider=google"
          data-testid="login-google"
        >
          <GoogleLogo />
          <span>使用 Google 登入</span>
        </a>
      </div>
      <div className="tp-login-divider">過渡期</div>
      <a className="tp-login-cf" href="/manage" data-testid="login-cf-access">
        改用 Cloudflare Access 登入
      </a>
      <p className="tp-login-note">
        V2 OAuth 還在 staged rollout — 若 Google 登入無法使用，請改走 Cloudflare Access。
      </p>
    </main>
  );
}
