// @ts-check
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

test.describe('Settings pages', () => {
  test('sessions page loads inside the shared shell with TitleBar hero', async ({ page }) => {
    await page.goto('/settings/sessions');
    await expect(page.getByRole('heading', { name: '登入裝置' })).toBeVisible();
    await expect(page.getByTestId('sessions-user-email')).toContainText('lean.lean@gmail.com');
    await expect(page.getByTestId('sessions-row-current')).toContainText('Chrome on macOS');
  });

  test('connected apps page is reachable from direct route', async ({ page }) => {
    await page.goto('/settings/connected-apps');
    await expect(page.getByRole('heading', { name: '已連結的應用' })).toBeVisible();
    await expect(page.getByTestId('connected-apps-row-calendar-exporter')).toContainText('Calendar Exporter');
  });

  test('connected app revoke is keyboard accessible and a failed request can be retried', async ({ page }) => {
    let deleteCount = 0;
    await page.route(/\/api\/account\/connected-apps\/calendar-exporter$/, async (route) => {
      deleteCount += 1;
      await route.fulfill({
        status: deleteCount === 1 ? 503 : 200,
        contentType: 'application/json',
        body: JSON.stringify(deleteCount === 1
          ? { error: { code: 'SYS_INTERNAL' } }
          : { ok: true, revoked_client_id: 'calendar-exporter' }),
      });
    });
    await page.goto('/settings/connected-apps');
    const revoke = page.getByTestId('connected-apps-revoke-calendar-exporter');
    await revoke.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('查看行程、修改行程');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(revoke).toBeFocused();
    await page.keyboard.press('Enter');
    await dialog.getByRole('button', { name: '確認撤銷' }).click();
    await expect(dialog).toContainText('撤銷失敗，請重試。');
    await expect(revoke).toBeVisible();
    await dialog.getByRole('button', { name: '確認撤銷' }).click();
    await expect(page.getByTestId('connected-apps-row-calendar-exporter')).not.toBeVisible();
    expect(deleteCount).toBe(2);
  });
});
