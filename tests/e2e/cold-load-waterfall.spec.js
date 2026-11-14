// @ts-check
/**
 * 冷載入瀑布的時序守門（#1691）。執行：npx playwright test -c playwright.newapi.config.js
 *
 * 真 auth client（DPoP、refresh 輪替）對 fake-new-api，再以 page.route 對每個 api 請求注入固定延遲 L，
 * 模擬 production 的慢請求。登入後重新整理 /account，斷言：
 *   - 殼層與骨架遠早於資料（第一個 token 回來之前就在畫面上），且骨架階段沒有任何使用者資料
 *   - 資料就緒只有兩個階段（token → 其餘並行），不再有 userinfo
 *   - token 之後的請求幾乎同時發出（不是一個等一個）
 * 過去（#1691 基準）是 token → userinfo → userinfo＋其餘 → my-trips 的 4 個階段。
 */
import { test, expect } from '@playwright/test';

const API = 'http://localhost:3102';
const L = 1500; // 每個 api 請求固定延遲（ms）
const DEMO = { email: 'demo@example.test', password: 'correct-horse-1' };

test.beforeEach(async ({ request }) => { await request.post(`${API}/__fake/reset`); });

async function loginThenArmDelay(page) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(DEMO.email);
  await page.getByTestId('login-password').fill(DEMO.password);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/trips/);
  /** @type {{ path: string, start: number, end: number }[]} */
  const log = [];
  await page.route(`${API}/api/**`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.continue(); // 預檢不計延遲
    const rec = { path: new URL(route.request().url()).pathname, start: Date.now(), end: 0 };
    log.push(rec);
    await new Promise((r) => setTimeout(r, L));
    const resp = await route.fetch();
    rec.end = Date.now();
    await route.fulfill({ response: resp });
  });
  return log;
}

/** 關鍵路徑深度：B 在 A 結束後才開始 ⇒ B 排在 A 之後。 */
function depthOf(log) {
  const sorted = [...log].sort((a, b) => a.start - b.start);
  const depth = [];
  sorted.forEach((r, i) => { depth[i] = 1 + Math.max(0, ...sorted.slice(0, i).map((p, j) => (p.end <= r.start ? depth[j] : 0))); });
  return Math.max(0, ...depth);
}

async function measure(page, log) {
  const t0 = Date.now();
  await page.goto('/account', { waitUntil: 'commit' });
  const at = async (fn) => { await fn(); return Date.now() - t0; };
  const shell = await at(() => page.getByTestId('account-page').waitFor({ state: 'visible' }));
  const skeleton = await page.evaluate(() => ({
    skeletons: document.querySelectorAll('.tp-account-skeleton').length,
    text: document.body.textContent ?? '',
  }));
  const user = await at(() => expect(page.getByTestId('account-hero')).toContainText(DEMO.email, { timeout: 15000 }));
  const data = await at(async () => {
    await expect(page.getByTestId('account-hero')).toContainText('45', { timeout: 15000 });
    await expect(page.getByText('假行程').first()).toContainText('假行程', { timeout: 15000 });
  });
  return { shell, skeleton, user, data, t0 };
}

test.describe(`冷載入時序（每個請求 +${L}ms）`, () => {
  test('有 id_token：殼層先於 token、無 userinfo、資料只花 token + 一輪並行', async ({ page }) => {
    test.setTimeout(60000);
    const log = await loginThenArmDelay(page);
    const m = await measure(page, log);
    const paths = log.map((r) => r.path);
    const rel = [...log].sort((a, b) => a.start - b.start).map((r) => `${r.path}@${r.start - m.t0}-${r.end - m.t0}`);
    console.info(`[cold-load e2e] shell=${m.shell}ms user=${m.user}ms data=${m.data}ms stages=${depthOf(log)} :: ${rel.join(' ')}`);

    expect(m.shell).toBeLessThan(L); // 殼層在第一個 token 回應之前就出現
    expect(m.skeleton.skeletons).toBeGreaterThan(0); // 是骨架，不是空白
    expect(m.skeleton.text).not.toContain(DEMO.email);
    expect(paths.filter((p) => p === '/api/oauth/userinfo')).toHaveLength(0);
    expect(paths.filter((p) => p === '/api/oauth/token')).toHaveLength(1);
    expect(depthOf(log)).toBeLessThanOrEqual(2);
    // token 之後的請求同時發出
    const after = log.filter((r) => r.path !== '/api/oauth/token').map((r) => r.start);
    expect(after.length).toBeGreaterThanOrEqual(4);
    expect(Math.max(...after) - Math.min(...after)).toBeLessThan(L / 2);
    expect(m.data).toBeLessThan(2 * L + 1200); // 過去約 4L
  });

  test('沒有 id_token（落回 userinfo）：userinfo 只一次、最多三個階段', async ({ page, request }) => {
    test.setTimeout(60000);
    await request.post(`${API}/__fake/no-id-token`);
    const log = await loginThenArmDelay(page);
    const m = await measure(page, log);
    console.info(`[cold-load e2e no-id_token] shell=${m.shell}ms data=${m.data}ms stages=${depthOf(log)}`);
    expect(log.filter((r) => r.path === '/api/oauth/userinfo')).toHaveLength(1);
    expect(depthOf(log)).toBeLessThanOrEqual(3);
    expect(m.shell).toBeLessThan(L);
  });
});
