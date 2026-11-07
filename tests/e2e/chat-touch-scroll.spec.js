/**
 * AI 聊天頁的觸控捲動（iPhone 往下拖看較早訊息）。
 *
 * 症狀：手機上聊天視窗「無法滑動」。AppShell 的 usePullToRefresh 掛在 <main>（scrollTop 恆為 0），
 * 聊天頁的訊息清單是內層 scroller（.tp-chat-body）。往下拖看歷史時，touch 起點在內層 scroller，
 * 卻被當成 <main> 的下拉刷新：整頁被拉下，放開後沒登記 refetch 的頁面 fall back 整頁 reload，
 * 捲動位置被洗回最底。滑鼠滾輪不經 touch 事件，所以桌機看不出來。
 *
 * 用 CDP 的 synthesizeScrollGesture 送真正的觸控手勢（Playwright 沒有 swipe API；WebKit 無法用，
 * 所以只在 chromium 跑）。對照：同一個手勢打一個普通可捲容器要能捲，證明手勢本身有效。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks, MOCK_TRIPS_LIST } = require('./api-mocks');

test('chat: touch drag down scrolls older messages without pull-to-refresh reload', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP 觸控手勢只在 chromium 可用');
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3,
  });
  const page = await ctx.newPage();
  await setupApiMocks(page);
  const tripId = MOCK_TRIPS_LIST[0].tripId;
  const row = (id) => ({ id, tripId, message: `歷史訊息 ${id}`, status: 'completed',
    reply: `第 ${id} 筆回覆\n\n${'這是原有的對話內容，需要足夠長才能捲動。\n\n'.repeat(8)}`,
    createdAt: `2026-09-21T01:${String(id).padStart(2, '0')}:00Z`, updatedAt: `2026-09-21T01:${String(id).padStart(2, '0')}:30Z` });
  await page.route('**/api/account/ai-authorization', (r) => r.fulfill({ json: { authorized: true } }));
  await page.route(/\/api\/trips\/[^/]+\/ai-authorization$/, (r) => r.fulfill({ json: { ownerAuthorized: true, isOwner: true } }));
  await page.route('**/api/requests**', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('before')) return route.fulfill({ json: { items: [], hasMore: false } });
    return route.fulfill({ json: { items: [14, 13, 12, 11, 10].map(row), hasMore: false } });
  });
  await page.goto(`/chat?tripId=${tripId}`);
  await expect(page.getByTestId('chat-body').getByText('歷史訊息 14', { exact: true })).toBeVisible();
  const cdp = await ctx.newCDPSession(page);
  const body = page.getByTestId('chat-body');
  const swipeDown = async (loc) => {
    const b = await loc.boundingBox();
    // CDP：yDistance 為正＝內容往下（看較早內容）＝手指往下拖
    await cdp.send('Input.synthesizeScrollGesture', { x: b.x + b.width / 2, y: b.y + b.height / 2, yDistance: 400, gestureSourceType: 'touch', speed: 800 });
    await page.waitForTimeout(600);
  };

  // 對照：普通可捲容器放在中段，同一個手勢要能往上捲，證明手勢本身有效
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.id = 'ctl'; d.style.cssText = 'position:fixed;left:10px;top:60px;width:200px;height:200px;overflow:auto;z-index:99999;background:#fff';
    d.innerHTML = '<div style="height:3000px">control</div>';
    document.body.appendChild(d);
    d.scrollTop = 1500;
  });
  const ctl = page.locator('#ctl');
  const ctlBefore = await ctl.evaluate((el) => el.scrollTop);
  await swipeDown(ctl);
  expect(await ctl.evaluate((el) => el.scrollTop), '對照容器：手勢本身要能捲動').toBeLessThan(ctlBefore - 200);
  await page.evaluate(() => document.getElementById('ctl').remove());

  // 聊天：把清單放到中段，數頁面載入次數，再做同一個手勢
  await body.evaluate((el) => { el.scrollTop = 1500; });
  await page.waitForTimeout(400);
  let loads = 0;
  page.on('load', () => { loads += 1; });
  const before = await body.evaluate((el) => el.scrollTop);
  await swipeDown(body);
  const after = await body.evaluate((el) => el.scrollTop);

  expect(loads, '下拖看歷史不該觸發整頁重新載入（pull-to-refresh 誤判）').toBe(0);
  expect(after, '清單要往上捲（scrollTop 減少），不能被洗回最底').toBeLessThan(before - 200);
  expect(await page.locator('.app-shell-main').evaluate((el) => el.style.transform), '<main> 不該被下拉位移').toBe('');
  await ctx.close();
});
