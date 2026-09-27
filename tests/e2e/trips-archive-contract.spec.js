// @ts-check
import { test, expect } from '@playwright/test';
const { setupApiMocks, MOCK_TRIPS_LIST } = require('./api-mocks');

const tripId = 'okinawa-trip-2026-Ray';

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

async function installArchiveHttp(page, options = {}) {
  let archivedAt = null;
  let failNext = Boolean(options.failNext);
  const mutations = [];
  await page.route('**/api/my-trips', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(MOCK_TRIPS_LIST.map((trip) => ({
      ...trip,
      owner: trip.tripId === tripId ? 'lean.lean@gmail.com' : 'friend@example.test',
      ownerUserId: trip.tripId === tripId ? 'user-ray' : 'other-user',
      archivedAt: trip.tripId === tripId ? archivedAt : null,
    }))),
  }));
  await page.route(`**/api/trips/${tripId}/archive`, (route) => {
    const method = route.request().method();
    mutations.push(method);
    if (failNext) {
      failNext = false;
      return route.fulfill({ status: 500, body: 'failed' });
    }
    archivedAt = method === 'PUT' ? '2026-09-27 00:00:00' : null;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ archivedAt }) });
  });
  return { mutations };
}

async function confirmArchive(page) {
  await expect(page.getByTestId('confirm-modal')).toContainText('所有旅伴');
  await page.getByTestId('confirm-modal-confirm').click();
}

test('desktop archive preserves selected Day 2 and scroll through refresh and reload, then restores the card', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const { mutations } = await installArchiveHttp(page);
  await page.goto(`/trips?selected=${tripId}#day2`);
  await expect(page.getByTestId('trip-main-portal')).toBeVisible();
  const main = page.locator('.app-shell-main').first();
  await main.evaluate((element) => { element.scrollTop = 250; });
  await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBeGreaterThan(40);
  await page.getByTestId('trips-embedded-menu-trigger').click();
  await page.getByTestId(`trip-embedded-menu-archive-${tripId}`).click();
  await confirmArchive(page);
  await expect(page.getByTestId('trip-main-portal')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`selected=${tripId}#day2`));
  await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBeGreaterThan(40);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`selected=${tripId}#day2`));
  await expect(page.getByTestId('trip-main-portal')).toBeVisible();
  await page.getByRole('button', { name: '返回行程列表' }).click();
  await expect(page.getByTestId(`trips-list-card-${tripId}`)).toHaveCount(0);
  await expect(page.getByTestId('trips-list-tab-archived')).toContainText('1');
  await page.getByTestId('trips-list-tab-archived').click();
  await page.getByTestId(`trip-card-menu-trigger-${tripId}`).click();
  await page.getByTestId(`trip-card-menu-archive-${tripId}`).click();
  await confirmArchive(page);
  await expect(page.getByTestId(`trips-list-card-${tripId}`)).toHaveCount(0);
  await page.getByTestId('trips-list-tab-all').click();
  await expect(page.getByTestId(`trips-list-card-${tripId}`)).toBeVisible();
  expect(mutations).toEqual(['PUT', 'DELETE']);
});

test('mobile archive keeps selected detail and browser back; collaborator has no archive control', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installArchiveHttp(page);
  await page.goto('/trips');
  await page.getByTestId(`trips-list-card-${tripId}`).click();
  await expect(page).toHaveURL(new RegExp(`selected=${tripId}`));
  await page.getByTestId('dn-day-2').click();
  const main = page.locator('.app-shell-main').first();
  await main.evaluate((element) => { element.scrollTop = 250; });
  await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBeGreaterThan(40);
  await page.getByTestId('trips-embedded-menu-trigger').click();
  await page.getByTestId(`trip-embedded-menu-archive-${tripId}`).click();
  await confirmArchive(page);
  await expect(page).toHaveURL(new RegExp(`selected=${tripId}.*#day2`));
  await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBeGreaterThan(40);
  await page.goBack();
  await expect(page.getByTestId('trips-list-page')).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`selected=${tripId}.*#day2`));
  await expect(page.locator('.tp-embedded-trip .tp-titlebar')).toContainText('沖繩');
  await page.goBack();
  await expect(page.getByTestId('trips-list-page')).toBeVisible();
  await page.getByTestId('trips-list-tab-archived').click();
  await expect(page.getByTestId(`trips-list-card-${tripId}`)).toBeVisible();
  await page.getByTestId(`trip-card-menu-trigger-${tripId}`).click();
  await page.getByTestId(`trip-card-menu-archive-${tripId}`).click();
  await confirmArchive(page);
  await expect(page.getByTestId(`trips-list-card-${tripId}`)).toHaveCount(0);
  await page.getByTestId('trips-list-tab-all').click();
  await expect(page.getByTestId(`trips-list-card-${tripId}`)).toBeVisible();
  await page.getByTestId('trip-card-menu-trigger-busan-trip-2026-Demo').click();
  await expect(page.getByRole('menuitem', { name: '歸檔行程' })).toHaveCount(0);
});

test('failed archive keeps its card and can retry without changing selection', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const { mutations } = await installArchiveHttp(page, { failNext: true });
  await page.goto('/trips');
  await page.getByTestId(`trip-card-menu-trigger-${tripId}`).click();
  await page.getByTestId(`trip-card-menu-archive-${tripId}`).click();
  await confirmArchive(page);
  await expect(page.getByText('更新歸檔狀態失敗，請再試一次。')).toBeVisible();
  await expect(page.getByTestId(`trips-list-card-${tripId}`)).toBeVisible();
  await expect(page.getByTestId('trips-list-tab-archived')).toContainText('0');
  await expect(page.getByTestId('confirm-modal')).toBeVisible();
  await page.getByTestId('confirm-modal-confirm').click();
  await expect(page.getByTestId(`trips-list-card-${tripId}`)).toHaveCount(0);
  expect(mutations).toEqual(['PUT', 'PUT']);
});

test('320px short viewport keeps the card archive action tappable above bottom navigation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await installArchiveHttp(page);
  await page.goto('/trips');
  await page.getByTestId(`trip-card-menu-trigger-${tripId}`).click();
  await page.getByTestId(`trip-card-menu-archive-${tripId}`).click();
  await expect(page.getByTestId('confirm-modal')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
