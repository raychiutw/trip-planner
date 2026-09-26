// @ts-check
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

test('URI 錯誤指出行數，保留名稱、類型和 URI 供修正', async ({ page }) => {
  await page.route('**/api/dev/apps', (route) => route.fulfill({
    status: 400,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 'DATA_VALIDATION', message: 'redirect_uris[1] 必須是 HTTPS（localhost 例外）' } }),
  }));
  await page.goto('/developer/apps/new');
  await expect(page.getByRole('radiogroup', { name: '類型' })).toBeVisible();
  await expect(page.getByRole('group', { name: '申請的 scopes' })).toBeVisible();
  await page.getByTestId('dev-app-new-name').fill('My App');
  await page.getByTestId('dev-app-new-type-confidential').check();
  await page.getByTestId('dev-app-new-uris').fill('https://good.test/cb\n\nhttp://bad.test/cb');
  await page.getByTestId('dev-app-new-submit').click();

  await expect(page.getByTestId('dev-app-new-error')).toContainText('第 3 行');
  await expect(page.getByTestId('dev-app-new-uris')).toBeFocused();
  await expect(page.getByTestId('dev-app-new-name')).toHaveValue('My App');
  await expect(page.getByTestId('dev-app-new-type-confidential')).toBeChecked();
  await expect(page.getByTestId('dev-app-new-uris')).toHaveValue('https://good.test/cb\n\nhttp://bad.test/cb');
});

test('一次性 secret 保留在具名對話框；剪貼簿失敗與鍵盤操作有真實回饋', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    });
  });
  await page.route('**/api/dev/apps', (route) => route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({
      client_id: 'tp_new', client_secret: 'tps_once', app_name: 'New App',
      client_type: 'confidential', status: 'pending_review',
      redirect_uris: ['https://good.test/cb'], allowed_scopes: ['openid'],
    }),
  }));
  await page.goto('/developer/apps/new');
  await page.getByTestId('dev-app-new-name').fill('New App');
  await page.getByTestId('dev-app-new-type-confidential').check();
  await page.getByTestId('dev-app-new-uris').fill('https://good.test/cb');
  await page.getByTestId('dev-app-new-submit').click();

  const dialog = page.getByRole('dialog', { name: '應用程式憑證' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: '複製' }).first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByTestId('dev-app-new-secret-acknowledge')).toBeFocused();
  await dialog.getByRole('button', { name: '複製' }).last().click();
  await expect(dialog).toContainText('複製失敗');
  await expect(dialog.getByTestId('dev-app-new-secret-client-secret')).toHaveText('tps_once');
  await dialog.getByTestId('dev-app-new-secret-acknowledge').click();
  await expect(page).toHaveURL(/\/developer\/apps$/);
});

test('Public client 僅交付 Client ID，成功複製後才顯示已複製', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (value) => { window.__copiedClientId = value; } },
    });
  });
  await page.route('**/api/dev/apps', (route) => route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({
      client_id: 'tp_public', client_secret: null, app_name: 'Public App',
      client_type: 'public', status: 'pending_review',
      redirect_uris: ['https://good.test/cb'], allowed_scopes: ['openid'],
    }),
  }));
  await page.goto('/developer/apps/new');
  await page.getByTestId('dev-app-new-name').fill('Public App');
  await page.getByTestId('dev-app-new-uris').fill('https://good.test/cb');
  await page.getByTestId('dev-app-new-submit').click();
  const dialog = page.getByRole('dialog', { name: '應用程式憑證' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('dev-app-new-secret-client-secret')).toHaveCount(0);
  await dialog.getByRole('button', { name: '複製' }).click();
  await expect(dialog.getByRole('button', { name: '已複製' })).toBeVisible();
  expect(await page.evaluate(() => window.__copiedClientId)).toBe('tp_public');
});
