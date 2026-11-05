/**
 * AuthCallbackPage — `/auth/callback`：Google 登入（新 api）的回跳頁。
 *
 * 新 api 完成 Google 登入後 302 回這裡，query 帶 `code`＋`state`（或 `error`）。
 * 驗 state、用發起時暫存的 PKCE verifier 與 DPoP 金鑰換 token 都在 auth client（`finishGoogleLogin`）；
 * 這頁只負責：成功 → 導向 redirect_after_login（預設 /trips），失敗 → 回登入頁並帶錯誤碼由登入頁顯示。
 * 只在新 api 旗標開啟時有意義；旗標關閉時打到這頁一律回登入頁。
 */
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthError, getNewApiAuth } from '../lib/auth';
import { sanitizeRedirectAfter } from '../lib/redirect';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // 暫存「用過即刪」：StrictMode 重跑 effect 時第二次會拿不到暫存，所以只跑一次
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const fail = (code: string) => navigate(`/login?google_error=${encodeURIComponent(code)}`, { replace: true });
    const auth = getNewApiAuth();
    if (!auth) { fail('AUTH_DISABLED'); return; }
    auth.finishGoogleLogin(params).then(
      ({ redirectAfterLogin }) => navigate(sanitizeRedirectAfter(redirectAfterLogin) ?? '/trips', { replace: true }),
      (err: unknown) => fail(err instanceof AuthError ? err.code : 'UNKNOWN'),
    );
  }, [navigate, params]);

  return (
    <main className="grid min-h-dvh place-items-center" data-testid="auth-callback-page">
      <h1 className="sr-only">Google 登入</h1>
      <p role="status">登入中…</p>
    </main>
  );
}
