/**
 * LoginPage — V2 sign-in UI（local password + Google OIDC + CF Access fallback）
 *
 * Flow:
 *   - Primary: email + password form → POST /api/oauth/login → navigate redirect_after
 *   - Alt: 「使用 Google 登入」→ /api/oauth/login/google
 *   - Fallback: CF Access link
 *
 * Query params handled:
 *   ?verified=1 → "Email 驗證成功" toast
 *   ?verify_error=expired → 警示 banner
 *   ?redirect_after=/path → 成功登入後 navigate 此 path（已 sanitize 內部 path only）
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ErrorBanner from '../components/shared/ErrorBanner';

const SCOPED_STYLES = `
.tp-login-shell {
  min-height: 100dvh;
  background:
    radial-gradient(circle at 20% 0%, rgba(217, 120, 72, 0.06), transparent 50%),
    radial-gradient(circle at 80% 100%, rgba(217, 120, 72, 0.04), transparent 50%),
    var(--color-secondary);
  /* mobile fallback: single-column centered */
  display: flex; align-items: center; justify-content: center;
  padding: 48px 24px;
}
.tp-login-form-side {
  width: 100%;
  display: flex; align-items: center; justify-content: center;
}
.tp-login-card {
  width: 100%; max-width: 440px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 40px 36px;
  box-shadow: var(--shadow-md);
}

/* Desktop ≥1024px: split-screen (form left + brand hero right) */
@media (min-width: 1024px) {
  .tp-login-shell {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: stretch;
    padding: 0;
  }
  .tp-login-form-side {
    padding: 48px;
  }
}

.tp-login-brand-hero {
  display: none;
  background: linear-gradient(135deg, var(--color-foreground) 0%, var(--color-accent-deep, #B85C2E) 100%);
  color: var(--color-background);
  padding: 56px 48px;
  position: relative;
  overflow: hidden;
  flex-direction: column;
  justify-content: space-between;
}
@media (min-width: 1024px) {
  .tp-login-brand-hero { display: flex; }
}
.tp-login-brand-hero::before {
  content: '';
  position: absolute;
  top: -100px; right: -100px;
  width: 400px; height: 400px;
  border-radius: 50%;
  background: rgba(247, 223, 203, 0.1);
  pointer-events: none;
}
.tp-login-brand-hero::after {
  content: '';
  position: absolute;
  bottom: -80px; left: -80px;
  width: 300px; height: 300px;
  border-radius: 50%;
  background: rgba(217, 120, 72, 0.18);
  pointer-events: none;
}
.tp-bs-eyebrow {
  font-size: var(--font-size-eyebrow);
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  opacity: 0.7;
  position: relative; z-index: 2;
}
.tp-bs-display {
  font-size: 42px; font-weight: 900;
  letter-spacing: -0.03em; line-height: 1.05;
  margin: 16px 0 24px;
  position: relative; z-index: 2;
  max-width: 380px;
}
.tp-bs-features {
  display: flex; flex-direction: column;
  gap: 18px;
  position: relative; z-index: 2;
}
.tp-bs-feature {
  display: flex; gap: 14px;
  align-items: flex-start;
}
.tp-bs-feature .tp-feat-icon {
  width: 36px; height: 36px;
  border-radius: 8px;
  background: rgba(255, 251, 245, 0.12);
  display: grid; place-items: center;
  flex-shrink: 0;
  color: var(--color-background);
}
.tp-bs-feature .tp-feat-icon svg {
  width: 18px; height: 18px;
  stroke: currentColor; fill: none;
  stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
}
.tp-bs-feature .tp-feat-body { padding-top: 4px; }
.tp-bs-feature .tp-feat-title {
  font-size: 15px; font-weight: 700;
  letter-spacing: -0.005em;
}
.tp-bs-feature .tp-feat-desc {
  font-size: 13px; opacity: 0.78;
  margin-top: 2px; line-height: 1.5;
}
.tp-bs-footnote {
  font-size: var(--font-size-caption2);
  opacity: 0.6;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 600;
  position: relative; z-index: 2;
}
.tp-login-brand {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  margin-bottom: 28px;
  font-size: 18px; font-weight: 800; letter-spacing: -0.02em;
}
.tp-login-brand-dot { color: var(--color-accent); }
.tp-login-headline { text-align: center; margin-bottom: 24px; }
.tp-login-headline h1 {
  font-size: var(--font-size-title2); font-weight: 800;
  letter-spacing: -0.01em; margin: 0 0 6px;
}
.tp-login-headline p {
  color: var(--color-muted); font-size: var(--font-size-subheadline);
  margin: 0;
}

.tp-form { display: flex; flex-direction: column; gap: 16px; }
.tp-form-row { display: flex; flex-direction: column; gap: 6px; }
.tp-form-row label {
  font-size: var(--font-size-footnote); font-weight: 600;
  display: flex; justify-content: space-between; align-items: baseline;
}
.tp-form-row .tp-hint-link {
  color: var(--color-accent);
  font-weight: 600; font-size: var(--font-size-caption);
  text-decoration: none;
}
.tp-form-row .tp-hint-link:hover { text-decoration: underline; }
.tp-form-row input {
  font-family: inherit; font-size: var(--font-size-callout);
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  min-height: 48px;
}
.tp-form-row input:focus {
  outline: 2px solid var(--color-accent); outline-offset: -2px;
  border-color: var(--color-accent);
}

.tp-btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 12px;
  padding: 12px 20px;
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--font-size-callout); font-weight: 600;
  cursor: pointer; min-height: 48px;
  transition: background 120ms;
  text-decoration: none;
  width: 100%;
}
.tp-btn-primary {
  background: var(--color-accent); color: #fff; border: none;
}
.tp-btn-primary:hover:not(:disabled) { filter: brightness(0.92); }
.tp-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.tp-btn-secondary {
  background: var(--color-background); color: var(--color-foreground);
  border: 1px solid var(--color-border);
}
.tp-btn-secondary:hover { background: var(--color-hover); }

