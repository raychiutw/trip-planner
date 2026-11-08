// @ts-check
/**
 * 新 api 模式（VITE_NEW_API_AUTH=1）的 e2e（#1480 缺口）。執行：npx playwright test -c playwright.newapi.config.js
 *
 * 對象是 tests/e2e/_helpers/fake-new-api.cjs —— 有狀態、真的驗 PKCE／DPoP／refresh 輪替與重放撤銷的本機假 api，
 * 不是 page.route 的罐頭。每個斷言都同時看「瀏覽器這端」（畫面、IndexedDB）與「api 這端」（/__fake/state），
 * 因為這類流程最容易出的錯是「畫面看起來登出了，但憑證其實還有效」。
 *
 * 不涵蓋：真實 Google／真實 api 的行為（沒有真實帳號，也不連外網）、Firefox／WebKit。
 */
import { test, expect } from '@playwright/test';

const API = 'http://localhost:3102';
const DEMO = { email: 'demo@example.test', password: 'correct-horse-1' };

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__fake/reset`);
});

/** api 端的狀態快照。 */
const apiState = async (request) => (await request.get(`${API}/__fake/state`)).json();

/** 瀏覽器端 IndexedDB（tripline-auth／kv）的內容摘要；金鑰不可匯出，只回有沒有。 */
const readAuthStore = (page) => page.evaluate(() => new Promise((resolve, reject) => {
  const open = indexedDB.open('tripline-auth');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const db = open.result;
    if (!db.objectStoreNames.contains('kv')) { db.close(); return resolve({ keys: [], refreshToken: null }); }
    const store = db.transaction('kv').objectStore('kv');
    const keysReq = store.getAllKeys();
    const rtReq = store.get('refreshToken');
    const tx = store.transaction;
    tx.oncomplete = () => { db.close(); resolve({ keys: keysReq.result.map(String).sort(), refreshToken: rtReq.result ?? null }); };
    tx.onerror = () => reject(tx.error);
  };
}));

/**
 * 把目前的 refreshToken＋金鑰複製到另一個 IndexedDB（e2e-snap），之後可原封不動寫回（模擬「已作廢／被登出的舊憑證」）。
 * 不能放 window：重新整理就沒了；金鑰是不可匯出的 CryptoKey，只能靠結構化複製存在 IndexedDB。
 */
const snapshotAuthStore = (page) => page.evaluate(() => new Promise((resolve, reject) => {
  const open = indexedDB.open('tripline-auth');
  open.onsuccess = () => {
    const store = open.result.transaction('kv').objectStore('kv');
    const rt = store.get('refreshToken');
    const kp = store.get('keyPair');
    store.transaction.oncomplete = () => {
      open.result.close();
      const w = indexedDB.open('e2e-snap', 1);
      w.onupgradeneeded = () => w.result.createObjectStore('kv');
      w.onsuccess = () => {
        const tx = w.result.transaction('kv', 'readwrite');
        tx.objectStore('kv').put({ refreshToken: rt.result, keyPair: kp.result }, 'snap');
        tx.oncomplete = () => { w.result.close(); resolve(null); };
      };
    };
    store.transaction.onerror = () => reject(store.transaction.error);
  };
  open.onerror = () => reject(open.error);
}));
const restoreSnapshot = (page) => page.evaluate(() => new Promise((resolve, reject) => {
  const r = indexedDB.open('e2e-snap', 1);
  r.onsuccess = () => {
    const get = r.result.transaction('kv').objectStore('kv').get('snap');
    get.onsuccess = () => {
      r.result.close();
      const open = indexedDB.open('tripline-auth', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('kv');
      open.onsuccess = () => {
        const tx = open.result.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(get.result.refreshToken, 'refreshToken');
        tx.objectStore('kv').put(get.result.keyPair, 'keyPair');
        tx.oncomplete = () => { open.result.close(); resolve(null); };
        tx.onerror = () => reject(tx.error);
      };
    };
  };
  r.onerror = () => reject(r.error);
}));

async function loginWithPassword(page, { email, password } = DEMO) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
}

async function loginWithGoogle(page) {
  await page.goto('/login');
  await page.getByTestId('login-google').click();
}

test.describe('登入回跳', () => {
  test('帳密登入：PKCE＋DPoP 換到 token，落在 /trips，瀏覽器只持久化 refresh token 與金鑰', async ({ page, request }) => {
    await loginWithPassword(page);
    await expect(page).toHaveURL(/\/trips/);
    const s = await apiState(request);
    expect(s.stats.codeGrants).toBe(1);
    expect(s.stats.dpopRejected).toBe(0);
    const store = await readAuthStore(page);
    expect(store.keys).toEqual(['keyPair', 'refreshToken']); // 沒有 access token、沒有殘留的 pendingLogin
    expect(store.refreshToken).toBeTruthy();
    // access token 不落地：localStorage／sessionStorage／cookie 都不該有任何 token
    const leaked = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
    expect(leaked).not.toMatch(/token/i);
  });

  test('帳密錯誤：顯示錯誤、不發任何 token', async ({ page, request }) => {
    await loginWithPassword(page, { email: DEMO.email, password: 'wrong' });
    await expect(page.getByText('電子郵件或密碼錯誤').first()).toBeVisible();
    expect((await apiState(request)).stats.codeGrants).toBe(0);
    expect((await readAuthStore(page)).keys).toEqual([]);
  });

  test('Google 登入：發起 → 新 api 入口 → /auth/callback → /trips（redirect_uri 與 state 對得上）', async ({ page, request }) => {
    await loginWithGoogle(page);
    await expect(page).toHaveURL(/\/trips/);
    expect((await apiState(request)).stats.codeGrants).toBe(1);
    expect((await readAuthStore(page)).keys).toEqual(['keyPair', 'refreshToken']); // pendingLogin 用過即刪
  });

  test('回跳的 state 不符：拒絕、回登入頁帶錯誤碼、不換 token', async ({ page, request }) => {
    await page.goto('/login');
    await page.getByTestId('login-google').waitFor();
    await page.goto('/auth/callback?code=forged&state=forged');
    await expect(page).toHaveURL(/\/login\?google_error=OAUTH_STATE_MISMATCH/);
    expect((await apiState(request)).stats.codeGrants).toBe(0);
  });
});

test.describe('重新整理', () => {
  test('重新整理後仍登入：用持久的 refresh token 換新 access token（輪替一次）', async ({ page, request }) => {
    await loginWithPassword(page);
    await expect(page).toHaveURL(/\/trips/);
    const before = (await readAuthStore(page)).refreshToken;
    await page.goto('/account');
    await expect(page.getByTestId('account-page')).toBeVisible();
    await expect(page).toHaveURL(/\/account$/); // 沒被踢回 /login
    const s = await apiState(request);
    expect(s.stats.refreshGrants).toBe(1);
    expect((await readAuthStore(page)).refreshToken).not.toBe(before); // 每次使用即輪替
  });

  test('沒登入過直接開受保護頁：導回 /login，且不對 api 發任何受保護請求', async ({ page, request }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/login/);
    const s = await apiState(request);
    expect(s.log.filter((l) => l.path !== '/api/public-config' && !l.path.startsWith('/__fake'))).toEqual([]);
  });
});

test.describe('refresh 輪替與重放撤銷', () => {
  test('access token 過期：同一頁內 401 → 自動 refresh 一次 → 重試成功，使用者無感', async ({ page, request }) => {
    await loginWithPassword(page);
    await expect(page).toHaveURL(/\/trips/);
    await page.goto('/account');
    await expect(page.getByTestId('account-page')).toBeVisible();
    const before = (await readAuthStore(page)).refreshToken;
    const grantsBefore = (await apiState(request)).stats.refreshGrants;
    await request.post(`${API}/__fake/expire-access`);
    // SPA 內導覽（不重載頁面）：變更密碼頁一掛載就 GET /api/account，那一發會先吃 401
    await page.getByTestId('account-row-change-password').click();
    await expect(page.getByTestId('change-password-page')).toBeVisible();
    await expect.poll(async () => (await apiState(request)).stats.refreshGrants).toBe(grantsBefore + 1);
    const s = await apiState(request);
    // 某個受保護請求先吃 401，refresh 之後同一路徑重試成功（哪一支先撞上取決於頁面，所以不寫死路徑）
    const i = s.log.findIndex((l) => l.status === 401);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(s.log.slice(i + 1).some((l) => l.path === s.log[i].path && l.method === s.log[i].method && l.status === 200)).toBe(true);
    expect(s.stats.reuseDetected).toBe(0);
    expect((await readAuthStore(page)).refreshToken).not.toBe(before);
  });

  test('用過的舊 refresh token 再出現（重放）：整個 family 被撤銷，包含最新那顆，使用者被登出', async ({ page, request }) => {
    await loginWithPassword(page);
    await expect(page).toHaveURL(/\/trips/);
    await snapshotAuthStore(page); // 舊的 refresh token R1
    await page.goto('/account'); // 重新整理 → R1 輪替成 R2，R1 已作廢
    await expect(page.getByTestId('account-page')).toBeVisible();
    expect((await apiState(request)).stats.refreshGrants).toBe(1);

    await restoreSnapshot(page); // 把作廢的 R1 放回去（同一把金鑰，proof 是合法的）
    await page.goto('/account');
    await expect(page).toHaveURL(/\/login/);
    const s = await apiState(request);
    expect(s.stats.reuseDetected).toBe(1);
    expect(s.families.every((f) => f.revoked)).toBe(true); // R2 所屬的 family 也被撤銷
    expect((await readAuthStore(page)).keys).toEqual([]); // 本機憑證清掉
  });
});

test.describe('登出', () => {
  test('登出：api 端撤銷 family、本機憑證清空；舊憑證放回去也換不到 token', async ({ page, request }) => {
    await loginWithPassword(page);
    await expect(page).toHaveURL(/\/trips/);
    await page.goto('/account');
    await expect(page.getByTestId('account-page')).toBeVisible();
    await snapshotAuthStore(page);

    await page.getByTestId('account-row-logout').click();
    await page.getByTestId('confirm-modal-confirm').click();
    await expect(page).toHaveURL(/\/login/);
    expect((await readAuthStore(page)).keys).toEqual([]);
    expect((await apiState(request)).families.map((f) => f.revoked)).toEqual([true]);

    // 把登出前的憑證（含合法金鑰）寫回，重新整理：api 必須拒絕，使用者留在登入頁
    await restoreSnapshot(page);
    await page.goto('/account');
    await expect(page).toHaveURL(/\/login/);
    expect((await readAuthStore(page)).keys).toEqual([]);
  });
});

test.describe('SSE ticket', () => {
  test('送出 AI 訊息：換一次性 ticket → EventSource 連線 → 收到完成事件；ticket 只被消耗一次', async ({ page, request }) => {
    await loginWithPassword(page);
    await expect(page).toHaveURL(/\/trips/);
    await page.goto('/chat?tripId=fake-trip');
    await page.getByTestId('chat-input').fill('你好');
    await page.getByTestId('chat-send').click();
    await expect.poll(async () => (await apiState(request)).stats.ticketsConsumed, { timeout: 15000 }).toBe(1);
    const s = await apiState(request);
    expect(s.stats.ticketsIssued).toBe(1);
    expect(s.stats.ticketsRejected).toBe(0); // 沒有重送用過的 ticket
    expect(s.log.some((l) => /\/events$/.test(l.path) && l.status === 200)).toBe(true);
    expect(s.unhandled).toEqual([]);
  });
});

test.describe('變更密碼（fresh-auth：必須提供目前密碼）', () => {
  test('目前密碼錯誤被拒；正確則成功，且「其他裝置」的 family 被撤銷、這個裝置保持登入', async ({ page, request, browser }) => {
    // 另一台裝置（獨立 context）也登入同一帳號
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await loginWithPassword(otherPage);
    await expect(otherPage).toHaveURL(/\/trips/);

    await loginWithPassword(page);
    await expect(page).toHaveURL(/\/trips/);
    await page.goto('/account/password');
    await expect(page.getByTestId('change-password-page')).toBeVisible();

    await page.getByTestId('change-password-current').fill('not-the-password');
    await page.getByTestId('change-password-new').fill('brand-new-pass-9');
    await page.getByTestId('change-password-submit').click();
    await expect(page.getByText('目前密碼不正確')).toBeVisible();
    expect((await apiState(request)).families.filter((f) => f.revoked)).toEqual([]);

    await page.getByTestId('change-password-current').fill(DEMO.password);
    await page.getByTestId('change-password-submit').click();
    await expect(page).toHaveURL(/\/account$/);
    const s = await apiState(request);
    expect(s.families.filter((f) => f.revoked)).toHaveLength(1);
    expect(s.families.filter((f) => !f.revoked)).toHaveLength(1);

    // 這個裝置仍登入（重新整理不被踢）；另一台裝置下次 refresh 就被拒
    await page.goto('/account');
    await expect(page.getByTestId('account-page')).toBeVisible();
    await otherPage.goto('/account');
    await expect(otherPage).toHaveURL(/\/login/);
    await other.close();
  });
});

test.describe('帳號刪除（fresh-auth）', () => {
  test('有密碼：密碼錯誤不刪；密碼正確才刪，刪後憑證全撤銷、無法再登入', async ({ page, request }) => {
    await loginWithPassword(page);
    await expect(page).toHaveURL(/\/trips/);
    await page.goto('/account');
    await page.getByTestId('account-row-delete-account').click();
    await page.getByTestId('delete-account-confirm-input').fill('wrong-password');
    await page.getByTestId('confirm-modal-confirm').click();
    await expect(page.getByText(/密碼/).first()).toBeVisible();
    expect((await apiState(request)).users).toContain(DEMO.email);

    await page.getByTestId('delete-account-confirm-input').fill(DEMO.password);
    await page.getByTestId('confirm-modal-confirm').click();
    await expect(page).toHaveURL(/\/$/);
    const s = await apiState(request);
    expect(s.users).not.toContain(DEMO.email);
    expect(s.families.every((f) => f.revoked)).toBe(true);
    await page.goto('/account');
    await expect(page).toHaveURL(/\/login/);
  });

  test('僅 Google 帳號：必須先經 fresh-auth challenge（導去驗證再回來），沒有就是 403，驗過才刪', async ({ page, request }) => {
    await loginWithGoogle(page);
    await expect(page).toHaveURL(/\/trips/);
    await page.goto('/account');
    await page.getByTestId('account-row-delete-account').click();
    await page.getByTestId('delete-account-confirm-input').fill('DELETE');
    await Promise.all([page.waitForURL(/\/account$/), page.getByTestId('confirm-modal-confirm').click()]);
    // 第一次點只會發起驗證（api 建立 challenge），不會刪除
    expect((await apiState(request)).users).toContain('google@example.test');
    await expect(page.getByTestId('account-page')).toBeVisible();

    await page.getByTestId('account-row-delete-account').click();
    await page.getByTestId('delete-account-confirm-input').fill('DELETE');
    await page.getByTestId('confirm-modal-confirm').click();
    await expect(page).toHaveURL(/\/$/);
    const s = await apiState(request);
    expect(s.users).not.toContain('google@example.test');
    expect(s.families.every((f) => f.revoked)).toBe(true);
  });
});
