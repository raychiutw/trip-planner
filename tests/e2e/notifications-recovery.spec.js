import { test, expect } from '@playwright/test';
for (const sheet of [false, true]) test(`notification plans are readable information with account return, sheet=${sheet}`, async ({ page }) => {
  await page.setViewportSize({ width: sheet ? 320 : 1280, height: 844 });
  const notificationRequests = [];
  await page.addInitScript(() => { window.notificationPrompts = 0; if (window.Notification) Notification.requestPermission = async () => { window.notificationPrompts++; return 'denied'; }; });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname; if (path.includes('notifications')) notificationRequests.push(path);
    return route.fulfill({ json: path === '/api/oauth/userinfo' ? { id: 'reader', email: 'reader@example.com', displayName: 'Reader' } : [] });
  });
  await page.goto(sheet ? '/trips' : '/account'); if (sheet) await page.getByTestId('titlebar-account').click();
  const entry = page.getByTestId('account-row-notifications'); await expect(entry).toContainText('尚未開放'); await entry.focus(); await page.keyboard.press('Enter');
  const content = page.getByTestId('notifications-page'); await expect(content.getByRole('heading', { name: '尚未開放' })).toBeVisible();
  const plans = content.getByRole('list', { name: '規劃中的通知類型' }); await expect(plans.getByRole('listitem')).toHaveCount(3);
  await expect(plans.getByRole('button')).toHaveCount(0); await expect(content.getByRole('checkbox')).toHaveCount(0); await expect(content.getByRole('switch')).toHaveCount(0);
  expect(await content.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  const row = page.getByTestId('notif-row-trip-update');
  expect(await row.locator('.tp-notif-row-helper').evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el); const bounds = el.getBoundingClientRect();
    return [...range.getClientRects()].every(rect => rect.right <= bounds.right + 1 && rect.left >= bounds.left - 1);
  })).toBe(true);
  for (const mode of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: mode });
    await expect.poll(() => row.evaluate(el => {
      const text = el.querySelector('.tp-notif-row-helper'); const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
      const background = rgb(getComputedStyle(el.parentElement).backgroundColor); const foreground = rgb(getComputedStyle(text).color); const opacity = Number(getComputedStyle(el).opacity);
      const luminance = channels => channels.map(n => { const c = n / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
      const a = luminance(foreground.map((n, i) => n * opacity + background[i] * (1 - opacity))); const b = luminance(background);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    })).toBeGreaterThanOrEqual(4.5);
  }
  await content.getByRole('button', { name: '返回帳號' }).press('Enter'); await expect(page).toHaveURL(/\/account$/); await expect(entry).toBeVisible();
  if (sheet) await expect(page.getByRole('dialog', { name: '帳號', exact: true })).toBeVisible();
  expect(notificationRequests).toEqual([]); expect(await page.evaluate(() => window.notificationPrompts)).toBe(0);
});
