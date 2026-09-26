// @ts-check
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

async function visitAsGuest(page) {
  await setupApiMocks(page);
  await page.route(/\/api\/oauth\/userinfo$/, (route) => route.fulfill({ status: 401, body: '{}' }));
  await page.goto('/');
  await expect(page.getByTestId('landing-page')).toBeVisible();
}

test('first visitor sees one heading, meaningful art, and a working start route', async ({ page }) => {
  await visitAsGuest(page);
  const main = page.getByRole('main');
  await expect(main).toHaveCount(1);
  await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('img', { name: /行程路線示意圖/ })).toBeVisible();
  await expect(main.getByText(/可以把既有行程用 JSON 匯入/)).toBeVisible();
  await page.getByRole('link', { name: '登入後開始使用' }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId('login-signup-link')).toBeVisible();
});

for (const theme of ['light', 'dark']) {
  test(`landing content and actions reflow at 320px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    if (theme === 'dark') await page.emulateMedia({ colorScheme: 'dark' });
    await visitAsGuest(page);
    if (theme === 'dark') await expect(page.locator('body')).toHaveClass(/dark/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: '登入後開始使用' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: '行程還在試算表裡？' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('landing reflows when text is enlarged to 200 percent', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 800 });
  await visitAsGuest(page);
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: '登入後開始使用' }).first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('landing keeps copy and actions reachable with text-only enlargement', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await visitAsGuest(page);
  await page.evaluate(() => {
    for (const element of document.querySelectorAll('.tp-lp h1, .tp-lp h2, .tp-lp h3, .tp-lp p, .tp-lp a, .tp-lp span')) {
      const size = Number.parseFloat(getComputedStyle(element).fontSize);
      element.style.setProperty('font-size', `${size * 2}px`, 'important');
    }
  });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: '登入後開始使用' }).first()).toBeVisible();
  await expect(page.getByText(/可以把既有行程用 JSON 匯入/)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
