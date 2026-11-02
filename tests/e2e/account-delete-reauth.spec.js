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
