/**
 * SignupPage — V2-P2 local password account creation
 *
 * Form fields: email + password + displayName (optional)
 * → POST /api/oauth/signup
 * → on success: POST /api/oauth/send-verification (best-effort)
 * → navigate /signup/check-email?email=...
 *
 * Error handling:
 *   - SIGNUP_INVALID_EMAIL / SIGNUP_INVALID_PASSWORD → inline field error
 *   - SIGNUP_EMAIL_TAKEN → suggest /login or /forgot-password
 *   - SIGNUP_RATE_LIMITED → 429 banner with retry-after countdown
 *   - Network failure → generic banner
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthBrandHero, { AUTH_LAYOUT_STYLES } from '../components/auth/AuthBrandHero';
import InlineError from '../components/shared/InlineError';

const SCOPED_STYLES = `
.tp-auth-shell {
  display: flex; align-items: center; justify-content: center;
  min-height: 100dvh; padding: 48px 24px;
  background:
    radial-gradient(circle at 20% 0%, rgba(217, 120, 72, 0.06), transparent 50%),
    radial-gradient(circle at 80% 100%, rgba(217, 120, 72, 0.04), transparent 50%),
    var(--color-secondary);
}
${AUTH_LAYOUT_STYLES}
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
  color: var(--color-muted);
  font-size: var(--font-size-subheadline);
  margin: 0;
}

.tp-form { display: flex; flex-direction: column; gap: 16px; }
.tp-form-row { display: flex; flex-direction: column; gap: 6px; }
.tp-form-row label {
  font-size: var(--font-size-footnote); font-weight: 600;
  display: flex; justify-content: space-between; align-items: baseline;
}
.tp-form-row .tp-hint { font-size: var(--font-size-caption2); color: var(--color-muted); font-weight: 500; }
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
.tp-form-row .tp-error {
  font-size: 12px; color: var(--color-destructive);
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
  font-size: var(--font-size-subheadline);
  line-height: 1.5;
  margin-bottom: 16px;
}
.tp-banner-error { background: var(--color-destructive-bg); color: var(--color-destructive); }
.tp-banner-warning { background: var(--color-warning-bg); color: var(--color-warning); }
.tp-banner a { color: inherit; text-decoration: underline; font-weight: 600; }

.tp-auth-footer {
  text-align: center; margin-top: 24px;
  font-size: var(--font-size-footnote); color: var(--color-muted);
}
.tp-auth-footer a {
  color: var(--color-accent);
  font-weight: 600;
  text-decoration: none;
}
.tp-auth-footer a:hover { text-decoration: underline; }
`;

interface ApiError {
  error: { code: string; message: string };
}

interface SignupOk {
  ok: true;
  userId: string;
  email: string;
  requiresVerification: boolean;
}

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: 'error' | 'warning'; node: React.ReactNode } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setPasswordError(null);
    setBanner(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/oauth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim() || undefined,
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as SignupOk;
        // Best-effort send-verification (don't block on failure)
        try {
          await fetch('/api/oauth/send-verification', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: json.email }),
          });
        } catch {
          /* ignore */
        }
        navigate(`/signup/check-email?email=${encodeURIComponent(json.email)}`);
        return;
      }

      const errJson = (await res.json().catch(() => null)) as ApiError | null;
      const code = errJson?.error?.code ?? 'UNKNOWN';
      switch (code) {
        case 'SIGNUP_INVALID_EMAIL':
          setEmailError('Email 格式無效');
          break;
        case 'SIGNUP_INVALID_PASSWORD':
          setPasswordError('密碼至少 8 字元');
          break;
        case 'SIGNUP_EMAIL_TAKEN':
          setBanner({
            kind: 'error',
            node: (
              <span>
                此 email 已註冊。<a href="/login">改用登入</a> 或{' '}
                <a href="/login/forgot">忘記密碼</a>。
              </span>
            ),
          });
          break;
        case 'SIGNUP_RATE_LIMITED': {
          const retryAfter = res.headers.get('Retry-After');
          setBanner({
            kind: 'warning',
            node: <span>註冊請求過多。請 {retryAfter ?? '幾分鐘'} 秒後再試。</span>,
          });
          break;
        }
        default:
          setBanner({ kind: 'error', node: <span>註冊失敗，請稍後再試。</span> });
      }
    } catch {
      setBanner({ kind: 'error', node: <span>網路連線失敗，請檢查後再試。</span> });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="tp-auth-shell" data-testid="signup-page">
      <style>{SCOPED_STYLES}</style>
      <div className="tp-auth-form-side">
        <div className="tp-auth-card">
        <div className="tp-auth-brand">
          <span className="tp-auth-brand-dot" aria-hidden="true">●</span>
          <span>Tripline</span>
        </div>
        <div className="tp-auth-headline">
          <h1>建立帳號</h1>
          <p>用 email + 密碼註冊，開始規劃你的旅行</p>
        </div>

        {banner && (
          <div
            className={`tp-banner tp-banner-${banner.kind}`}
            role="alert"
            data-testid={`signup-banner-${banner.kind}`}
          >
            <div>{banner.node}</div>
          </div>
        )}

        <form className="tp-form" onSubmit={handleSubmit} noValidate>
          <div className="tp-form-row">
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="signup-email"
            />
            {emailError && <InlineError message={emailError} testId="signup-email-error" />}
          </div>

          <div className="tp-form-row">
            <label htmlFor="signup-password">密碼</label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              placeholder="至少 8 字元"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="signup-password"
            />
            {passwordError && <InlineError message={passwordError} testId="signup-password-error" />}
          </div>

          <div className="tp-form-row">
            <label htmlFor="signup-display-name">
              名稱 <span className="tp-hint">選填</span>
            </label>
            <input
              id="signup-display-name"
              type="text"
              autoComplete="name"
              maxLength={80}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              data-testid="signup-display-name"
            />
          </div>

          <button
            type="submit"
            className="tp-btn tp-btn-primary"
            disabled={submitting}
            data-testid="signup-submit"
          >
            {submitting ? '建立中…' : '建立帳號'}
          </button>
        </form>

        <div className="tp-auth-footer">
          已有帳號？<a href="/login">直接登入</a>
        </div>
        </div>
      </div>

      <AuthBrandHero
        eyebrow="Why Tripline"
        headline={<>把每次旅程<br />留在身邊。</>}
        sub="註冊後可同步行程到所有裝置、邀請旅伴共編、儲存喜歡的 POI 一鍵加入下次 trip。"
        items={[
          {
            icon: (
              <>
                <path d="M21 12a9 9 0 0 1-9 9M3 12a9 9 0 0 1 9-9M21 12h-4M7 12H3M12 21v-4M12 7V3" />
                <circle cx="12" cy="12" r="4" />
              </>
            ),
            title: '跨裝置同步',
            desc: '手機看到的就是平板看到的，離線也能用。',
          },
          {
            icon: (
              <>
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </>
            ),
            title: '邀請旅伴共編',
            desc: '用一個 link 把家人朋友拉進行程，不用 LINE 截圖。',
          },
          {
            icon: <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />,
            title: '儲存池跟著你',
            desc: '看到喜歡的餐廳/景點按 ♡ 儲存，下次規劃直接拉進 trip。',
          },
        ]}
        footnote="© 2026 Tripline · 由旅人為旅人打造"
      />
    </main>
  );
}
