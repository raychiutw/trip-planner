/**
 * 登出的單一入口。旗標 VITE_NEW_API_AUTH 關閉（預設）：照舊 POST 同源 /api/oauth/logout（cookie session）。
 * 開啟：交給 auth client —— 撤銷 refresh token 家族、清除 IndexedDB 的金鑰與 refresh token、丟掉記憶體中的 access token；
 * 撤銷請求失敗（網路等）不阻擋本機登出。
 */
import { apiFetchRaw } from './apiClient';
import { getNewApiAuth } from './auth';

export async function logoutSession(): Promise<void> {
  const auth = getNewApiAuth();
  if (auth) {
    await auth.logout();
    return;
  }
  await apiFetchRaw('/oauth/logout', { method: 'POST' });
}
