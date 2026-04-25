/**
 * EmailVerifyPendingPage — V2-P2 顯示「查看你的信箱」+ 60s cooldown 重寄
 *
 * Route: /signup/check-email?email=...
 * 進來情境：
 *   1. SignupPage 註冊成功後 navigate 過來
 *   2. 直接訪問（refresh / bookmark）→ 仍可運作，按「重寄」就行
 *
 * 設計：
 *   - 顯示信箱（從 query 取，escape）
 *   - 「重寄」按鈕有 60s cooldown 防濫用 (前端 throttle，後端有 rate limit 層)
 *   - mobile：「打開信箱 App」mailto: deep link
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const SCOPED_STYLES = `
.tp-verify-shell {
  display: flex; align-items: center; justify-content: center;
  min-height: 100dvh; padding: 48px 24px;
  background:
    radial-gradient(circle at 20% 0%, rgba(0, 119, 182, 0.06), transparent 50%),
    var(--color-secondary);
}
.tp-verify-card {
  width: 100%; max-width: 440px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 40px 36px;
  box-shadow: var(--shadow-md);
  text-align: center;
}
.tp-verify-icon-circle {
  width: 72px; height: 72px;
  border-radius: var(--radius-full);
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  display: grid; place-items: center;
  margin: 0 auto 20px;
}
.tp-verify-icon-circle svg { width: 36px; height: 36px; }
.tp-verify-title {
  font-size: var(--font-size-title2);
  font-weight: 800;
  margin: 0 0 8px;
}
.tp-verify-subtitle {
  font-size: var(--font-size-subheadline);
  color: var(--color-muted);
  margin: 0 0 4px;
}
.tp-verify-email {
  font-size: var(--font-size-body);
  font-weight: 700;
  color: var(--color-foreground);
  margin: 0 0 24px;
}
.tp-verify-banner {
  display: flex; gap: 12px;
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  padding: 14px 16px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-subheadline);
  text-align: left;
  margin-bottom: 20px;
}
.tp-verify-banner svg { flex-shrink: 0; width: 20px; height: 20px; margin-top: 1px; }

.tp-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 100%; gap: 8px;
  padding: 12px 20px;
  border-radius: var(--radius-md);
  font-family: inherit; font-size: var(--font-size-callout); font-weight: 600;
  border: 1px solid var(--color-border);
  background: var(--color-background); color: var(--color-foreground);
  cursor: pointer; min-height: 48px;
  transition: background 120ms;
  margin-bottom: 12px;
  text-decoration: none;
}
.tp-btn-primary {
  background: var(--color-accent); color: #fff; border: none;
}
.tp-btn-primary:hover:not(:disabled) { filter: brightness(0.92); }
.tp-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.tp-verify-footer {
  text-align: center; margin-top: 16px;
  font-size: var(--font-size-footnote); color: var(--color-muted);
}
.tp-verify-footer a {
  color: var(--color-accent);
  font-weight: 600;
  text-decoration: none;
}
`;

const COOLDOWN_SEC = 60;

export default function EmailVerifyPendingPage() {
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const [cooldownEndsAt, setCooldownEndsAt] = useState(() => Date.now() + COOLDOWN_SEC * 1000);
  const [tick, setTick] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sent' | 'error'>('idle');

  // Single 1Hz interval re-renders to update countdown; cleaner than chained setTimeout
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const cooldown = Math.max(0, Math.ceil((cooldownEndsAt - Date.now()) / 1000));
  // Suppress unused-var lint; tick triggers re-render so cooldown recomputes
  void tick;

  const safeEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  async function handleResend() {
    if (cooldown > 0 || !safeEmail) return;
    setResending(true);
    setResendStatus('idle');
    try {
      await fetch('/api/oauth/send-verification', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: safeEmail }),
      });
      setResendStatus('sent');
      setCooldownEndsAt(Date.now() + COOLDOWN_SEC * 1000);
    } catch {
      setResendStatus('error');
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="tp-verify-shell" data-testid="verify-pending-page">
      <style>{SCOPED_STYLES}</style>
      <div className="tp-verify-card">
        <div className="tp-verify-icon-circle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <h1 className="tp-verify-title">查看你的信箱</h1>
        <p className="tp-verify-subtitle">我們已寄出驗證信到</p>
        <p className="tp-verify-email" data-testid="verify-email">{safeEmail || '（沒有 email）'}</p>

        <div className="tp-verify-banner" role="status">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div>連結 24 小時內有效。記得檢查垃圾信件夾。</div>
        </div>

        <a className="tp-btn tp-btn-primary" href="mailto:" data-testid="verify-open-mail">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          </svg>
          打開信箱
        </a>

        <button
          className="tp-btn"
          onClick={handleResend}
          disabled={cooldown > 0 || resending || !safeEmail}
          data-testid="verify-resend"
        >
          {cooldown > 0
            ? `重新寄送（${cooldown} 秒後可重寄）`
            : resending
              ? '寄送中…'
              : '重新寄送驗證信'}
        </button>

        {resendStatus === 'sent' && (
          <p className="tp-verify-footer" data-testid="verify-resend-sent">
            已重寄。請查看信箱。
          </p>
        )}
        {resendStatus === 'error' && (
          <p className="tp-verify-footer" style={{ color: 'var(--color-destructive)' }} data-testid="verify-resend-error">
            重寄失敗，請稍後再試。
          </p>
        )}

        <p className="tp-verify-footer">
          打錯 email？<a href="/signup">改用其他信箱</a>
        </p>
      </div>
    </main>
  );
}
