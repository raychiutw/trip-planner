// @ts-check
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
  // WebKit cannot grant clipboard permissions; keep the page interaction real.
  await page.addInitScript(() => {
    let copied = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value) => { copied = value; },
        readText: async () => copied,
      },
    });
  });
});

test('500 內容錯誤狀態可用鍵盤重試，成功後焦點回到 TitleBar action', async ({ page }) => {
  let loads = 0;
  await page.route('**/api/dev/apps', (route) => {
    loads += 1;
    return route.fulfill({
      status: loads === 1 ? 500 : 200,
      contentType: 'application/json',
      body: loads === 1
        ? JSON.stringify({ error: { code: 'SYS_ERROR', message: 'failed' } })
        : JSON.stringify({ apps: [{ client_id: 'tp_app', app_name: 'Travel App', client_type: 'public', redirect_uris: [], allowed_scopes: ['openid'], status: 'active', created_at: '2026-09-26T00:00:00Z', updated_at: '2026-09-26T00:00:00Z' }] }),
    });
  });
  await page.goto('/developer/apps');
  await expect(page.getByTestId('dev-apps-error')).toContainText('請重試');
  await expect(page.getByTestId('dev-apps-content').getByTestId('dev-apps-error')).toBeVisible();
  const retry = page.getByTestId('dev-apps-error').getByRole('button', { name: '重試' });
  await expect(retry).toBeVisible();
  await expect(page.getByTestId('dev-apps-content').getByRole('button', { name: '返回帳號' })).toBeVisible();
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('dev-apps-row-tp_app')).toContainText('Travel App');
  await expect(page.getByTestId('dev-apps-error')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '建立新應用' })).toBeFocused();
  expect(loads).toBe(2);
});

test('403 顯示無權且不引導建立，返回帳號可由鍵盤操作', async ({ page }) => {
  await page.route('**/api/dev/apps', (route) => route.fulfill({
    status: 403,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 'AUTH_FORBIDDEN', message: 'forbidden' } }),
  }));
  await page.goto('/developer/apps');
  await expect(page.getByTestId('dev-apps-error')).toContainText('沒有權限');
  await expect(page.getByTestId('dev-apps-content').getByTestId('dev-apps-error')).toHaveCount(0);
  await expect(page.getByTestId('dev-apps-error')).toBeVisible();
  expect(await page.getByTestId('dev-apps-error').evaluate((banner) => {
    const titlebar = document.querySelector('[data-testid="titlebar"]');
    const content = document.querySelector('[data-testid="dev-apps-content"]');
    return banner.parentElement === titlebar?.parentElement
      && Boolean(titlebar.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING)
      && Boolean(banner.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  await expect(page.getByRole('button', { name: '建立新應用' })).toHaveCount(0);
  await expect(page.getByTestId('titlebar').getByRole('button')).toHaveCount(1);
  const back = page.getByTestId('titlebar').getByRole('button', { name: '返回' });
  await back.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/account$/);
});

test('空 registry 的建立入口可用鍵盤前往表單', async ({ page }) => {
  await page.route('**/api/dev/apps', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ apps: [] }),
  }));
  await page.goto('/developer/apps');
  await expect(page.getByTestId('dev-apps-empty')).toBeVisible();
  const create = page.getByRole('button', { name: '建立新應用' });
  await expect(create).toHaveAttribute('title', '建立新應用');
  await create.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/developer\/apps\/new$/);
});

test('C 卡片清單在窄寬螢幕完整顯示並可用鍵盤複製每筆 URI', async ({ page }) => {
  const firstUri = 'https://example.com/a/very/long/path/to/the/oauth/callback/endpoint/for/tripline';
  const secondUri = 'https://accounts.example.com/integrations/tripline/another/long/callback/path';
  await page.route('**/api/dev/apps', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ apps: [
      { client_id: 'tp_long', app_name: 'A very long developer application name for a travel integration with many words and no clear short form', client_type: 'public', redirect_uris: [firstUri, secondUri], allowed_scopes: ['openid'], status: 'active', created_at: '2026-09-26T00:00:00Z', updated_at: '2026-09-26T00:00:00Z', client_secret: 'tps-never-render-this' },
      { client_id: 'tp_empty', app_name: 'Empty URI app', client_type: 'public', redirect_uris: [], allowed_scopes: ['openid'], status: 'pending_review', created_at: '2026-09-26T00:00:00Z', updated_at: '2026-09-26T00:00:00Z' },
    ] }),
  }));
  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    if (width === 320) await page.goto('/developer/apps');
    const card = page.getByTestId('dev-apps-row-tp_long');
    await expect(card).toContainText(firstUri);
    await expect(card).toContainText(secondUri);
    await expect(page.getByTestId('dev-apps-row-tp_empty')).toContainText('尚未設定');
    await expect(page.getByTestId('developer-apps-page')).not.toContainText('tps-never-render-this');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  const secondCopy = page.getByTestId('dev-apps-row-tp_long').getByRole('button').nth(1);
  await secondCopy.focus();
  await page.keyboard.press('Enter');
  await expect(secondCopy).toContainText('已複製');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(secondUri);
});

test('200 回應混合有效與異常舊 URI 資料時，其他應用仍可讀可複製', async ({ page }) => {
  const validUri = 'https://example.com/oauth/callback';
  const common = { client_type: 'public', allowed_scopes: ['openid'], status: 'active', created_at: '2026-09-26T00:00:00Z', updated_at: '2026-09-26T00:00:00Z' };
  await page.route('**/api/dev/apps', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ apps: [
      { ...common, client_id: 'tp_valid', app_name: 'Valid App', redirect_uris: [validUri] },
      { ...common, client_id: 'tp_legacy', app_name: 'Legacy App', redirect_uris: { unexpected: true } },
    ] }),
  }));
  await page.goto('/developer/apps');
  await expect(page.getByTestId('dev-apps-row-tp_valid')).toContainText(validUri);
  await expect(page.getByTestId('dev-apps-row-tp_legacy')).toContainText('尚未設定');
  await page.getByTestId('dev-apps-row-tp_valid').getByRole('button').focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(validUri);
});
