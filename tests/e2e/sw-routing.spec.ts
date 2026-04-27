import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.use({ serviceWorkers: 'allow' });

test.describe('Service worker routing guards', () => {
  test('/manage/ is not rewritten to the root route by the service worker fallback', async ({ page }) => {
    await page.goto(BASE_URL + '/manage/', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    const finalUrl = page.url();
    expect(
      finalUrl.includes('manage') ||
      finalUrl.includes('chat') ||
      finalUrl.includes('cloudflareaccess') ||
      finalUrl.includes('cdn-cgi'),
    ).toBe(true);
  });
});
