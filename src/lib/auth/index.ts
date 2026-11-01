/**
 * 新 api 認證的整合點（預設關閉）。
 *
 * `VITE_NEW_API_AUTH === '1'` 才啟用；API 網址用 `VITE_API_BASE_URL`。
 * flag 關閉時 `getNewApiAuth()`／`useNewApiAuth()` 回 null：不建立 client、不打 fetch、不碰 IndexedDB，
 * 呼叫端照舊走 cookie 流程（apiClient.ts／LoginPage 目前都沒有改，行為與現在完全一致）。
 */
import { createAuthClient, type AuthClient } from './client';
import { createIdbAuthStorage } from './storage';

export { AuthError, createAuthClient, type AuthClient } from './client';
export { createIdbAuthStorage, createMemoryAuthStorage, type AuthStorage } from './storage';

export function isNewApiAuthEnabled(): boolean {
  return import.meta.env.VITE_NEW_API_AUTH === '1';
}

let singleton: AuthClient | null = null;

/** 啟用時回應用層唯一的 client（第一次呼叫才建立）；關閉時回 null。 */
export function getNewApiAuth(): AuthClient | null {
  if (!isNewApiAuthEnabled()) return null;
  if (!singleton) {
    const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
    if (!apiBase) throw new Error('VITE_NEW_API_AUTH=1 時必須設定 VITE_API_BASE_URL');
    singleton = createAuthClient({ apiBase, storage: createIdbAuthStorage() });
  }
  return singleton;
}

/** 給 component 用的入口；沒有 React state（singleton），所以在 render 中呼叫是安全的。 */
export function useNewApiAuth(): AuthClient | null {
  return getNewApiAuth();
}
