/**
 * ResetPasswordPage — V2-P3 password reset complete
 *
 * Route: /auth/password/reset?token=...
 * Form: new password + confirm + strength feedback
 * → POST /api/oauth/reset-password { token, password }
 *
 * States:
 *   - token missing → redirect-error UI
 *   - submitting form
 *   - success: '密碼已更新' + 提示「為了安全，所有裝置已登出」
 *   - token invalid/expired (RESET_TOKEN_INVALID): error UI + 重新申請連結
 *   - bad password (RESET_INVALID_PASSWORD): inline field error
 */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AuthBrandHero, { AUTH_LAYOUT_STYLES } from '../components/auth/AuthBrandHero';
import InlineError from '../components/shared/InlineError';

const SCOPED_STYLES = `
.tp-auth-shell {
  display: flex; align-items: center; justify-content: center;
  min-height: 100dvh; padding: 48px 24px;
  background:
    radial-gradient(circle at 20% 0%, rgba(217, 120, 72, 0.06), transparent 50%),
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
  color: var(--color-muted); font-size: var(--font-size-subheadline);
  margin: 0;
}

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
  font-size: var(--font-size-caption);
  color: var(--color-destructive);
}

.tp-pw-strength {
  display: flex; flex-direction: column; gap: 8px; margin-top: 4px;
}
.tp-pw-bars {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;
}
.tp-pw-bar {
  height: 4px; border-radius: 2px;
  background: var(--color-tertiary);
}
.tp-pw-bar-weak { background: var(--color-destructive); }
.tp-pw-bar-medium { background: var(--color-warning); }
.tp-pw-bar-strong { background: var(--color-success); }

.tp-pw-checks {
  display: flex; flex-direction: column; gap: 4px;
  font-size: var(--font-size-caption);
}
.tp-pw-check {
  display: flex; align-items: center; gap: 6px;
  color: var(--color-muted);
}
.tp-pw-check-ok { color: var(--color-success); }
.tp-pw-check svg { width: 14px; height: 14px; }

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
.tp-banner-info { background: var(--color-accent-subtle); color: var(--color-accent); }
.tp-banner-error { background: var(--color-destructive-bg); color: var(--color-destructive); }

.tp-result-icon {
  width: 64px; height: 64px;
  border-radius: var(--radius-full);
  display: grid; place-items: center;
  margin: 0 auto 16px;
}
.tp-result-icon svg { width: 32px; height: 32px; }
.tp-result-icon-success { background: var(--color-success-bg); color: var(--color-success); }
.tp-result-icon-error { background: var(--color-destructive-bg); color: var(--color-destructive); }

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

interface PasswordChecks {
  lengthOk: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
}

function checkPassword(pw: string): PasswordChecks {
  return {
    lengthOk: pw.length >= 8,
    hasLetter: /[A-Za-z]/.test(pw),
    hasNumber: /\d/.test(pw),
  };
}

function strengthLevel(checks: PasswordChecks): 0 | 1 | 2 | 3 | 4 {
  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (checks.lengthOk) score = (score + 1) as typeof score;
  if (checks.hasLetter) score = (score + 1) as typeof score;
  if (checks.hasNumber) score = (score + 1) as typeof score;
  if (checks.lengthOk && checks.hasLetter && checks.hasNumber) {
    score = 4;
  }
  return score;
}

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const checks = useMemo(() => checkPassword(password), [password]);
  const strength = useMemo(() => strengthLevel(checks), [checks]);
  const passwordsMatch = password.length > 0 && password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setBannerError(null);

    if (!checks.lengthOk) {
      setPwError('密碼至少 8 字元');
      return;
    }
    if (!passwordsMatch) {
      setPwError('兩次輸入的密碼不一致');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/oauth/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) {
        setSuccess(true);
        return;
      }
      const errJson = (await res.json().catch(() => null)) as ApiError | null;
      const code = errJson?.error?.code ?? 'UNKNOWN';
      switch (code) {
        case 'RESET_TOKEN_INVALID':
        case 'RESET_TOKEN_MISSING':
          setTokenInvalid(true);
          break;
        case 'RESET_INVALID_PASSWORD':
          setPwError('密碼格式不符（至少 8 字元）');
          break;
        default:
          setBannerError('暫時無法處理，請稍後再試。');
      }
    } catch {
      setBannerError('網路連線失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  // Token missing in URL → render error directly
  if (!token || tokenInvalid) {
    return (
      <main
        className="tp-auth-shell"
        style={{ display: 'flex', gridTemplateColumns: 'unset', padding: '48px 24px' }}
        data-testid="reset-password-page"
      >
        <style>{SCOPED_STYLES}</style>
        <div className="tp-auth-card">
          <div className="tp-auth-brand">
            <span className="tp-auth-brand-dot" aria-hidden="true">●</span>
            <span>Tripline</span>
          </div>
          <div className="tp-result-icon tp-result-icon-error" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className="tp-auth-headline">
            <h1>這個連結無法使用了</h1>
            <p>重設連結已失效或已被使用過。為了安全，連結只在 1 小時內有效，且只能使用一次。</p>
          </div>
          <a href="/login/forgot" className="tp-btn tp-btn-primary" data-testid="reset-retry">重新申請重設密碼</a>
          <div className="tp-auth-footer">
            想起密碼了？<a href="/login">回登入</a>
          </div>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main
        className="tp-auth-shell"
        style={{ display: 'flex', gridTemplateColumns: 'unset', padding: '48px 24px' }}
        data-testid="reset-password-page"
      >
        <style>{SCOPED_STYLES}</style>
        <div className="tp-auth-card">
          <div className="tp-auth-brand">
            <span className="tp-auth-brand-dot" aria-hidden="true">●</span>
            <span>Tripline</span>
          </div>
          <div className="tp-result-icon tp-result-icon-success" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="tp-auth-headline">
            <h1>密碼已更新</h1>
            <p>為了安全，您所有裝置上的登入已自動登出。</p>
          </div>
          <a href="/login" className="tp-btn tp-btn-primary" data-testid="reset-go-login">前往登入</a>
        </div>
      </main>
    );
  }

  return (
    <main className="tp-auth-shell" data-testid="reset-password-page">
      <style>{SCOPED_STYLES}</style>
      <div className="tp-auth-form-side">
        <div className="tp-auth-card">
        <div className="tp-auth-brand">
          <span className="tp-auth-brand-dot" aria-hidden="true">●</span>
          <span>Tripline</span>
        </div>
        <div className="tp-auth-headline">
          <h1>設定新密碼</h1>
          <p>建立一組新密碼，至少 8 字元，包含字母與數字。</p>
        </div>

        {bannerError && (
          <div className="tp-banner tp-banner-error" role="alert" data-testid="reset-banner-error">
            {bannerError}
          </div>
        )}

        <form className="tp-form" onSubmit={handleSubmit} noValidate>
          <div className="tp-form-row">
            <label htmlFor="reset-password">
              新密碼 <span className="tp-hint">至少 8 字元</span>
            </label>
            <input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="reset-password-input"
            />
            <div className="tp-pw-strength" data-testid="reset-pw-strength">
              <div className="tp-pw-bars">
                {([0, 1, 2, 3] as const).map((i) => (
                  <div
                    key={i}
                    className={
                      'tp-pw-bar ' +
                      (i < strength
                        ? strength <= 2
                          ? 'tp-pw-bar-weak'
                          : strength === 3
                            ? 'tp-pw-bar-medium'
                            : 'tp-pw-bar-strong'
                        : '')
                    }
                  />
                ))}
              </div>
              <div className="tp-pw-checks">
                <span className={`tp-pw-check ${checks.lengthOk ? 'tp-pw-check-ok' : ''}`} data-testid="reset-check-length">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    {checks.lengthOk
                      ? <polyline points="20 6 9 17 4 12" />
                      : <circle cx="12" cy="12" r="10" />}
                  </svg>
                  長度 ≥ 8 字
                </span>
                <span className={`tp-pw-check ${checks.hasLetter && checks.hasNumber ? 'tp-pw-check-ok' : ''}`} data-testid="reset-check-mix">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    {checks.hasLetter && checks.hasNumber
                      ? <polyline points="20 6 9 17 4 12" />
                      : <circle cx="12" cy="12" r="10" />}
                  </svg>
                  包含字母與數字
                </span>
              </div>
            </div>
          </div>

          <div className="tp-form-row">
            <label htmlFor="reset-confirm">再次輸入新密碼</label>
            <input
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              data-testid="reset-confirm"
            />
            {pwError && <InlineError message={pwError} testId="reset-pw-error" />}
          </div>

          <button
            type="submit"
            className="tp-btn tp-btn-primary"
            disabled={submitting}
            data-testid="reset-submit"
          >
            {submitting ? '更新中…' : '重設密碼'}
          </button>
        </form>

        <div className="tp-auth-footer">
          想起密碼了？<a href="/login">回登入</a>
        </div>
        </div>
      </div>

      <AuthBrandHero
        eyebrow="Final Step"
        headline={<>最後一步<br />就完成了。</>}
        sub="設好新密碼，你會自動登入並進入「行程」頁。記得密碼存到密碼管理器（1Password / Apple Keychain / Google Password）。"
        items={[
          {
            icon: <polyline points="20,6 9,17 4,12" />,
            title: '即時生效',
            desc: '設好密碼後立即可登入，不需等 email 或重新驗證。',
          },
          {
            icon: (
              <>
                <path d="M12 1l3 3-3 3M12 17l3 3-3 3M5 12H1l3-3M19 12h4l-3 3" />
                <path d="M9 12a3 3 0 0 1 6 0v0a3 3 0 0 1-6 0z" />
              </>
            ),
            title: '舊裝置全登出',
            desc: '手機、平板、其他電腦的 session 全部清掉，重新登入才能用。',
          },
        ]}
        footnote="© 2026 Tripline"
      />
    </main>
  );
}
