/**
 * 聊天輸入：Return 換行、⌘Return／Ctrl+Return 送出（比照 App，#1699）。
 * IME 組字中的 Return 一律不送出。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

async function openChat(page) {
  const posts = [];
  await setupApiMocks(page);
  await page.route('**/api/account/ai-authorization', (r) => r.fulfill({ json: { authorized: true } }));
  await page.route('**/api/requests**', (route) => {
    if (route.request().method() === 'POST') {
      posts.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, json: { id: 1, status: 'open' } });
    }
    return route.fallback();
  });
  await page.goto('/chat');
  const input = page.getByTestId('chat-input');
  await expect(input).toBeEnabled();
  return { input, posts };
}

test('Return 只換行，不送出', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑');
  const { input, posts } = await openChat(page);
  await input.fill('第一行');
  await input.press('Enter');
  await input.pressSequentially('第二行');
  await expect(input).toHaveValue('第一行\n第二行');
  expect(posts).toHaveLength(0);
});

for (const mod of ['Meta', 'Control']) {
  test(`${mod}+Return 送出`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑');
    const { input, posts } = await openChat(page);
    await input.fill('確認行程');
    await input.press(`${mod}+Enter`);
    await expect.poll(() => posts.length).toBe(1);
    expect(JSON.stringify(posts[0])).toContain('確認行程');
  });
}

test('IME 組字中 ⌘Return 不送出', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑');
  const { input, posts } = await openChat(page);
  await input.fill('確認行程');
  await input.evaluate((el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, isComposing: true, bubbles: true, cancelable: true })));
  await page.waitForTimeout(300);
  expect(posts).toHaveLength(0);
});
