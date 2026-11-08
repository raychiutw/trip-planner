/**
 * 新 api 認證的整合點（唯一的認證路徑，ADR-0011）。
 *
 * API 網址用 `VITE_API_BASE_URL`（production 見 `.env.production`；本機開發見 `.env.local.example`）。
 * 沒有舊的 cookie／同源 /api 路徑：apiClient／LoginPage／useCurrentUser／logout 一律經過這裡的 client。
 * client 本身在第一次呼叫才建立；IndexedDB 在第一次存取憑證時才開。
 */
import { createAuthClient, type AuthClient } from './client';
import { createIdbAuthStorage } from './storage';
import { defaultReauthHandler } from './transport';

export { AuthError, createAuthClient, type AuthClient } from './client';
export { createIdbAuthStorage, createMemoryAuthStorage, type AuthStorage } from './storage';

let singleton: AuthClient | null = null;

/** 新 api 的網址（已去尾斜線）。 */
export function getNewApiBase(): string {
  return ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/+$/, '');
}

/** 應用層唯一的 client（第一次呼叫才建立）。 */
export function getNewApiAuth(): AuthClient {
  if (!singleton) {
    const apiBase = getNewApiBase();
    if (!apiBase) throw new Error('必須設定 VITE_API_BASE_URL');
    singleton = createAuthClient({ apiBase, storage: createIdbAuthStorage(), onReauthRequired: defaultReauthHandler });
  }
  return singleton;
}

let authorizeSingleton: AuthClient | null = null;

/**
 * `/oauth/authorize` 頁專用的 client（給新 api 的第一方 App 授權用）。沒設定 `VITE_API_BASE_URL` 就丟錯，由頁面顯示「目前無法使用」。
 * 需要重新登入時不導頁（onReauthRequired 為空），由頁面自己切回登入表單。
 */
export function getAuthorizeAuth(): AuthClient {
  if (!authorizeSingleton) {
    const apiBase = getNewApiBase();
    if (!apiBase) throw new Error('未設定 VITE_API_BASE_URL');
    authorizeSingleton = createAuthClient({ apiBase, storage: createIdbAuthStorage(), onReauthRequired: () => {} });
  }
  return authorizeSingleton;
}
