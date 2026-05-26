/**
 * VerifyEmailPage — v2.33.59 round 13 H2 + v2.33.114 user-gesture-required
 *
 * Email 驗證 landing page。Email link 從 `/api/oauth/verify?token=...` (GET-with-side-effect)
 * 改指 `/auth/verify-email?token=...` 本 page。
 *
 * Flow:
 *   1. Mount: read token from query → idle state 顯示「點此完成驗證」button
 *   2. User click button → POST `/api/oauth/verify` with body { token }
 *   3. Success → navigate /login?verified=1
 *   4. Error → 顯示對應訊息 + 提供「重寄」/ 「回首頁」 button
 *   5. No-JS fallback: noscript <form> 直接 POST /api/oauth/verify
 *
 * Defense vs 舊 GET-with-side-effect (v2.33.59):
 *   - Email client image-preview 不會 silent consume
 *   - Token 不留 browser history (URL 改為 SPA path，POST body 帶 token)
 *   - Referer leak 透過 POST body 不放 URL
 *
 * v2.33.114 — 拔 auto-POST，require user gesture:
 *   v2.33.59 的 auto-POST on mount 對 image-preview-only scanner 有用，
 *   但企業 email security（Mimecast / Microsoft Safe Links / Proofpoint
 *   URL Sandbox）會跑 headless Chromium deep inspection，render 整個 page
 *   觸發 useEffect → silent consume token。User 之後點信件連結看到「已使用」
 *   誤導訊息（rayschiu@fetci.com 2026-05-25 QA 復現）。改用 button click =
 *   require user gesture，scanner headless render 不會自動 click button。
 */
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetchRaw } from '../lib/apiClient';

type Status = 'idle' | 'verifying' | 'success' | 'error';
type ErrorCode = 'missing_token' | 'expired' | 'used' | 'server_error' | 'network';

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  missing_token: '驗證連結缺少 token 參數，可能是連結被截斷。',
  expired: '驗證連結已過期，請重新申請驗證信。',
  used: '此驗證連結已經使用過了，可直接登入。',
  server_error: '系統暫時無法驗證，請稍後再試。',
  network: '網路連線錯誤，請檢查網路後再試。',
};

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  // v2.33.114: missing_token 在 mount 時就 derive 進 initial state（避免 useEffect setState 副作用）
  const [status, setStatus] = useState<Status>(token ? 'idle' : 'error');
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(token ? null : 'missing_token');

  async function performVerify(): Promise<void> {
    setStatus('verifying');
    setErrorCode(null);
    try {
      const res = await apiFetchRaw('/oauth/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
        headers: { 'content-type': 'application/json' },
      });
      const data = (await res.json()) as { ok?: boolean; error?: ErrorCode };
      if (res.ok && data.ok) {
        setStatus('success');
        // 短暫顯示成功，跳轉 /login?verified=1
        setTimeout(() => navigate('/login?verified=1'), 1500);
      } else {
        setStatus('error');
        setErrorCode(data.error ?? 'server_error');
      }
    } catch {
      setStatus('error');
      setErrorCode('network');
    }
  }


  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--color-bg)',
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          padding: 32,
          background: 'var(--color-paper)',
          border: '1px solid var(--color-border)',
          borderRadius: 14,
          textAlign: 'center',
        }}
        data-testid="verify-email-page"
      >
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 16px' }}>
          Email 驗證
        </h1>

        {status === 'idle' ? (
          <>
            <p
              style={{ color: 'var(--color-muted)', margin: '0 0 20px', lineHeight: 1.5 }}
              data-testid="verify-email-status-idle"
            >
              點下方按鈕完成 Email 驗證。
            </p>
            <button
              type="button"
              onClick={() => void performVerify()}
              data-testid="verify-email-confirm-btn"
              style={{
                padding: '12px 28px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-accent)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              點此完成驗證
            </button>
          </>
        ) : null}

        {status === 'verifying' ? (
          <p style={{ color: 'var(--color-muted)', margin: 0 }} data-testid="verify-email-status-verifying">
            驗證中…
          </p>
        ) : null}

        {status === 'success' ? (
          <>
            <p style={{ color: 'var(--color-priority-low-dot)', fontWeight: 700, margin: 0 }}
               data-testid="verify-email-status-success">
              ✓ Email 驗證成功！
            </p>
            <p style={{ color: 'var(--color-muted)', marginTop: 12, fontSize: 14 }}>
              即將跳轉登入頁…
            </p>
          </>
        ) : null}

        {status === 'error' && errorCode ? (
          <>
            <p
              style={{ color: 'var(--color-priority-high-dot)', margin: 0, lineHeight: 1.5 }}
              data-testid={`verify-email-status-error-${errorCode}`}
            >
              {ERROR_MESSAGES[errorCode]}
            </p>
            <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {errorCode === 'expired' ? (
                <Link
                  to="/login"
                  style={{
                    padding: '10px 18px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--color-accent)',
                    color: '#fff',
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontSize: 14,
                  }}
                  data-testid="verify-email-resend-link"
                >
                  重新申請
                </Link>
              ) : null}
              {errorCode === 'used' ? (
                <Link
                  to="/login"
                  style={{
                    padding: '10px 18px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--color-accent)',
                    color: '#fff',
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontSize: 14,
                  }}
                  data-testid="verify-email-login-link"
                >
                  前往登入
                </Link>
              ) : null}
              {errorCode === 'network' || errorCode === 'server_error' ? (
                <button
                  type="button"
                  onClick={() => void performVerify()}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--color-accent)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                  data-testid="verify-email-retry"
                >
                  重試
                </button>
              ) : null}
              <Link
                to="/"
                style={{
                  padding: '10px 18px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--color-secondary)',
                  color: 'var(--color-foreground)',
                  border: '1px solid var(--color-border)',
                  textDecoration: 'none',
                  fontWeight: 700,
                  fontSize: 14,
                }}
                data-testid="verify-email-home-link"
              >
                回首頁
              </Link>
            </div>
          </>
        ) : null}

        {/* No-JS fallback: form auto-submits via attribute, JS bypasses with apiFetchRaw above */}
        <noscript>
          <form action="/api/oauth/verify" method="POST" style={{ marginTop: 20 }}>
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              style={{
                padding: '12px 24px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-accent)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              點此驗證
            </button>
            <p style={{ marginTop: 12, color: 'var(--color-muted)', fontSize: 13 }}>
              你目前未啟用 JavaScript — 請手動點按上方按鈕完成驗證。
            </p>
          </form>
        </noscript>
      </div>
    </div>
  );
}
