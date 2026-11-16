/**
 * 授權頁（/oauth/authorize）的流程：view 狀態機（init／login／confirm／error）、登入、
 * 生物辨識意圖（wantBio）、批准。元件只負責呈現。
 *
 * seam 是 `getAuthorizeAuth()`；批准本身見 lib/auth/authorizeApprove。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAuthorizeAuth } from '../lib/auth';
import { approveAuthorization, type ApproveResult } from '../lib/auth/authorizeApprove';
import { REQUEST_ID, USERINFO_PATH, authorizePath } from '../lib/auth/authorizeContract';
import { classifyLoginError } from '../lib/auth/loginError';
import { clearApiCache } from '../lib/logout';

export interface AuthRequestView {
  appName: string;
  scopes: string[];
}

export type AuthorizeView =
  | { kind: 'init' }
  | { kind: 'login'; error?: string; credential?: boolean }
  | { kind: 'confirm'; request: AuthRequestView; email: string }
  | { kind: 'error'; message: string };

const OFFLINE: AuthorizeView = { kind: 'error', message: '無法連線，請稍後再試。' };

const FAILURE_MESSAGE: Record<Extract<ApproveResult, { kind: 'failed' }>['reason'], string> = {
  expired: '授權失敗：請求已過期或已使用，請回到 App 重新發起登入。',
  forbidden: '這個帳號沒有權限完成這次授權，請回 App 換用其他帳號或重新發起登入。',
  'bad-redirect': '授權完成但無法回到 App，請回到 App 重新發起登入。',
  network: '無法連線，請稍後再試。',
};

function loginFailure(err: unknown): AuthorizeView {
  const c = classifyLoginError(err);
  if (c.kind === 'invalid') return { kind: 'login', error: '電子郵件或密碼錯誤。', credential: true };
  if (c.kind === 'rate-limited') {
    return { kind: 'login', error: c.retryAfter ? `嘗試次數過多，請 ${Math.ceil(c.retryAfter / 60)} 分鐘後再試。` : '嘗試次數過多，請稍後再試。', credential: false };
  }
  return { kind: 'login', error: '登入失敗，請稍後再試。', credential: false };
}

export function useAuthorizeFlow({ requestId }: { requestId: string }) {
  const [view, setView] = useState<AuthorizeView>({ kind: 'init' });
  const [busy, setBusy] = useState(false);
  const approving = useRef(false);
  // 按專門鈕登入 = 使用者要開啟生物辨識登入；等批准時才送意圖（ADR-0018）。
  const wantBio = useRef(false);

  const loadRequest = useCallback(async (): Promise<AuthorizeView> => {
    const auth = getAuthorizeAuth();
    const reqRes = await auth.apiFetch(authorizePath('request', requestId));
    if (!reqRes.ok) return { kind: 'error', message: '授權請求不存在、已過期或已使用，請回到 App 重新發起登入。' };
    const body = await reqRes.json() as { client?: { app_name?: string }; scopes?: string[] };
    const appName = body.client?.app_name?.trim();
    if (!appName || !Array.isArray(body.scopes)) return { kind: 'error', message: '無法確認應用程式資訊，請稍後再試。' };
    const meRes = await auth.apiFetch(USERINFO_PATH);
    if (!meRes.ok) return { kind: 'login' };
    const me = await meRes.json() as { email?: string };
    return { kind: 'confirm', request: { appName, scopes: body.scopes }, email: me.email ?? '' };
  }, [requestId]);

  useEffect(() => {
    if (!REQUEST_ID.test(requestId)) {
      setView({ kind: 'error', message: '授權連結不完整，請回到 App 重新發起登入。' });
      return;
    }
    let cancelled = false;
    (async () => {
      let auth;
      try {
        auth = getAuthorizeAuth();
      } catch {
        if (!cancelled) setView({ kind: 'error', message: '目前無法使用瀏覽器登入，請稍後再試。' });
        return;
      }
      try {
        const restored = auth.isAuthenticated() || (await auth.restoreSession());
        const next: AuthorizeView = restored ? await loadRequest() : { kind: 'login' };
        if (!cancelled) setView(next);
      } catch {
        if (!cancelled) setView(OFFLINE);
      }
    })();
    return () => { cancelled = true; };
  }, [requestId, loadRequest]);

  const approve = useCallback(async () => {
    if (approving.current) return;
    approving.current = true;
    setBusy(true);
    try {
      const r = await approveAuthorization(requestId, { wantBio: wantBio.current });
      if (r.kind === 'redirect') {
        window.location.assign(r.url);
      } else {
        setView({ kind: 'error', message: FAILURE_MESSAGE[r.reason] });
      }
    } finally {
      // 成功導向後不再解鎖 approving（避免頁面還在時被連點）；失敗已切到錯誤畫面
      setBusy(false);
    }
  }, [requestId]);

  /** 帳密通過後、批准／讀請求之前呼叫 onAuthenticated（頁面據此清掉密碼欄）；回傳帳密是否通過。 */
  const login = useCallback(async (email: string, password: string, enableBio: boolean, onAuthenticated?: () => void): Promise<boolean> => {
    if (busy) return false;
    wantBio.current = enableBio;
    setBusy(true);
    try {
      await getAuthorizeAuth().login(email.trim(), password);
    } catch (err) {
      setView(loginFailure(err));
      setBusy(false);
      return false;
    }
    onAuthenticated?.();
    try {
      setView(await loadRequest());
    } catch {
      setView(OFFLINE);
    } finally {
      setBusy(false);
    }
    return true;
  }, [busy, loadRequest]);

  const switchAccount = useCallback(async () => {
    await getAuthorizeAuth().logout();
    await clearApiCache();
    wantBio.current = false;
    setView({ kind: 'login' });
  }, []);

  return { view, busy, login, approve, switchAccount };
}
