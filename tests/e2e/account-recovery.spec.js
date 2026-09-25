import { test, expect } from '@playwright/test';

async function setup(page) {
  const state = { name: 'Reader', previewFails: true, deleted: false, deleteCalls: 0, profileCalls: 0, rejectDelete: true, hasPassword: true, reauthenticated: false, oauthStarts: 0, oauthFails: false };
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    const reply = (json, status = 200) => route.fulfill({ json, status });
    if (path === '/api/oauth/userinfo') return reply({ id: 'reader', email: 'reader@example.com', displayName: state.name }, state.deleted ? 401 : 200);
    if (path === '/api/account/stats') return reply({ error: { code: 'SYS_DB_ERROR' } }, 503);
    if (path === '/api/my-trips') return reply([]);
    if (path === '/api/account/profile') { state.profileCalls++; state.name = request.postDataJSON().displayName; return reply({ id: 'reader', displayName: state.name }); }
    if (path === '/api/account' && request.method() === 'GET') return state.previewFails
      ? reply({ error: { code: 'SYS_DB_ERROR' } }, 503)
      : reply({ hasPassword: state.hasPassword, reauthProvider: state.hasPassword ? null : 'google', reauthenticated: state.reauthenticated, tripsOwned: 3, collaboratorsAffected: 2 });
    if (path === '/api/oauth/login/google') {
      state.oauthStarts++; state.reauthenticated = !state.oauthFails;
      // Playwright's WebKit route.fulfill rejects 302 mocks. Reproduce the
      // browser navigation outcome without depending on that unsupported mock.
      return route.fulfill({ contentType: 'text/html', body: `<script>location.replace('/account?deleteReauth=${state.oauthFails ? 'failed' : 'done'}')</script>` });
    }
    if (path === '/api/account' && request.method() === 'DELETE') {
      state.deleteCalls++;
      if (state.rejectDelete) return reply({ error: { code: 'ACCOUNT_DELETE_PASSWORD_INVALID' } }, 401);
      state.deleted = true; return reply({ ok: true, tripsDeleted: 3 });
    }
    return reply([]);
  });
  return state;
}

for (const sheet of [false, true]) {
  test(`account recovery keeps focus and rejected deletion visible, sheet=${sheet}`, async ({ page }) => {
    await page.setViewportSize({ width: sheet ? 390 : 1280, height: 844 });
    const state = await setup(page);
    await page.goto(sheet ? '/trips' : '/account');
    if (sheet) await page.getByTestId('titlebar-account').press('Enter');
    await expect(page.getByText(/數據載入失敗/)).toBeVisible();
    await page.getByTestId('account-edit-name-btn').click();
    const name = page.getByRole('textbox', { name: '編輯名稱' });
    await expect(name).toBeFocused(); await name.fill('Updated'); await name.press('Enter');
    await expect(page.getByTestId('account-hero')).toContainText('Updated');
    await expect(page.getByTestId('account-edit-name-btn')).toBeFocused();
    expect(state.profileCalls).toBe(1);
    const trigger = page.getByTestId('account-row-delete-account'); await trigger.press('Enter');
    await expect(page.getByText('無法取得刪除影響範圍，請稍後再試')).toBeVisible();
    await expect(page.getByTestId('confirm-modal-confirm')).toBeDisabled();
    await page.keyboard.press('Escape'); await expect(page.getByRole('alertdialog')).not.toBeVisible();
    await expect(trigger).toBeFocused();
    if (sheet) await expect(page.getByRole('dialog', { name: '帳號', exact: true })).toBeVisible();
    state.previewFails = false; await trigger.press('Enter');
    await expect(page.getByRole('alertdialog')).toContainText('3 個行程');
    await expect(page.getByRole('alertdialog')).toContainText('2 位共編者');
    await page.getByLabel('請輸入密碼以確認').fill('wrong');
    await page.getByTestId('confirm-modal-confirm').click();
    await expect(page.getByText('密碼不正確，帳號未刪除')).toBeVisible();
    await expect(page).toHaveURL(/\/account$/); expect(state.deleted).toBe(false); expect(state.deleteCalls).toBe(1);
    await page.getByTestId('confirm-modal-cancel').click(); await expect(trigger).toBeFocused();
    if (sheet) {
      await page.getByRole('button', { name: '關閉', exact: true }).click();
      await expect(page).toHaveURL(/\/trips$/); await expect(page.getByTestId('titlebar-account')).toBeFocused();
    }
  });
}

test('confirmed OAuth deletion navigates away only after server success', async ({ page }) => {
  const state = await setup(page); state.previewFails = false; state.hasPassword = false; state.reauthenticated = true; state.rejectDelete = false;
  await page.goto('/account'); await page.getByTestId('account-row-delete-account').click();
  await page.getByLabel('請輸入 DELETE 以確認').fill('DELETE');
  await page.getByTestId('confirm-modal-confirm').click();
  await expect(page).toHaveURL(/\/$/); expect(state.deleteCalls).toBe(1); expect(state.deleted).toBe(true);
  await expect(page.getByTestId('account-page')).not.toBeVisible();
});

test('OAuth deletion requires fresh Google verification before the destructive request', async ({ page }) => {
  const state = await setup(page); state.previewFails = false; state.hasPassword = false; state.rejectDelete = false;
  await page.goto('/account'); await page.getByTestId('account-row-delete-account').click();
  await page.getByLabel('請輸入 DELETE 以確認').fill('DELETE');
  await Promise.all([page.waitForEvent('domcontentloaded'), page.getByTestId('confirm-modal-confirm').click()]);
  await expect.poll(() => state.oauthStarts).toBe(1);
  expect(state.deleteCalls).toBe(0);
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByLabel('請輸入 DELETE 以確認').fill('DELETE');
  await page.getByTestId('confirm-modal-confirm').click();
  await expect(page).toHaveURL(/\/$/); expect(state.deleteCalls).toBe(1);
});

test('cancelled Google verification returns to account and can be retried', async ({ page }) => {
  const state = await setup(page); state.previewFails = false; state.hasPassword = false; state.oauthFails = true;
  await page.goto('/account'); await page.getByTestId('account-row-delete-account').click();
  await page.getByLabel('請輸入 DELETE 以確認').fill('DELETE');
  await Promise.all([page.waitForEvent('domcontentloaded'), page.getByTestId('confirm-modal-confirm').click()]);
  await expect(page.getByText('身分驗證未完成，帳號尚未刪除。請重新驗證。')).toBeVisible();
  expect(state.deleted).toBe(false); expect(state.deleteCalls).toBe(0);
  state.oauthFails = false; state.rejectDelete = false;
  await page.getByLabel('請輸入 DELETE 以確認').fill('DELETE');
  await Promise.all([page.waitForEvent('domcontentloaded'), page.getByTestId('confirm-modal-confirm').click()]);
  await expect.poll(() => state.oauthStarts).toBe(2);
  await page.getByLabel('請輸入 DELETE 以確認').fill('DELETE');
  await page.getByTestId('confirm-modal-confirm').click();
  await expect(page).toHaveURL(/\/$/); expect(state.deleteCalls).toBe(1);
});
