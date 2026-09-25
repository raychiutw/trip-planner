import { test, expect } from '@playwright/test';
const { setupApiMocks, MOCK_TRIPS_LIST } = require('./api-mocks');

test('picking a trip card keeps the same chat target after navigation', async ({ page }) => {
  await setupApiMocks(page);
  await page.route(/maps\.googleapis\.com/, (route) => route.abort());
  const target = MOCK_TRIPS_LIST[1];
  await page.goto('/trips');
  await page.getByTestId(`trips-list-card-${target.tripId}`).click();
  await expect(page).toHaveURL(new RegExp(`selected=${target.tripId}`));
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByRole('button', { name: '返回行程列表' }).click();
    await expect(page.getByTestId(`trips-list-card-${target.tripId}`)).toBeVisible();
    await expect(page).toHaveURL(/\/trips$/);
  }
  await page.goto('/chat');
  await expect(page.getByTestId('chat-trip-title')).toContainText(target.name.slice(0, 2));
});
