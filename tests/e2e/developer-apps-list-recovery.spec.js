// @ts-check
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
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
  const back = page.getByRole('button', { name: '返回帳號' });
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
