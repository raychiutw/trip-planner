// @ts-check
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

test('320px GET failure keeps the list frame and keyboard retry restores local dates', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.clock.install({ time: new Date('2026-04-27T08:00:00Z') });
  let loads = 0;
  await page.route('**/api/account/sessions', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    loads += 1;
    return loads === 1
      ? route.fulfill({ status: 500, body: 'failed' })
      : route.fallback();
  });

  await page.goto('/settings/sessions');
  const error = page.getByTestId('sessions-load-error');
  await expect(error).toBeVisible();
  await expect(page.getByTestId('sessions-revoke-all')).toHaveCount(0);
  await expect(page.getByTestId('sessions-row-current')).toHaveCount(0);
  await expect(page.locator('.tp-sessions-load-frame .tp-row-header')).toContainText('上次活動');
  await expect(error.getByRole('button', { name: '返回帳號' })).toBeVisible();
  const retry = error.getByRole('button', { name: '重新載入裝置' });
  await retry.focus();
  await page.keyboard.press('Enter');
  const current = page.getByTestId('sessions-row-current');
  await expect(current).toContainText('剛才');
  await expect(current).toContainText('2026/4/27');
  const activityColors = await current.locator('.tp-time').evaluate((time) => {
    const relative = time.firstElementChild;
    const absolute = time.lastElementChild;
    const swatch = document.createElement('span');
    time.appendChild(swatch);
    swatch.style.color = 'var(--color-foreground)';
    const foreground = getComputedStyle(swatch).color;
    swatch.style.color = 'var(--color-muted)';
    const muted = getComputedStyle(swatch).color;
    swatch.remove();
    return {
      relative: getComputedStyle(relative).color,
      absolute: getComputedStyle(absolute).color,
      foreground,
      muted,
    };
  });
  expect(activityColors.relative).toBe(activityColors.foreground);
  expect(activityColors.absolute).toBe(activityColors.muted);
  await expect(page.getByTestId('sessions-load-error')).toHaveCount(0);
  await expect(page.getByTestId('titlebar').getByRole('button', { name: '返回' })).toBeFocused();
  expect(loads).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('read failure back action returns to Account by keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route('**/api/account/sessions', (route) => route.fulfill({ status: 500, body: 'failed' }));
  await page.goto('/settings/sessions');
  await page.getByTestId('sessions-logout').click({ trial: true });
  const back = page.getByTestId('sessions-load-error').getByRole('button', { name: '返回帳號' });
  await back.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/account$/);
});
