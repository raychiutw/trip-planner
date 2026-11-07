/**
 * AI 聊天輸入列的玻璃（owner 選 A3：不透明度 55%、模糊 24px）。
 *
 * 原本是 92% 不透明＋blur(14px)：玻璃技術上存在，但只透出 8%，看起來和實心一樣。
 * 看 computed style 而不是原始碼：同一個 token 在瀏覽器端可能被降級或蓋掉（見 glass-degrade.spec.js）。
 * 輸入框本身維持實心底色（文字可讀性不受透明度影響）。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

for (const scheme of ['light', 'dark']) {
  test(`chat composer glass is visibly translucent · ${scheme}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑');
    await page.emulateMedia({ colorScheme: scheme });
    await setupApiMocks(page);
    await page.route('**/api/account/ai-authorization', (r) => r.fulfill({ json: { authorized: true } }));
    await page.goto('/chat');
    const composer = page.locator('.tp-chat-composer');
    await expect(composer).toBeVisible();
    const s = await composer.evaluate((el) => {
      const cs = getComputedStyle(el);
      const input = getComputedStyle(document.querySelector('.tp-chat-input'));
      return { filter: cs.backdropFilter, bg: cs.backgroundColor, inputBg: input.backgroundColor, inputFilter: input.backdropFilter };
    });
    expect(s.filter).toBe('blur(24px)');
    const alpha = Number(/\/\s*([\d.]+)\)/.exec(s.bg)?.[1]);
    expect(alpha, `輸入列底色 ${s.bg}`).toBeGreaterThan(0.5);
    expect(alpha, `輸入列底色 ${s.bg}`).toBeLessThan(0.6);
    // 輸入框本身是實心：沒有 alpha 通道（rgb(...)），文字可讀性不受影響
    expect(s.inputBg, '輸入框維持實心底色').toMatch(/^rgb\(/);
  });
}

// 值對不代表有玻璃：backdrop-filter 要有東西可折射。訊息區必須延伸到 composer（與 tab 膠囊）底下，
// 且留足 padding-bottom 讓最後一則訊息不被蓋住；否則 composer 底下只是純色，看起來和實心一樣。
test('chat messages extend underneath the composer so the glass has something to refract', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑');
  await setupApiMocks(page);
  await page.route('**/api/account/ai-authorization', (r) => r.fulfill({ json: { authorized: true } }));
  await page.goto('/chat');
  const composer = page.locator('.tp-chat-composer');
  await expect(composer).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.querySelector('.tp-chat-shell').style.getPropertyValue('--chat-composer-h')), { message: 'ResizeObserver 要先把 dock 高度寫進 --chat-composer-h' }).not.toBe('');
  const m = await page.evaluate(() => {
    const c = document.querySelector('.tp-chat-composer').getBoundingClientRect();
    const bodyEl = document.querySelector('.tp-chat-body');
    const b = bodyEl.getBoundingClientRect();
    return { composerTop: c.top, composerBottom: c.bottom, composerH: c.height, bodyBottom: b.bottom, bodyPadB: parseFloat(getComputedStyle(bodyEl).paddingBottom) };
  });
  expect(m.bodyBottom, '訊息區底緣要在 composer 底緣之下（延伸到它底下）').toBeGreaterThanOrEqual(m.composerBottom - 1);
  expect(m.bodyBottom, '訊息區底緣要在 composer 頂緣之下').toBeGreaterThan(m.composerTop);
  expect(m.bodyPadB, '底部留白至少要容得下 composer，最後一則訊息才不會被蓋住').toBeGreaterThanOrEqual(m.composerH);
});

// Value: protects=composer 隨 textarea 長高時，訊息區底部留白同步增加，最後一則訊息不被蓋住; fails_when=ResizeObserver 沒掛上或 apply 不再更新 --chat-composer-h; why_new=上一條 e2e 只量初始高度; seam=none; no_claim=不含軟鍵盤彈出
test('chat body bottom padding follows the composer as the textarea grows', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑');
  await setupApiMocks(page);
  await page.route('**/api/account/ai-authorization', (r) => r.fulfill({ json: { authorized: true } }));
  await page.goto('/chat');
  const input = page.locator('.tp-chat-input');
  await expect(input).toBeVisible();
  const read = () => page.evaluate(() => {
    const c = document.querySelector('.tp-chat-composer');
    const b = document.querySelector('.tp-chat-body');
    return { h: c.getBoundingClientRect().height, padB: parseFloat(getComputedStyle(b).paddingBottom), v: parseFloat(getComputedStyle(c.parentElement).getPropertyValue('--chat-composer-h')) };
  });
  const before = await read();
  await input.fill(['一', '二', '三', '四', '五'].join('\n'));
  await expect.poll(async () => (await read()).h, { message: 'textarea 應該把 composer 撐高' }).toBeGreaterThan(before.h);
  await expect.poll(async () => { const m = await read(); return Math.abs(m.v - m.h) < 1; }, { message: '--chat-composer-h 要追上 composer 高度' }).toBe(true);
  const after = await read();
  expect(after.padB, '留白要跟著增加').toBeGreaterThan(before.padB);
  expect(after.padB).toBeGreaterThanOrEqual(after.h);
});

