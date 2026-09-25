import { test, expect } from '@playwright/test';
async function setup(page) {
  const app = { client_id: 'external-' + 'longid'.repeat(18), app_name: 'External planner', scopes: ['openid', 'profile', 'email', 'trips:write', 'future:scope'], granted_at: Date.now() - 86400000, status: 'active' };
  const state = { apps: [app], authorized: false, readFails: true, revokeFails: true, writes: [] };
  await page.route('**/api/**', async route => {
    const req = route.request(); const path = new URL(req.url()).pathname;
    const reply = (json, status = 200) => route.fulfill({ json, status });
    if (path === '/api/oauth/userinfo') return reply({ id: 'reader', email: 'reader@example.com', displayName: 'Reader' });
    if (path === '/api/account/ai-authorization') {
      if (req.method() === 'POST') { state.authorized = true; state.apps.push({ ...app, client_id: 'tripline-tp-request', app_name: 'Tripline AI' }); }
      return reply({ authorized: state.authorized });
    }
    if (path === '/api/account/connected-apps') return state.readFails ? reply({ error: { code: 'SYS_INTERNAL' } }, 503) : reply({ apps: state.apps });
    if (req.method() === 'DELETE') {
      state.writes.push(path);
      if (state.revokeFails) return reply({ error: { code: 'PERM_DENIED' } }, 403);
      const id = decodeURIComponent(path.split('/').at(-1)); state.apps = state.apps.filter(row => row.client_id !== id);
      if (id === 'tripline-tp-request') state.authorized = false;
      return reply({ ok: true, revoked_client_id: id });
    }
    return reply([]);
  });
  return state;
}
for (const width of [390, 1280]) test(`grant facts and AI consent stay synchronized at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 }); const state = await setup(page);
  await page.goto('/settings/connected-apps'); await expect(page.getByTestId('connected-apps-error')).toBeVisible();
  await expect(page.getByTestId('connected-apps-empty')).not.toBeVisible();
  state.readFails = false; await page.getByRole('button', { name: '重試載入應用' }).click();
  const external = page.locator('[data-testid^="connected-apps-row-external"]'); await expect(external).toContainText('建立 / 修改您的行程');
  await expect(external).toContainText('future:scope');
  expect(await external.locator('.tp-app-info > .tp-app-meta').first().evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el);
    return [...range.getClientRects()].every(rect => rect.right <= el.getBoundingClientRect().right + 1);
  })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '撤銷 External planner', exact: true }).click();
  await expect(page.getByTestId('confirm-modal-cancel')).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: '撤銷 External planner', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '撤銷 External planner', exact: true }).press('Enter');
  await page.getByTestId('confirm-modal-confirm').click(); await expect(page.getByRole('alertdialog')).toContainText('撤銷失敗');
  state.revokeFails = false; await page.getByTestId('confirm-modal-confirm').click();
  await expect(page.getByTestId('connected-apps-empty')).toBeVisible();
  await expect(page.getByLabel('已連結應用清單', { exact: true })).toBeFocused();
  await page.getByRole('button', { name: '授權 AI', exact: true }).click();
  await expect(page.getByTestId('connected-apps-row-tripline-tp-request')).toBeVisible();
  await expect(page.getByTestId('ai-authorize-on')).toBeFocused();
  await page.getByRole('button', { name: '撤銷 Tripline AI', exact: true }).click(); await page.getByTestId('confirm-modal-confirm').click();
  await expect(page.getByTestId('connected-apps-empty')).toBeVisible();
  await expect(page.getByRole('button', { name: '授權 AI', exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(3);
});
