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

const TRIP = 'okinawa-trip-2026-Ray';
// 每頁都有已知的玻璃面（桌機 sidebar／titlebar、手機底部 nav、stack 標頭、聊天輸入列…）。
const PAGES = [
  '/trips', '/chat', '/explore', '/favorites', '/account', '/privacy',
  `/trip/${TRIP}/map?day=all`, `/trip/${TRIP}/add-entry`, `/trip/${TRIP}/edit`, `/trip/${TRIP}/collab`,
];
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
      if (!bf || bf === 'none' || bf === 'blur(0px)') continue;
      const r = e.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      const m = cs.backgroundColor.match(/[\d.]+/g) || [];
      const alpha = m.length > 3 ? Number(m[3]) : (cs.backgroundColor === 'transparent' ? 0 : 1);
      const cls = typeof e.className === 'string' ? e.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      out.push({ el: e.tagName.toLowerCase() + (cls ? '.' + cls : ''), bf: bf.slice(0, 32), alpha });
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

async function open(page, path) {
  await page.goto(path);
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
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
  expect(found.map((g) => g.el)).toContain('div');
});

for (const scheme of ['light', 'dark']) {
  for (const [w, h] of VIEWPORTS) {
    test(`一般模式有玻璃面（對照，防掃描恆綠）— ${scheme} ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of PAGES) {
        await open(page, path);
        await expect(page.locator('body')).toHaveClass(scheme === 'dark' ? /dark/ : /^(?!.*dark)/);
        const glass = (await glassElements(page)).filter((g) => g.alpha < 1);
        expect(glass.length, `${path} 一般模式找不到任何玻璃面 — 掃描可能壞了`).toBeGreaterThan(0);
      }
    });

    for (const pref of PREFS) {
      test(`${pref.name}：沒有半透明的玻璃面 — ${scheme} ${w}px`, async ({ page }) => {
        test.setTimeout(90000);
        await page.setViewportSize({ width: w, height: h });
        await page.emulateMedia({ colorScheme: scheme });
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setEmulatedMedia', { features: pref.features });
        const offenders = [];
        for (const path of PAGES) {
          await open(page, path);
          for (const g of (await glassElements(page)).filter((x) => x.alpha < 1)) {
            offenders.push(`${path} | ${g.el} | ${g.bf} | alpha=${g.alpha}`);
          }
        }
        expect([...new Set(offenders)], `${pref.name} 下仍有半透明玻璃面`).toEqual([]);
      });
    }
  }
}
