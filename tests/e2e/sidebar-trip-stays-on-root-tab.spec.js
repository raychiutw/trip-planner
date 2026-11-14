/**
 * #1693：桌機側欄點行程，留在原本的 root tab（聊天→聊天、地圖→地圖、其他→行程詳情）。
 * 判斷來源與 MapPage 的 trip switcher 共用 `tripDestination`（navItems.ts）。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks, MOCK_TRIPS_LIST, MOCK_TRIP_META_BUSAN } = require('./api-mocks');

const TRIP_A = MOCK_TRIPS_LIST[0].tripId;
const TRIP_B = MOCK_TRIPS_LIST[1].tripId;
const TRIP_B_TITLE_FRAGMENT = MOCK_TRIP_META_BUSAN.name.slice(0, 2);

test.use({ viewport: { width: 1280, height: 800 } });

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
  await page.route(/maps\.googleapis\.com/, (r) => r.abort());
  await page.route('**/api/route**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ polyline: [], duration: null, distance: 0, approx: true }),
  }));
});

test('聊天：點側欄行程留在 /chat 並換成該行程', async ({ page }) => {
  await page.goto('/chat');
  await page.waitForLoadState('networkidle');
  await page.getByTestId(`sidebar-trip-${TRIP_B}`).click();
  await expect(page).toHaveURL(/\/chat(\?|$)/);
  await expect(page.getByTestId('chat-trip-title')).toContainText(TRIP_B_TITLE_FRAGMENT);
  await expect(page.getByTestId(`sidebar-trip-${TRIP_B}`)).toHaveAttribute('aria-current', 'page');
});

test('地圖：點側欄行程留在該行程的地圖', async ({ page }) => {
  await page.goto(`/trip/${TRIP_A}/map?day=all`);
  await page.waitForLoadState('networkidle');
  await page.getByTestId(`sidebar-trip-${TRIP_B}`).click();
  await expect(page).toHaveURL(new RegExp(`/trip/${TRIP_B}/map`));
  await expect(page.getByTestId(`sidebar-trip-${TRIP_B}`)).toHaveAttribute('aria-current', 'page');
});

test('收藏：點側欄行程進行程詳情', async ({ page }) => {
  await page.goto('/favorites');
  await page.waitForLoadState('networkidle');
  await page.getByTestId(`sidebar-trip-${TRIP_B}`).click();
  await expect(page).toHaveURL(new RegExp(`/trips\\?selected=${TRIP_B}`));
  await expect(page.getByTestId(`sidebar-trip-${TRIP_B}`)).toHaveAttribute('aria-current', 'page');
});
