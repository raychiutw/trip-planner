/**
 * ForgotPasswordPage — V2-P3 password reset request
 *
 * Route: /login/forgot
 * Form: email → POST /api/oauth/forgot-password
 *
 * Anti-enumeration: API 永遠回 generic 200，不分 email 存在/不存在。
 * 此頁也跟 API 對齊：成功狀態說「若帳號存在，重設連結已寄出」。
 *
 * Rate limit (V2-P6): 429 FORGOT_PASSWORD_RATE_LIMITED → 顯示 retry-after。
 */
import { useState } from 'react';

const SCOPED_STYLES = `
.tp-auth-shell {
  display: flex; align-items: center; justify-content: center;
  min-height: 100dvh; padding: 48px 24px;
  background:
    radial-gradient(circle at 20% 0%, rgba(0, 119, 182, 0.06), transparent 50%),
    var(--color-secondary);
}
.tp-auth-card {
  width: 100%; max-width: 440px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 40px 36px;
  box-shadow: var(--shadow-md);
}
.tp-auth-brand {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  margin-bottom: 28px;
  font-size: 18px; font-weight: 800; letter-spacing: -0.02em;
}
.tp-auth-brand-dot { color: var(--color-accent); }
.tp-auth-headline { text-align: center; margin-bottom: 28px; }
.tp-auth-headline h1 {
  font-size: var(--font-size-title2); font-weight: 800;
  letter-spacing: -0.01em; margin: 0 0 6px;
}
.tp-auth-headline p {
  color: var(--color-muted); font-size: var(--font-size-subheadline);
  margin: 0; line-height: 1.5;
}

.tp-form { display: flex; flex-direction: column; gap: 16px; }
.tp-form-row { display: flex; flex-direction: column; gap: 6px; }
.tp-form-row label {
  font-size: var(--font-size-footnote); font-weight: 600;
}
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
  padding: 12px 20px;
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--font-size-callout); font-weight: 600;
  border: none; cursor: pointer; min-height: 48px;
  transition: background 120ms;
}
.tp-btn-primary { background: var(--color-accent); color: #fff; width: 100%; }
.tp-btn-primary:hover:not(:disabled) { filter: brightness(0.92); }
.tp-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.tp-banner {
  display: flex; gap: 12px; padding: 14px 16px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-subheadline); line-height: 1.5;
  margin-bottom: 16px;
}
.tp-banner-success { background: var(--color-success-bg); color: var(--color-success); }
.tp-banner-warning { background: var(--color-warning-bg); color: var(--color-warning); }
.tp-banner-error { background: var(--color-destructive-bg); color: var(--color-destructive); }

.tp-success-icon-circle {
  width: 64px; height: 64px;
  border-radius: var(--radius-full);
  background: var(--color-success-bg); color: var(--color-success);
  display: grid; place-items: center;
  margin: 0 auto 16px;
}
.tp-success-icon-circle svg { width: 32px; height: 32px; }

.tp-auth-footer {
  text-align: center; margin-top: 24px;
  font-size: var(--font-size-footnote); color: var(--color-muted);
}
.tp-auth-footer a {
  color: var(--color-accent);
  font-weight: 600; text-decoration: none;
}
.tp-auth-footer a:hover { text-decoration: underline; }
`;

interface ApiError {
  error: { code: string; message: string };
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setWarning(null);
    try {
      const res = await fetch('/api/oauth/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        setSubmitted(true);
        return;
      }
      const errJson = (await res.json().catch(() => null)) as ApiError | null;
      const code = errJson?.error?.code ?? 'UNKNOWN';
      if (code === 'FORGOT_PASSWORD_RATE_LIMITED') {
        const retryAfter = res.headers.get('Retry-After');
        setWarning(`重設請求過多。請 ${retryAfter ?? '幾分鐘'} 秒後再試。`);
      } else {
        setWarning('暫時無法處理，請稍後再試。');
      }
    } catch {
      setWarning('網路連線失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="tp-auth-shell" data-testid="forgot-password-page">
      <style>{SCOPED_STYLES}</style>
      <div className="tp-auth-card">
        <div className="tp-auth-brand">
          <span className="tp-auth-brand-dot" aria-hidden="true">●</span>
          <span>Tripline</span>
        </div>

        {submitted ? (
          <>
            <div className="tp-success-icon-circle" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="tp-auth-headline">
              <h1>查看你的信箱</h1>
              <p>若 <strong>{email.trim()}</strong> 已註冊，重設連結已寄出。<br />連結 1 小時內有效。</p>
            </div>
            <div className="tp-auth-footer">
              <a href="/login">回登入</a>
            </div>
          </>
        ) : (
          <>
            <div className="tp-auth-headline">
              <h1>忘記密碼</h1>
              <p>輸入您註冊的 email，我們會寄重設連結給您。</p>
            </div>

            {warning && (
              <div className="tp-banner tp-banner-warning" role="alert" data-testid="forgot-banner-warning">
                {warning}
              </div>
            )}

            <form className="tp-form" onSubmit={handleSubmit} noValidate>
              <div className="tp-form-row">
                <label htmlFor="forgot-email">Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="forgot-email"
                />
              </div>
              <button
                type="submit"
                className="tp-btn tp-btn-primary"
                disabled={submitting}
                data-testid="forgot-submit"
              >
                {submitting ? '寄送中…' : '寄送重設連結'}
              </button>
            </form>

            <div className="tp-auth-footer">
              想起密碼了？<a href="/login">回登入</a>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
