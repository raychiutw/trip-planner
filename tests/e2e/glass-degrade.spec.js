// @ts-check
/**
 * 玻璃面降級守衛（#1422）：使用者開「降低透明度」或「提高對比」時，**所有**玻璃面
 * （任何會渲染 backdrop-filter 的元素）都要改為不透明底、無模糊。
 *
 * 整 app 不變量，不是逐元件登記：掃每頁所有元素的 computed style，只要還有「可見、
 * 背景 alpha < 1、backdrop-filter 非 none」就紅。新增的玻璃面自動被涵蓋。
 *
 * 為什麼看 computed style、不 grep 原始碼：2026-10 發現降級「字面存在、實際失效」——
 * `--tabbar-*` 定義在 body、降級只覆寫 :root，子元素繼承的是 body 的值，:root 的覆寫是死碼；
 * 另有多處硬寫的 backdrop-filter 不走 token。原始碼 grep 全綠、瀏覽器裡完全沒降級
 * （與 Tailwind @theme 被 tree-shake 同類：原始碼有、瀏覽器沒有）。
 *
 * Playwright 的 emulateMedia 沒有 reducedTransparency，要走 CDP Emulation.setEmulatedMedia。
 *
 * ponytail: 只掃預設狀態（開著的 sheet／dialog／hover 不掃）；地圖頁在 localhost 會因
 * Google Maps referer 進 error boundary，這裡擋掉 maps script（同 CI），所以地圖卡片走的是
 * 擋掉 script 後的 fallback 版面。要更嚴再補互動狀態。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

// 只在 chromium 專案跑：用到 CDP（Emulation.setEmulatedMedia）／以固定 viewport 自行量版面；
// master CI 的 mobile-chrome／mobile-safari 矩陣不該為這些測試製造噪音（PR 只跑 chromium）。
test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑'); });
// 各測試彼此獨立，允許 CI 的兩個 worker 分攤（每個測試走 24 頁，單 worker 約 8 分鐘）。
test.describe.configure({ mode: 'parallel' });

const TRIP = 'okinawa-trip-2026-Ray';
// 登入後的頁面：每頁都有已知的玻璃面（桌機 sidebar／titlebar、手機底部 nav、stack 標頭、聊天輸入列…）。
const PAGES = [
  '/trips', '/chat', '/explore', '/favorites', '/privacy',
  '/account', '/account/appearance', '/account/notifications', '/account/sessions', '/account/connected-apps',
  `/trip/${TRIP}/map?day=all`, `/trip/${TRIP}/add-entry`, `/trip/${TRIP}/add-stop`, `/trip/${TRIP}/edit`,
  `/trip/${TRIP}/collab`, `/trip/${TRIP}/health`, `/trip/${TRIP}/notes`,
  `/trip/${TRIP}/stop/101/edit`, `/trip/${TRIP}/stop/101/copy`, `/trip/${TRIP}/stop/101/move`, `/trip/${TRIP}/stop/101/change-poi`,
].map((p) => ({ p, anon: false, expectGlass: true }));
// 匿名頁面（userinfo 回 401）：落地頁的頂列是玻璃面（LandingPage），過去只有原始碼證據、沒有執行期驗證；
// 登入／註冊沒有玻璃面，但仍要掃，確保日後新增時也被涵蓋。
const ANON_PAGES = [
  { p: '/', anon: true, expectGlass: true },
  { p: '/login', anon: true, expectGlass: false },
  { p: '/signup', anon: true, expectGlass: false },
];
const ALL_PAGES = [...PAGES, ...ANON_PAGES];
const VIEWPORTS = [[390, 844], [1440, 900]];
const PREFS = [
  { name: 'reduced-transparency', features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] },
  { name: 'prefers-contrast', features: [{ name: 'prefers-contrast', value: 'more' }] },
];

/** 回傳目前頁面上「可見、有 backdrop-filter、背景半透明」的元素描述。 */
async function glassElements(page) {
  return page.evaluate(() => {
    const out = [];
    for (const e of document.querySelectorAll('*')) {
      const cs = getComputedStyle(e);
      const bf = cs.backdropFilter || cs.webkitBackdropFilter;
      // blur(0px) 也算：它代表「模糊關了但這仍是玻璃面」，若底還是半透明就是沒降級乾淨。
      if (!bf || bf === 'none') continue;
      const r = e.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      const m = cs.backgroundColor.match(/[\d.]+/g) || [];
      const alpha = m.length > 3 ? Number(m[3]) : (cs.backgroundColor === 'transparent' ? 0 : 1);
      const cls = typeof e.className === 'string' ? e.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      out.push({ el: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (cls ? '.' + cls : ''), bf: bf.slice(0, 32), alpha });
    }
    return out;
  });
}

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
  await page.route(/maps\.googleapis\.com/, (r) => r.abort());
  await page.route('**/api/route**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ polyline: [], duration: null, distance: 0, approx: true }),
  }));
});