.tp-divider {
  display: flex; align-items: center; gap: 12px;
  margin: 20px 0;
  color: var(--color-muted); font-size: var(--font-size-caption);
  font-weight: 500;
}
.tp-divider::before, .tp-divider::after {
  content: ''; flex: 1; height: 1px;
  background: var(--color-border);
}

.tp-banner {
  display: flex; gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-subheadline); line-height: 1.5;
  margin-bottom: 16px;
}
.tp-banner-success { background: var(--color-success-bg); color: var(--color-success); }
.tp-banner-error { background: var(--color-destructive-bg); color: var(--color-destructive); }
.tp-banner-warning { background: var(--color-warning-bg); color: var(--color-warning); }
.tp-banner-info { background: var(--color-accent-subtle); color: var(--color-accent); }
.tp-banner a { color: inherit; text-decoration: underline; font-weight: 600; }

.tp-login-footer {
  text-align: center; margin-top: 24px;
  font-size: var(--font-size-footnote); color: var(--color-muted);
}
.tp-login-footer a {
  color: var(--color-accent);
  font-weight: 600; text-decoration: none;
}
.tp-login-footer a:hover { text-decoration: underline; }
`;

interface ApiError {
  error: { code: string; message: string };
}

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

function sanitizeRedirectAfter(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

const RATE_LIMIT_WARN_THRESHOLD = 4;

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const verified = params.get('verified') === '1';
  const verifyError = params.get('verify_error');
  const redirectAfter = sanitizeRedirectAfter(params.get('redirect_after'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [lockedRetryAfter, setLockedRetryAfter] = useState<number | null>(null);
  const [failureCount, setFailureCount] = useState(0);
  // Whether the deployment has Google OIDC env configured. We optimistically
  // assume "no" so the button doesn't flash on slow networks; the probe flips
  // it on if /api/public-config confirms.
  const [googleAvailable, setGoogleAvailable] = useState(false);

  // Read failure count from sessionStorage to show defensive UX warning
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('tp_login_fail_count');
      if (stored) setFailureCount(parseInt(stored, 10) || 0);
    } catch {
      /* ignore */
    }
  }, []);

  // Probe public-config to know which providers are enabled. Side-effect-free.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/public-config')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cancelled || !cfg) return;
        const providers = (cfg as { providers?: { google?: boolean } }).providers;
        if (providers?.google) setGoogleAvailable(true);
      })
      .catch(() => {
        // Network error — leave Google hidden. Email/password still works.
      });
    return () => { cancelled = true; };
  }, []);

  function bumpFailure() {
    const next = failureCount + 1;
    setFailureCount(next);
    try { sessionStorage.setItem('tp_login_fail_count', String(next)); } catch { /* ignore */ }
  }

  function clearFailure() {
    setFailureCount(0);
    try { sessionStorage.removeItem('tp_login_fail_count'); } catch { /* ignore */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBannerError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/oauth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (res.ok) {
        clearFailure();
        navigate(redirectAfter ?? '/trips');
        return;
      }

      const errJson = (await res.json().catch(() => null)) as ApiError | null;
      const code = errJson?.error?.code ?? 'UNKNOWN';
      switch (code) {
        case 'LOGIN_INVALID_INPUT':
          setBannerError('請輸入 email 與密碼');
          break;
        case 'LOGIN_INVALID':
          bumpFailure();
          setBannerError('email 或密碼錯誤');
          break;
        case 'LOGIN_RATE_LIMITED': {
          const retryAfter = res.headers.get('Retry-After');
          setLockedRetryAfter(retryAfter ? Number(retryAfter) : 1800);
          break;
        }
        default:
          setBannerError('登入失敗，請稍後再試');
      }
    } catch {
      setBannerError('網路連線失敗，請檢查後再試');
    } finally {
      setSubmitting(false);
    }
  }

  // Lockout countdown
  useEffect(() => {
    if (lockedRetryAfter === null) return;
    const id = setInterval(() => {
      setLockedRetryAfter((s) => {
        if (s === null) return null;
        if (s <= 1) {
          clearInterval(id);
          return null;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [lockedRetryAfter !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lockout view — single-column (no brand hero, full-bleed alarming UX)
  if (lockedRetryAfter !== null) {
    const minutes = Math.floor(lockedRetryAfter / 60);
    const seconds = lockedRetryAfter % 60;
    const countdown = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return (
      <main
        className="tp-login-shell"
        style={{ display: 'flex', gridTemplateColumns: 'unset', padding: '48px 24px' }}
        data-testid="login-page-locked"
      >
        <style>{SCOPED_STYLES}</style>
        <div className="tp-login-card" style={{ textAlign: 'center' }}>
          <div className="tp-login-brand">
            <span className="tp-login-brand-dot" aria-hidden="true">●</span>
            <span>Tripline</span>
          </div>
          <div
            style={{
              width: 72, height: 72, margin: '0 auto 16px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-destructive-bg)',
              color: 'var(--color-destructive)',
              display: 'grid', placeItems: 'center',
            }}
            aria-hidden="true"
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="tp-login-headline" style={{ margin: '0 0 8px' }}>登入嘗試太多次</h1>
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-subheadline)', margin: '0 0 16px' }}>
            為了保護帳號安全，我們暫時鎖定了登入功能。
          </p>
          <div
            data-testid="login-locked-countdown"
            style={{
              fontFamily: "'SF Mono', ui-monospace, monospace",
              fontSize: 36, fontWeight: 800,
              color: 'var(--color-accent)',
              margin: '20px 0',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {countdown}
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '0 0 20px' }}>
            倒數結束後即可再試。如果不是本人操作，建議立即重設密碼。
          </p>
          <a href="/login/forgot" className="tp-btn tp-btn-primary" data-testid="login-locked-reset">
            重設密碼
          </a>
        </div>
      </main>
    );
  }

  const showFailWarning = failureCount >= RATE_LIMIT_WARN_THRESHOLD;

  return (
    <main className="tp-login-shell" data-testid="login-page">
      <style>{SCOPED_STYLES}</style>
      <div className="tp-login-form-side">
        <div className="tp-login-card">
        <div className="tp-login-brand">
          <span className="tp-login-brand-dot" aria-hidden="true">●</span>
          <span>Tripline</span>
        </div>
        <div className="tp-login-headline">
          <h1>登入</h1>
          <p>歡迎回來</p>
        </div>

        {verified && (
          <div className="tp-banner tp-banner-success" data-testid="login-banner-verified">
            Email 驗證成功！請登入。
          </div>
        )}

        {verifyError && (
          <div className="tp-banner tp-banner-warning" data-testid="login-banner-verify-error">
            {verifyError === 'expired' && '驗證連結已過期，請重新申請或註冊。'}
            {verifyError === 'used' && '此驗證連結已使用過。'}
            {verifyError === 'missing_token' && '驗證連結無效。'}
            {!['expired', 'used', 'missing_token'].includes(verifyError) && '驗證失敗，請重新申請。'}
          </div>
        )}

        {showFailWarning && (
          <div className="tp-banner tp-banner-warning" role="alert" data-testid="login-banner-fail-warn">
            已連續輸入錯誤多次，再失敗將鎖定 30 分鐘。
            <strong> 忘記密碼？</strong>
            <a href="/login/forgot">重設密碼</a>。
          </div>
        )}

        {bannerError && <ErrorBanner message={bannerError} testId="login-banner-error" />}

        <form className="tp-form" onSubmit={handleSubmit} noValidate>
          <div className="tp-form-row">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="login-email"
            />
          </div>
          <div className="tp-form-row">
            <label htmlFor="login-password">
              密碼
              <a href="/login/forgot" className="tp-hint-link" data-testid="login-forgot-link">忘記密碼？</a>
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="login-password"
            />
          </div>

          <button
            type="submit"
            className="tp-btn tp-btn-primary"
            disabled={submitting}
            data-testid="login-submit"
          >
            {submitting ? '登入中…' : '登入'}
          </button>
        </form>

        {googleAvailable && (
          <>
            <div className="tp-divider">或</div>
            <a
              className="tp-btn tp-btn-secondary"
              href={`/api/oauth/login/google${redirectAfter ? `?redirect_after_login=${encodeURIComponent(redirectAfter)}` : ''}`}
              data-testid="login-google"
            >
              <GoogleLogo />
              <span>使用 Google 登入</span>
            </a>
          </>
        )}

        <div className="tp-login-footer">
          沒有帳號？<a href="/signup" data-testid="login-signup-link">建立帳號</a>
        </div>
        </div>
      </div>

      <aside className="tp-login-brand-hero" data-testid="login-brand-hero" aria-hidden="true">
        <div className="tp-bs-eyebrow">Why sign in</div>
        <div>
          <h2 className="tp-bs-display">把每次旅程<br />留在身邊。</h2>
          <div className="tp-bs-features">
            <div className="tp-bs-feature">
              <div className="tp-feat-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M21 12a9 9 0 0 1-9 9M3 12a9 9 0 0 1 9-9M21 12h-4M7 12H3M12 21v-4M12 7V3" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
              </div>
              <div className="tp-feat-body">
                <div className="tp-feat-title">跨裝置同步</div>
                <div className="tp-feat-desc">手機看到的就是平板看到的，離線也能用。</div>
              </div>
            </div>
            <div className="tp-bs-feature">
              <div className="tp-feat-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="tp-feat-body">
                <div className="tp-feat-title">邀請旅伴共編</div>
                <div className="tp-feat-desc">用一個 link 把家人朋友拉進行程，不用 LINE 截圖。</div>
              </div>
            </div>
            <div className="tp-bs-feature">
              <div className="tp-feat-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="tp-feat-body">
                <div className="tp-feat-title">儲存池跟著你</div>
                <div className="tp-feat-desc">看到喜歡的餐廳/景點按 ♡ 儲存，下次規劃直接拉進 trip。</div>
              </div>
            </div>
            <div className="tp-bs-feature">
              <div className="tp-feat-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  <circle cx="9" cy="10" r="1" />
                  <circle cx="15" cy="10" r="1" />
                </svg>
              </div>
              <div className="tp-feat-body">
                <div className="tp-feat-title">AI 對話記住你</div>
                <div className="tp-feat-desc">告訴 Tripline 你喜歡什麼，下次規劃自動套你的偏好。</div>
              </div>
            </div>
          </div>
        </div>

        <div className="tp-bs-footnote">© 2026 Tripline · 由旅人為旅人打造</div>
      </aside>
    </main>
  );
}
