/**
 * 全域測試設定：把 `src/lib/auth` 的 client 換成「穿透」版本。
 *
 * 為什麼：旗標移除後，apiClient 一律經過 auth client（DPoP token、IndexedDB 憑證）。
 * 絕大多數頁面／hook 測試只想驗畫面與請求內容，不是在測認證——它們以 stub 的 `fetch` 攔 `/api/...`。
 * 穿透 client 讓 `apiFetch('/x')` 仍然只是 `fetch('/api/x', init)`，與旗標移除前的預設行為逐字相同，這些測試不必改。
 *
 * 真的在測認證的檔案（auth-new-api、new-api-wiring…）用 `vi.unmock('…/src/lib/auth')`／直接 import `lib/auth/client`，
 * 走真正的實作。這個 mock 只影響「入口」`src/lib/auth/index.ts` 的 getNewApiAuth／getNewApiBase。
 */
import { vi } from 'vitest';

vi.mock('../src/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/auth')>();
  const passthrough: import('../src/lib/auth').AuthClient = {
    isAuthenticated: () => true,
    restoreSession: async () => true,
    apiFetch: (input, init) => globalThis.fetch(String(input), init),
    login: async () => {},
    refresh: async () => {},
    logout: async () => {},
  };
  return { ...actual, getNewApiAuth: () => passthrough, getNewApiBase: () => '' };
});