async function open(page, path, anon = false) {
  if (anon) {
    await page.route(/\/api\/oauth\/userinfo$/, (r) => r.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
    // LandingPage 用 localStorage 裡的「上次已登入」提示做樂觀轉址（先逛過登入後頁面就直接轉去 /trips、
    // 根本不渲染落地頁）。匿名頁面要先清掉，否則 `/` 的玻璃頂列從沒被驗到——一般模式的對照案例就是抓到這個。
    await page.addInitScript(() => { try { localStorage.clear(); } catch { /* ignore */ } });
  }
  await page.goto(path);
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(600);
  // 匿名頁必須真的停在該路由（沒被「上次已登入」提示或其他轉址帶走），否則玻璃面從沒被驗到。
  // 每一頁都要真的停在該路由——被轉走（或落到別的玻璃頁）會讓對照與降級掃描都空洞通過。
  expect(new URL(page.url()).pathname, `${path} 被轉址走了`).toBe(path.split('?')[0]);
  // 頁面真的載入了（不是 error boundary／空白頁）才算數。
  await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
  expect((await page.locator('body').innerText()).length, `${path} 空白頁`).toBeGreaterThan(15);
}

test('自我檢查：掃描函式抓得到植入的玻璃元素', async ({ page }) => {
  await page.goto('/privacy');
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.id = 'glass-canary';
    d.style.cssText = 'position:fixed;top:0;left:0;width:50px;height:50px;background:rgba(255,255,255,.4);backdrop-filter:blur(20px)';
    document.body.appendChild(d);
  });
  const found = (await glassElements(page)).filter((g) => g.alpha < 1);
  expect(found.map((g) => g.el), '掃描函式抓不到植入的 #glass-canary').toContain('div#glass-canary');
});

for (const scheme of ['light', 'dark']) {
  for (const [w, h] of VIEWPORTS) {
    test(`一般模式有玻璃面（對照，防掃描恆綠）— ${scheme} ${w}px`, async ({ page }) => {
      test.setTimeout(180000);
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: scheme });
      for (const { p: path, anon, expectGlass } of ALL_PAGES) {
        await open(page, path, anon);
        await expect(page.locator('body')).toHaveClass(scheme === 'dark' ? /dark/ : /^(?!.*dark)/);
        if (!expectGlass) continue;
        const glass = (await glassElements(page)).filter((g) => g.alpha < 1);
        expect(glass.length, `${path} 一般模式找不到任何玻璃面 — 掃描可能壞了`).toBeGreaterThan(0);
      }
    });

    for (const pref of PREFS) {
      test(`${pref.name}：沒有半透明的玻璃面 — ${scheme} ${w}px`, async ({ page }) => {
        test.setTimeout(180000);
        await page.setViewportSize({ width: w, height: h });
        await page.emulateMedia({ colorScheme: scheme });
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setEmulatedMedia', { features: pref.features });
        // 模擬真的生效了——否則失敗訊息會指向玻璃面、而不是模擬沒套用。
        const feat = pref.features[0];
        expect(await page.evaluate((f) => matchMedia(`(${f.name}: ${f.value})`).matches, feat), `${feat.name} 模擬沒生效`).toBe(true);
        const offenders = [];
        for (const { p: path, anon } of ALL_PAGES) {
          await open(page, path, anon);
          if (path === '/explore') {
            // 探索頁的愛心／加入鈕是圖片上的 scrim：降級時只拿掉模糊不夠，底也要不透明（若畫面上有）。
            const scrims = await page.evaluate(() => [...document.querySelectorAll('.explore-poi-heart')].map((e) => getComputedStyle(e).backgroundColor));
            for (const bg of scrims) {
              const m = bg.match(/[\d.]+/g) || [];
              if (m.length > 3 && Number(m[3]) < 1) offenders.push(`${path} | .explore-poi-heart | scrim 仍半透明 ${bg}`);
            }
          }
          for (const g of (await glassElements(page)).filter((x) => x.alpha < 1)) {
            offenders.push(`${path} | ${g.el} | ${g.bf} | alpha=${g.alpha}`);
          }
        }
        expect([...new Set(offenders)], `${pref.name} 下仍有半透明玻璃面`).toEqual([]);
      });
    }
  }
}
