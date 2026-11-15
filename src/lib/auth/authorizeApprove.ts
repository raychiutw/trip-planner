/**
 * 批准授權：（選用）先記下開啟生物辨識登入的意圖，再 POST approve。
 * 回傳三種結果，由流程 hook 決定畫面；這裡不碰畫面狀態。
 */
import { getAuthorizeAuth } from './index';
import { authorizePath, type IntentValue } from './authorizeContract';

export type ApproveResult =
  | { kind: 'redirect'; url: string }
  /** reauth 模式、登入已超過伺服器容許的時間（403 OAUTH_REAUTH_REQUIRED）：請求還在，要重新登入後對同一 request_id 再批准 */
  | { kind: 'reauth-required' }
  | { kind: 'failed'; reason: 'expired' | 'forbidden' | 'bad-redirect' | 'network' };

/** redirect_to 由 api 組成；這裡是 defense in depth：只接受 https，或本機 loopback 的 http（行動端開發用）。 */
function isSafeRedirect(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol === 'https:') return true;
    return u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost');
  } catch {
    return false;
  }
}

/** 意圖失敗不擋登入：只是沒開啟。網路錯誤與 5xx 最多共試 3 次（間隔 300ms）；4xx 是確定性拒絕，不重試。 */
async function sendEnableIntent(requestId: string): Promise<void> {
  const intent: IntentValue = 'enable';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await getAuthorizeAuth().apiFetch(authorizePath('intent', requestId), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ intent }),
      });
      if (r.status < 500) return;
    } catch { /* 網路錯誤：視同可重試 */ }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

export async function approveAuthorization(
  requestId: string,
  opts: { wantBio: boolean; reauth: boolean },
): Promise<ApproveResult> {
  try {
    if (opts.wantBio && !opts.reauth) await sendEnableIntent(requestId);
    const res = await getAuthorizeAuth().apiFetch(authorizePath('approve', requestId), { method: 'POST' });
    if (!res.ok) {
      if (res.status === 403) {
        const body: { error?: { code?: string } } | null = await res.json().catch(() => null);
        if (opts.reauth && body?.error?.code === 'OAUTH_REAUTH_REQUIRED') return { kind: 'reauth-required' };
        return { kind: 'failed', reason: 'forbidden' };
      }
      return { kind: 'failed', reason: 'expired' };
    }
    const { redirect_to }: { redirect_to?: string } = await res.json();
    if (!redirect_to || !isSafeRedirect(redirect_to)) return { kind: 'failed', reason: 'bad-redirect' };
    return { kind: 'redirect', url: redirect_to };
  } catch {
    return { kind: 'failed', reason: 'network' };
  }
}
