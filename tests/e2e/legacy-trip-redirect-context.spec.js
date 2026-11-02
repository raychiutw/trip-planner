import { test, expect } from '@playwright/test';
const { setupApiMocks, MOCK_TRIPS_LIST } = require('./api-mocks');

const tripId = MOCK_TRIPS_LIST[0].tripId;

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

test('legacy trip query keeps the detail query and day anchor', async ({ page }) => {
  await page.goto(`/old-trip?trip=${tripId}&focus=entry-1#day2`);
  await expect(page).toHaveURL(/\/trips\?.*#day2$/);
  const url = new URL(page.url());
  expect(url.searchParams.get('selected')).toBe(tripId);
  expect(url.searchParams.get('focus')).toBe('entry-1');
  expect(url.searchParams.has('trip')).toBe(false);
});

test('legacy trip path keeps the detail query and day anchor', async ({ page }) => {
  await page.goto(`/trip/${tripId}?focus=entry-1#day2`);
  await expect(page).toHaveURL(/\/trips\?.*#day2$/);
  const url = new URL(page.url());
  expect(url.searchParams.get('selected')).toBe(tripId);
  expect(url.searchParams.get('focus')).toBe('entry-1');
});
