import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');
const trip = 'okinawa-trip-2026-Ray';
for (const [source, target, selected, focus] of [
  [`/?trip=${trip}&day=2&keep=a%26b#notes`, '/trips', trip, null],
  [`/old?trip=${trip}&day=2&keep=a%26b#notes`, '/trips', trip, null],
  ['/old?trip=%2F%2Fevil.example&day=2#notes', '/trips', null, null],
  ['/admin?day=2&keep=a%26b#notes', '/trips', null, null],
  ['/manage?day=2&keep=a%26b#notes', '/chat', null, null],
  [`/trip/${trip}?day=2&keep=a%26b#notes`, '/trips', trip, null],
  [`/trip/${trip}/stop/101?day=2&keep=a%26b#notes`, '/trips', trip, '101'],
]) test(`legacy navigation preserves context: ${source}`, async ({ page }) => {
  await setupApiMocks(page);
  await page.goto(source);
  await expect(page).toHaveURL(url => url.pathname === target && url.searchParams.get('day') === '2' && url.hash === '#notes');
  const url = new URL(page.url());
  expect(url.searchParams.get('selected')).toBe(selected);
  expect(url.searchParams.get('focus')).toBe(focus);
  expect(url.searchParams.has('trip')).toBe(false);
  if (source.includes('keep=')) expect(url.searchParams.get('keep')).toBe('a&b');
});

test('confirmed anonymous login redirect retains query and hash', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 401, json: {} }));
  await page.goto('/account?from=review#security');
  await expect(page).toHaveURL(url => url.pathname === '/login');
  expect(new URL(page.url()).searchParams.get('redirect_after')).toBe('/account?from=review#security');
});
