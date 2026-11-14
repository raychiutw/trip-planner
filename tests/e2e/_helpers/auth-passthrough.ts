/**
 * e2e／MOCK_API 專用：取代 `src/lib/auth/index.ts` 的「穿透」版本（由 vite.config.ts 的 authPassthrough 外掛換入，
 * 只在 `E2E_AUTH_PASSTHROUGH=1` 或 `MOCK_API` 時；正式建置不會碰到這個檔案）。
 *
 * 為什麼：大部分 e2e 用 `page.route('**\/api/**')` 回罐頭資料，驗的是畫面不是認證。旗標移除後所有請求都要經過 auth client
 * （IndexedDB 憑證、token 端點、DPoP），逐支 spec 種憑證不切實際。穿透 client 讓請求仍是同源的 `/api/...`，罐頭照常攔截。
 * 真正的認證（PKCE／DPoP／refresh／登出）由 `playwright.newapi.config.js` 的 e2e 以真 auth client 對假 api 驗證，不在這裡。
 */
import type { AuthClient } from '../../../src/lib/auth/client';

export { AuthError, createAuthClient, type AuthClient } from '../../../src/lib/auth/client';
export { createIdbAuthStorage, createMemoryAuthStorage, type AuthStorage } from '../../../src/lib/auth/storage';

const passthrough: AuthClient = {
  isAuthenticated: () => true,
  restoreSession: async () => true,
  apiFetch: (input, init) => globalThis.fetch(String(input), init),
  login: async () => { throw new Error('穿透 auth 不支援登入；要驗登入請用 playwright.newapi.config.js'); },
  refresh: async () => {},
  logout: async () => {},
  getIdToken: () => null,
};

export const getNewApiBase = (): string => '';
export const getNewApiAuth = (): AuthClient => passthrough;
export const getAuthorizeAuth = (): AuthClient => passthrough;
