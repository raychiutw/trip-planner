import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

for (const width of [390, 1280]) test(`account and nested modal isolate only the active layer at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await setupApiMocks(page);
  await page.route('**/api/account', route => route.fulfill({ json: { hasPassword: true, tripsOwned: 2, collaboratorsAffected: 1 } }));
  await page.goto('/trips');
  const opener = width < 1024 ? page.getByTestId('titlebar-account') : page.getByTestId('sidebar-account-card');
  await opener.focus(); await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: '帳號', exact: true });
  await expect(sheet).toBeVisible();
  await expect.poll(() => opener.evaluate(el => !!el.closest('[inert]'))).toBe(true);
  await opener.evaluate(el => el.focus()); await expect(opener).not.toBeFocused();
  const edit = page.getByTestId('account-row-delete-account'); await edit.focus(); await page.keyboard.press('Enter');
  const input = page.getByTestId('confirm-modal-cancel'); await expect(input).toBeFocused();
  await expect.poll(() => edit.evaluate(el => !!el.closest('[inert]'))).toBe(true);
  await edit.evaluate(el => el.focus()); await expect(input).toBeFocused();
  await page.keyboard.press('Escape'); await expect(edit).toBeFocused(); await expect(sheet).toBeVisible();
  await expect.poll(() => edit.evaluate(el => !!el.closest('[inert]'))).toBe(false);
  await page.keyboard.press('Escape'); await expect(sheet).not.toBeVisible(); await expect(opener).toBeFocused();
  await expect.poll(() => opener.evaluate(el => !!el.closest('[inert]'))).toBe(false);
});

test('busy confirmation retains keyboard focus until completion removes its trigger', async ({ page }) => {
  await setupApiMocks(page);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/api/account/sessions', async route => {
    if (route.request().method() === 'DELETE') { await pending; return route.fulfill({ json: { ok: true, revoked: 1 } }); }
    return route.fulfill({ json: { current_sid: 'current', sessions: [
      { sid: 'current', is_current: true, ua_summary: 'Current', ip_hash_prefix: null, created_at: '2026-09-24T00:00:00Z', last_seen_at: '2026-09-25T00:00:00Z' },
      { sid: 'other', is_current: false, ua_summary: 'Other', ip_hash_prefix: null, created_at: '2026-09-24T00:00:00Z', last_seen_at: '2026-09-25T00:00:00Z' },
    ] } });
  });
  await page.goto('/settings/sessions');
  await page.getByTestId('sessions-revoke-all').press('Enter');
  await expect(page.getByTestId('confirm-modal-cancel')).toBeFocused();
  try {
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.getByTestId('confirm-modal-confirm')).toBeDisabled();
  const dialog = page.getByRole('alertdialog');
  await page.keyboard.press('Tab'); await expect(dialog).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(dialog).toBeFocused();
  await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
  } finally { release(); }
  await expect(page.getByRole('alertdialog')).not.toBeVisible();
  await expect(page.getByLabel('登入裝置清單', { exact: true })).toBeFocused();
  await expect(page.locator('[inert]')).toHaveCount(0);
});


test('account deep link stays a full page and desktop operation keeps adjacent navigation available', async ({ page }) => {
  await setupApiMocks(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/account');
  await expect(page.getByTestId('account-edit-name-btn')).toBeVisible();
  await expect(page.getByRole('dialog', { name: '帳號', exact: true })).toHaveCount(0);
  await expect(page.locator('[inert]')).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.goto('/trip/okinawa-trip-2026-Ray/edit');
  await expect(page.getByTestId('stack-panel-close')).toBeVisible();
  const adjacent = page.getByTestId('sidebar-account-card');
  await adjacent.focus(); await expect(adjacent).toBeFocused();
  await expect(page.locator('[inert]')).toHaveCount(0);
  expect(await page.locator('body').evaluate(el => getComputedStyle(el).position)).not.toBe('fixed');
});
