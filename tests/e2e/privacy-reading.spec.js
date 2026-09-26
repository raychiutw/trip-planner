// @ts-check
import { test, expect } from '@playwright/test';

test('privacy deep link keeps the long text readable and contact links in keyboard order', async ({ page }) => {
  await page.setViewportSize({ width: 160, height: 640 }); // 320px mobile viewport at 200% zoom
  await page.goto('/privacy#delete-account');
  const policy = page.getByTestId('privacy-page');
  await expect(policy).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('#delete-account')).toContainText('刪除帳號');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(160);

  const contacts = policy.getByRole('link', { name: 'lean.lean@gmail.com' });
  await expect(contacts).toHaveCount(2);
  await page.getByRole('button', { name: '返回' }).focus();
  await page.keyboard.press('Tab');
  await expect(contacts.first()).toBeFocused();
  await expect(contacts.first()).toHaveAttribute('href', /^mailto:/);
  await page.keyboard.press('Tab');
  await expect(contacts.last()).toBeFocused();
});

test('signup opens policy for reading and returns to the same unfinished form', async ({ page }) => {
  await page.goto('/signup');
  await page.getByTestId('signup-email').fill('reader@example.test');
  const [policy] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('link', { name: '個資條款與隱私權政策' }).click(),
  ]);
  await expect(policy.getByTestId('privacy-page')).toBeVisible();
  await policy.getByRole('button', { name: '返回' }).click();
  await expect.poll(() => policy.isClosed()).toBe(true);
  await expect(page.getByTestId('signup-email')).toHaveValue('reader@example.test');
  await expect(page).toHaveURL(/\/signup$/);
});

test('anonymous privacy deep link returns to the public home page', async ({ page }) => {
  await page.goto('/privacy#delete-account');
  await expect(page.locator('#delete-account')).toBeVisible();
  await page.getByRole('button', { name: '返回' }).click();
  await expect(page).toHaveURL('/');
});
