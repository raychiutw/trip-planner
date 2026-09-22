import { test, expect } from '@playwright/test';
const { setupApiMocks, MOCK_TRIPS_LIST } = require('./api-mocks');

test('chat keeps its reading position when older history and a new send interleave', async ({ page }) => {
  await setupApiMocks(page);
  const tripId = MOCK_TRIPS_LIST[0].tripId;
  const row = (id) => ({ id, tripId, message: `歷史訊息 ${id}`, status: 'completed',
    reply: `第 ${id} 筆回覆\n\n${'這是原有的對話內容，閱讀歷史時不應突然跳離。\n\n'.repeat(8)}`,
    createdAt: `2026-09-21T01:${id}:00Z`, updatedAt: `2026-09-21T01:${id}:30Z` });
  let releaseOlder;
  let olderCalls = 0;
  await page.route('**/api/account/ai-authorization', (route) => route.fulfill({ json: { authorized: true } }));
  await page.route('**/api/requests**', async (route) => {
    const request = route.request(); const url = new URL(request.url());
    if (request.method() === 'POST') return route.fulfill({ json: { id: 99 } });
    if (url.pathname.endsWith('/events')) return route.fulfill({ contentType: 'text/event-stream', body: 'data: {"status":"processing"}\n\n' });
    if (url.pathname.endsWith('/99')) return route.fulfill({ json: { id: 99, tripId, status: 'processing' } });
    if (url.searchParams.has('before')) {
      olderCalls++;
      await new Promise((resolve) => { releaseOlder = resolve; });
      // Overlapping page boundary must not duplicate request 20.
      return route.fulfill({ json: { items: [20, 19, 18, 17, 16].map(row), hasMore: false } });
    }
    return route.fulfill({ json: { items: [24, 23, 22, 21, 20].map(row), hasMore: true } });
  });
  await page.goto(`/chat?tripId=${tripId}`);
  const body = page.getByTestId('chat-body');
  const anchor = page.getByTestId('chat-msg-user').filter({ hasText: /^歷史訊息 20$/ });
  await expect(anchor).toBeVisible();
  await body.evaluate((element) => { element.scrollTop = 60; });
  await expect.poll(() => olderCalls).toBe(1);
  await page.getByTestId('chat-input').fill('閱讀途中送出的新訊息');
  await page.getByTestId('chat-send').click();
  await expect(page.getByText('閱讀途中送出的新訊息', { exact: true })).toBeAttached();
  const before = await anchor.boundingBox();
  releaseOlder();
  await expect(page.getByText('歷史訊息 16', { exact: true })).toBeAttached();
  await expect(anchor).toHaveCount(1);
  await expect(page.getByTestId('chat-msg-user')).toHaveCount(10);
  await expect.poll(async () => Math.abs((await anchor.boundingBox()).y - before.y)).toBeLessThan(3);
  await expect(page.getByTestId('chat-jump-to-latest')).toBeVisible();
  await page.getByTestId('chat-jump-to-latest').click();
  await expect.poll(() => body.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(2);
});
