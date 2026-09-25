import { test, expect } from '@playwright/test';

async function setup(page) {
  const state = { readFails: false, writeFails: false, loggedOut: false, writes: [], pause: null,
    sessions: [
      { sid: 'current', ua_summary: 'Chrome Desktop', is_current: true },
      { sid: 'phone', ua_summary: 'Safari Phone ' + '很長的裝置名稱'.repeat(12), is_current: false },
      { sid: 'tablet', ua_summary: null, is_current: false },
    ].map(row => ({ ...row, ip_hash_prefix: null, created_at: '2026-09-24 00:00:00', last_seen_at: '2026-09-25T00:00:00Z' })),
  };
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    const reply = (json, status = 200) => route.fulfill({ json, status });
    if (path === '/api/oauth/userinfo') return reply({ id: 'reader', email: 'reader@example.com', displayName: 'Reader' }, state.loggedOut ? 401 : 200);
    if (request.method() === 'DELETE' || request.method() === 'POST') {
      state.writes.push(path);
      if (state.pause) await state.pause;
      if (state.writeFails) return reply({ error: { code: 'SYS_INTERNAL' } }, 500);
      if (path === '/api/oauth/logout') { state.loggedOut = true; return route.fulfill({ status: 204 }); }
      if (path.endsWith('/sessions')) { state.sessions = state.sessions.filter(row => row.is_current); return reply({ ok: true, revoked: 2 }); }
      const sid = decodeURIComponent(path.split('/').at(-1)); state.sessions = state.sessions.filter(row => row.sid !== sid);
      return reply({ ok: true, revoked_sid: sid });
    }
    if (path === '/api/account/sessions') return state.readFails ? reply({ error: { code: 'SYS_INTERNAL' } }, 503) : reply({ current_sid: 'current', sessions: state.sessions });
    return reply([]);
  });
  return state;
}

test('mobile read retry and single-device failure preserve the intended session and keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const state = await setup(page); state.readFails = true;
  await page.goto('/settings/sessions'); await expect(page.getByTestId('sessions-error')).toBeVisible();
  await expect(page.getByTestId('sessions-empty')).not.toBeVisible();
  state.readFails = false; await page.getByRole('button', { name: '重試載入裝置' }).click();
  await expect(page.getByTestId('sessions-row-phone')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  state.writeFails = true; await page.getByTestId('sessions-revoke-phone').click();
  await expect(page.getByText('登出此裝置失敗，請稍後再試。')).toBeVisible();
  await expect(page.getByTestId('sessions-row-phone')).toBeVisible();
  state.writeFails = false; await page.getByTestId('sessions-revoke-phone').click();
  await expect(page.getByTestId('sessions-row-phone')).not.toBeVisible();
  await expect(page.getByTestId('sessions-row-current')).toBeVisible();
  await expect(page.getByLabel('登入裝置清單', { exact: true })).toBeFocused();
  expect(state.writes).toEqual(['/api/account/sessions/phone', '/api/account/sessions/phone']);
});

test('bulk keyboard confirmation retains pending/error context and excludes the current device', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 844 }); const state = await setup(page);
  await page.goto('/settings/sessions'); await page.getByTestId('sessions-revoke-all').press('Enter');
  await expect(page.getByTestId('confirm-modal-cancel')).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.getByTestId('sessions-revoke-all')).toBeFocused(); expect(state.writes).toHaveLength(0);
  await page.getByTestId('sessions-revoke-all').press('Enter'); await expect(page.getByTestId('confirm-modal-cancel')).toBeFocused();
  let release; state.pause = new Promise(resolve => { release = resolve; }); state.writeFails = true;
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.getByTestId('confirm-modal-confirm')).toBeDisabled();
  await expect(page.getByTestId('sessions-logout')).toBeDisabled();
  await page.keyboard.press('Escape'); await expect(page.getByRole('alertdialog')).toBeVisible();
  release(); state.pause = null;
  await expect(page.getByRole('alertdialog')).toContainText('登出其他裝置失敗，請稍後再試。');
  state.writeFails = false; await page.getByTestId('confirm-modal-confirm').click();
  await expect(page.getByRole('alertdialog')).not.toBeVisible();
  await expect(page.getByTestId('sessions-row-current')).toBeVisible();
  await expect(page.getByTestId('sessions-row-phone')).not.toBeVisible();
  await expect(page.getByTestId('sessions-row-tablet')).not.toBeVisible();
  await expect(page.getByLabel('登入裝置清單', { exact: true })).toBeFocused();
  expect(state.writes).toEqual(['/api/account/sessions', '/api/account/sessions']);
});

test('current-device logout changes authentication only after a successful server response', async ({ page }) => {
  const state = await setup(page); state.writeFails = true;
  await page.goto('/settings/sessions'); await page.getByTestId('sessions-logout').click();
  await expect(page.getByText('登出目前裝置失敗，請稍後再試。')).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/sessions$/); expect(state.loggedOut).toBe(false);
  state.writeFails = false; await page.getByTestId('sessions-logout').click();
  await expect(page).toHaveURL(/\/login$/); expect(state.loggedOut).toBe(true);
  expect(state.writes).toEqual(['/api/oauth/logout', '/api/oauth/logout']);
});
