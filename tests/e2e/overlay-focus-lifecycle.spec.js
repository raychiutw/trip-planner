// @ts-check
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

for (const width of [390, 1280]) {
  test(`account sheet returns focus to its opener after closing at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await setupApiMocks(page);
    await page.goto('/trips');
    const trigger = page.getByTestId('titlebar-account')
      .or(page.getByTestId('sidebar-account-card')).filter({ visible: true });
    await expect(trigger).toHaveCount(1);
    await trigger.focus();
    await trigger.click();
    const sheet = page.getByRole('dialog', { name: '帳號' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('account-page')).toBeVisible();
    await sheet.getByRole('button', { name: '關閉' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}

test('nested confirmation Escape returns focus through the account sheet stack', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setupApiMocks(page);
  await page.goto('/trips');
  const opener = page.getByTestId('titlebar-account');
  await opener.click();
  const sheet = page.getByRole('dialog', { name: '帳號' });
  const logout = sheet.getByTestId('account-row-logout');
  await logout.click();
  const confirm = page.getByRole('alertdialog', { name: '確認登出？' });
  await expect(confirm).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
  await expect(sheet).toBeVisible();
  await expect(logout).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(opener).toBeFocused();
});
