import { test, expect } from '@playwright/test';

for (const width of [320, 1280]) test(`privacy document reflows at 200% text, ${width}px`, async ({ page, browserName }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.route('**/api/**', route => route.fulfill({ status: 401, json: {} }));
  await page.goto('/privacy');
  const policy = page.getByRole('main');
  await expect(policy.getByRole('heading', { level: 1, name: '隱私權政策' })).toBeVisible();
  await expect(policy.getByRole('heading', { level: 2 })).toHaveCount(10);
  await policy.evaluate(root => {
    const sizes = [root, ...root.querySelectorAll('*')].filter(el => el instanceof HTMLElement).map(el => [el, parseFloat(getComputedStyle(el).fontSize)]);
    for (const [el, size] of sizes) el.style.fontSize = `${size * 2}px`;
  });
  for (const mode of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: mode });
    await expect.poll(() => page.locator('body').evaluate(el => el.classList.contains('dark'))).toBe(mode === 'dark');
    expect(await policy.evaluate(root => {
      const errors = [];
      for (const el of root.querySelectorAll('h1,h2,p,li,a')) {
        const range = document.createRange(); range.selectNodeContents(el); const box = el.getBoundingClientRect();
        if ([...range.getClientRects()].some(rect => rect.left < box.left - 1 || rect.right > box.right + 1 || rect.bottom > box.bottom + 1)) errors.push(el.textContent);
      }
      if (document.documentElement.scrollWidth > document.documentElement.clientWidth) errors.push('horizontal overflow');
      return errors;
    })).toEqual([]);
  }
  const contact = policy.getByRole('link', { name: 'lean.lean@gmail.com', exact: true }).last();
  await expect(contact).toHaveAttribute('href', 'mailto:lean.lean@gmail.com');
  await policy.getByRole('link', { name: 'lean.lean@gmail.com', exact: true }).first().focus();
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab'); await expect(contact).toBeFocused();
  await page.getByRole('button', { name: '返回', exact: true }).press('Enter');
  await expect(page).toHaveURL(/\/$/); await expect(page.getByTestId('landing-page')).toBeVisible();
});

test('reading privacy from signup keeps the original form and login return intact', async ({ page, context }) => {
  await context.route('**/api/**', route => route.fulfill({ status: 401, json: {} }));
  await page.goto('/login');
  await page.getByTestId('login-signup-link').click();
  await page.getByTestId('signup-email').fill('reader@example.com');
  await page.getByTestId('signup-password').fill('unsubmitted-password');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('link', { name: '個資條款與隱私權政策' }).press('Enter');
  const policyTab = await popupPromise;
  await expect(policyTab.getByTestId('privacy-page')).toBeVisible();
  await policyTab.close();
  await expect(page.getByTestId('signup-email')).toHaveValue('reader@example.com');
  await expect(page.getByTestId('signup-password')).toHaveValue('unsubmitted-password');
  await expect(page.getByTestId('signup-privacy-consent')).not.toBeChecked();
  await page.getByRole('link', { name: '直接登入', exact: true }).click();
  await expect(page.getByTestId('login-email')).toBeVisible();
});