// Value: protects=手機上 composer 停在 tab 膠囊正上方、不被膠囊蓋住; fails_when=--chat-bottom-inset 不再包含 --nav-overlay-h（回到被 tab 蓋住）; why_new=桌機 e2e 的 nav-overlay-h 是 0; seam=none; no_claim=不含真機 safe-area 與軟鍵盤
test('chat composer sits above the tab pill on a phone-width viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑');
  await page.setViewportSize({ width: 390, height: 844 });
  await setupApiMocks(page);
  await page.route('**/api/account/ai-authorization', (r) => r.fulfill({ json: { authorized: true } }));
  await page.goto('/chat');
  const composer = page.locator('.tp-chat-composer');
  const nav = page.locator('.tp-global-bottom-nav');
  await expect(composer).toBeVisible();
  await expect(nav).toBeVisible();
  await expect.poll(async () => {
    const c = await composer.boundingBox();
    const n = await nav.boundingBox();
    return n.y - (c.y + c.height);
  }, { message: 'composer 底緣要在 tab 膠囊頂緣之上（間距 >= -1）' }).toBeGreaterThanOrEqual(-1);
});

// Value: protects=旅伴看到「請擁有者授權」提示時它貼在 composer 正上方、沒被浮動的 composer 蓋住; fails_when=.tp-chat-owner-banner 的定位被拿掉; why_new=unit 測試只驗元素存在不驗位置; seam=none; no_claim=不含提示文字內容
test('owner-authorization banner sits directly above the floating composer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑');
  await setupApiMocks(page);
  await page.route('**/api/account/ai-authorization', (r) => r.fulfill({ json: { authorized: true } }));
  await page.route('**/api/trips/*/ai-authorization', (r) => r.fulfill({ json: { ownerAuthorized: false, isOwner: false } }));
  await page.goto('/chat');
  const banner = page.getByTestId('chat-owner-unauthorized');
  const composer = page.locator('.tp-chat-composer');
  await expect(banner).toBeVisible();
  await expect.poll(async () => {
    const b = await banner.boundingBox();
    const c = await composer.boundingBox();
    return c.y - (b.y + b.height);
  }, { message: '提示條要貼著 composer（含它本身 8px 的 margin），不是飄在別處' }).toBeGreaterThanOrEqual(-1);
  const b = await banner.boundingBox();
  const c = await composer.boundingBox();
  expect(c.y - (b.y + b.height), '間距不超過 margin 加一點誤差').toBeLessThanOrEqual(12);
  // 提示條屬於 dock：訊息區底部留白必須連提示條一起蓋住，最後一則訊息才不會被提示條擋住。
  const padB = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.tp-chat-body')).paddingBottom));
  const dockH = await page.evaluate(() => document.querySelector('.tp-chat-dock').getBoundingClientRect().height);
  expect(dockH, 'dock 要比單獨的 composer 高（含提示條）').toBeGreaterThan(c.height);
  expect(padB, '留白要涵蓋 dock（提示條＋composer）').toBeGreaterThanOrEqual(dockH);
});

// Value: protects=使用者在底部輸入多行、composer 長高後，最新一則訊息仍貼著可視底部不被蓋住; fails_when=ResizeObserver 回呼不再把捲動位置釘回底部（QA 實測缺陷：長高 102px 後最新一則被 composer 蓋住）; why_new=前面只量留白、沒量捲動位置; seam=none; no_claim=不含軟鍵盤
test('chat stays pinned to the newest message when the composer grows', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑');
  await setupApiMocks(page);
  await page.route('**/api/account/ai-authorization', (r) => r.fulfill({ json: { authorized: true } }));
  await page.goto('/chat');
  const input = page.locator('.tp-chat-input');
  await expect(input).toBeVisible();
  await page.waitForLoadState('networkidle'); // 等歷史載入完，避免它之後的初始捲動蓋掉我們塞的填充
  // mock 的歷史可能不夠長：塞一段高的填充，讓訊息區一定能捲動（React 不會移除不認識的節點）。
  await page.evaluate(() => {
    const body = document.querySelector('.tp-chat-body');
    const filler = document.createElement('div');
    filler.style.cssText = 'flex:none;height:2000px';
    body.appendChild(filler);
    body.scrollTop = body.scrollHeight;
  });
  const dist = () => page.evaluate(() => { const b = document.querySelector('.tp-chat-body'); return Math.round(b.scrollHeight - b.scrollTop - b.clientHeight); });
  await expect.poll(dist, { message: '先確認一開始就貼底' }).toBeLessThanOrEqual(1);
  const h0 = await page.locator('.tp-chat-composer').evaluate((el) => el.getBoundingClientRect().height);
  await input.fill(['一', '二', '三', '四', '五'].join('\n'));
  // 等 ResizeObserver 把新高度寫進 --chat-composer-h，然後「立刻讀一次」：不用會重試的 poll，
  // 否則別的事件（歷史載入晚到）剛好把捲動位置拉回底部時，會遮住「沒有重新釘底」的缺陷。
  await page.waitForFunction((h) => {
    const dock = document.querySelector('.tp-chat-dock');
    const v = parseFloat(document.querySelector('.tp-chat-shell').style.getPropertyValue('--chat-composer-h'));
    return dock.getBoundingClientRect().height > h && Math.abs(v - dock.getBoundingClientRect().height) < 1;
  }, h0);
  expect(await dist(), 'composer 長高後，量測更新的當下仍要貼底').toBeLessThanOrEqual(2);
});
