/**
 * AI 聊天頁的下拉刷新誤判（iPhone 往下拖看較早訊息，聊天視窗「無法滑動」）。
 *
 * 症狀：AppShell 的 usePullToRefresh 掛在 <main>（scrollTop 恆為 0），聊天頁的訊息清單是內層
 * scroller（.tp-chat-body）。往下拖看歷史時，touch 起點在內層 scroller，卻被當成 <main> 的下拉刷新：
 * 整頁被拉下，放開後沒登記 refetch 的頁面 fall back 整頁 reload，捲動位置被洗回最底。
 * 滑鼠滾輪不經 touch 事件，所以桌機看不出來。
 *
 * 為什麼直接送 TouchEvent、不用 CDP 的 synthesizeScrollGesture：後者在 CI 的 Chromium 上不可靠
 * （連對照容器都不捲，PR #1617 的第一版因此在 CI 紅）。bug 的機制就是下拉刷新監聽器對
 * touchstart／touchmove／touchend 的反應，直接送這組事件給真實的 AppShell 與聊天頁，
 * 確定性高，未修正時一定紅（頁面載入 1 次、<main> 被位移）。
 * 內層 scroller 是否真的往上捲由瀏覽器負責，不在這裡測。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks, MOCK_TRIPS_LIST } = require('./api-mocks');

async function openChat(page) {
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
}

/** 在 selector 的元素上送一次完整的下拖：起點 y=100、拖到 y=300（過下拉刷新門檻），放開。 */
function dragDown(page, selector) {
  return page.evaluate((sel) => {
    const target = document.querySelector(sel);
    const fire = (type, y) => {
      const touch = new Touch({ identifier: 1, target, clientX: 200, clientY: y });
      const live = type === 'touchend' ? [] : [touch];
      target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: live, targetTouches: live, changedTouches: [touch] }));
    };
    fire('touchstart', 100);
    fire('touchmove', 200);
    fire('touchmove', 300);
    fire('touchend', 300);
  }, selector);
}

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑'); });

const MOBILE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 };

test('chat: 內層清單已捲離頂端時，下拖看歷史不觸發下拉刷新（不位移、不重新載入）', async ({ browser }) => {
  const ctx = await browser.newContext(MOBILE);
  const page = await ctx.newPage();
  await openChat(page);
  const body = page.getByTestId('chat-body');
  await body.evaluate((el) => { el.scrollTop = 1500; });
  await page.waitForTimeout(400);
  expect(await body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

  let loads = 0;
  page.on('load', () => { loads += 1; });
  await dragDown(page, '.tp-chat-msg');
  await page.waitForTimeout(1500); // 誤觸發的 reload 發生在 touchend 之後
  expect(loads, '下拖看歷史不該觸發整頁重新載入（下拉刷新誤判）').toBe(0);
  expect(await page.locator('.app-shell-main').evaluate((el) => el.style.transform), '<main> 不該被下拉位移').toBe('');
  await ctx.close();
});

test('chat: 內層清單在最頂端時，下拖仍可下拉刷新（既有行為不變）', async ({ browser }) => {
  const ctx = await browser.newContext(MOBILE);
  const page = await ctx.newPage();
  await openChat(page);
  const body = page.getByTestId('chat-body');
  await body.evaluate((el) => { el.scrollTop = 0; });
  await page.waitForTimeout(400);

  const moved = [];
  await page.exposeFunction('__rec', (v) => moved.push(v));
  await page.evaluate(() => {
    const m = document.querySelector('.app-shell-main');
    new MutationObserver(() => window.__rec(m.style.transform || '')).observe(m, { attributes: true, attributeFilter: ['style'] });
  });
  await dragDown(page, '.tp-chat-msg');
  await expect.poll(() => moved.some((v) => v.startsWith('translateY(')), { timeout: 3000 }).toBe(true);
  await ctx.close();
});
