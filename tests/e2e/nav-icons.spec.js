// @ts-check
// #1701：「行程」root tab 圖示是行李箱（比照 App）、手機帳號圓圈是人像圖示且可及名稱仍是「帳號」。
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

test('桌機側欄「行程」是行李箱圖示', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/trips');
  const tab = page.getByTestId('sidebar-nav-trips');
  await expect(tab).toBeVisible();
  await expect(tab.locator('[data-icon="nav-suitcase-fill"]')).toHaveCount(1); // #1707：選中＝實心版
  await expect(tab.locator('[data-icon="nav-trips"]')).toHaveCount(0);
});

test('手機底部「行程」是行李箱圖示；帳號圓圈是人像圖示、名稱為「帳號」', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/trips');
  const tab = page.getByTestId('global-bottom-nav-trips');
  await expect(tab.locator('[data-icon="nav-suitcase-fill"]')).toHaveCount(1);
  // #1707：選中底 = accent-bg #F1E8DE、前景 = selected-fg #6F4C2C（真實渲染值，非原始碼 grep）
  await expect(tab).toHaveCSS('background-color', 'rgb(241, 232, 222)');
  await expect(tab).toHaveCSS('color', 'rgb(111, 76, 44)');
  await expect(page.getByTestId('global-bottom-nav-chat').locator('[data-icon="nav-chat"]')).toHaveCount(1);
  const circle = page.getByTestId('titlebar-account');
  await expect(circle).toHaveAttribute('aria-label', '帳號');
  await expect(circle.locator('[data-icon="nav-account"]')).toHaveCount(1);
  expect((await circle.innerText()).trim()).toBe('');
});
