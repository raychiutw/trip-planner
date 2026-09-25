import { test, expect } from '@playwright/test';
for (const width of [390, 1280]) test(`registration errors and one-time credentials remain usable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.addInitScript(() => {
    window.clipboardDenied = true; window.copied = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => {
      if (window.clipboardDenied) throw new Error('denied'); window.copied.push(value);
    } } });
  });
  let status = 400; const writes = []; const secret = 'tps_' + 'secret'.repeat(10);
  await page.route('**/api/**', route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (path === '/api/oauth/userinfo') return route.fulfill({ json: { id: 'reader', email: 'reader@example.com', displayName: 'Reader' } });
    if (path === '/api/dev/apps' && request.method() === 'POST') {
      const body = request.postDataJSON(); writes.push(body);
      return route.fulfill({ status, json: status >= 400 ? { error: { code: 'DATA_VALIDATION', detail: status === 400 ? 'redirect_uris[1] 必須是 HTTPS（localhost 例外）' : '暫時無法建立，請重試。' } } : { ...body, client_id: 'tp_browser', client_secret: body.client_type === 'confidential' ? secret : null, status: 'pending_review' } });
    }
    if (path === '/api/dev/apps') return route.fulfill({ json: { apps: [] } });
    return route.fulfill({ json: [] });
  });
  await page.goto('/developer/apps/new');
  await page.getByTestId('dev-app-new-name').fill('Browser planner');
  const uris = page.getByTestId('dev-app-new-uris'); await uris.fill('https://example.com/good\n\nhttp://bad.example/cb');
  await page.getByRole('radio', { name: /Confidential/ }).check();
  await expect(page.getByRole('group', { name: '申請的 scopes' })).toBeVisible();
  await page.getByTestId('dev-app-new-titlebar-submit').click();
  await expect(page.getByTestId('dev-app-new-error')).toContainText('第 3 行'); await expect(uris).toBeFocused();
  status = 500; await uris.fill('https://example.com/good\n\nhttps://fixed.example/cb'); await page.getByTestId('dev-app-new-titlebar-submit').click();
  await expect(page.getByTestId('dev-app-new-error')).toContainText('暫時無法建立'); await expect(page.getByTestId('dev-app-new-name')).toHaveValue('Browser planner');
  status = 201; await page.getByTestId('dev-app-new-titlebar-submit').click();
  const dialog = page.getByRole('dialog', { name: '應用程式憑證' }); await expect(dialog).toBeFocused();
  await expect(dialog).toContainText('關閉後無法重新取得');
  await page.keyboard.press('Shift+Tab'); await expect(page.getByTestId('dev-app-new-secret-acknowledge')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByTestId('dev-app-new-secret-client-id')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: '複製 Client ID', exact: true })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByTestId('dev-app-new-secret-client-secret')).toBeFocused();
  expect(await page.evaluate(() => getSelection().toString())).toBe(secret);
  await page.keyboard.press('Tab'); const copy = page.getByRole('button', { name: '複製 Client Secret', exact: true }); await expect(copy).toBeFocused();
  await page.keyboard.press('Enter'); await expect(dialog.getByRole('alert')).toContainText('複製失敗');
  await expect(copy).toBeFocused(); await expect(dialog.getByRole('status')).not.toBeVisible();
  await page.evaluate(() => { window.clipboardDenied = false; }); await copy.press('Enter'); await expect(dialog.getByRole('status')).toContainText('Client Secret 已複製');
  expect(await page.evaluate(() => window.copied)).toEqual([secret]);
  await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByTestId('dev-app-new-secret-acknowledge').click(); await expect(page).toHaveURL(/\/developer\/apps$/); await expect(dialog).not.toBeVisible();
  expect(await page.content()).not.toContain(secret);
  await page.getByRole('button', { name: '建立新應用' }).click(); await page.getByTestId('dev-app-new-name').fill('Public planner'); await page.getByTestId('dev-app-new-uris').fill('http://localhost:3000/cb');
  await page.getByTestId('dev-app-new-titlebar-submit').click(); await expect(dialog).toBeVisible();
  await expect(page.getByTestId('dev-app-new-secret-client-secret')).not.toBeVisible(); await expect(page.getByTestId('dev-app-new-secret-acknowledge')).toHaveText('返回應用列表');
  expect(writes).toHaveLength(4);
});
