import { test, expect } from '@playwright/test';
const user = { id: 'owner', email: 'owner@example.com', displayName: 'Ray' };
const member = { id: 2, email: 'member@example.com', displayName: '旅伴', role: 'member', tripId: 'A' };
async function base(page) {
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await page.route('**/api/oauth/userinfo', route => route.fulfill({ json: user }));
  await page.route('**/api/trips/A', route => route.fulfill({ json: { tripId: 'A', title: '旅程 A', ownerUserId: 'owner' } }));
  await page.route('**/api/invitations?*', route => route.fulfill({ json: { items: [] } }));
}
test('collab invite failure preserves email, role keyboard controls work, removal retry restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await base(page);
  let members = [member], adds = 0, removes = 0;
  await page.route('**/api/permissions?*', route => route.fulfill({ json: members }));
  await page.route('**/api/permissions', route => {
    adds++; expect(route.request().postDataJSON()).toMatchObject({ tripId: 'A', email: 'new@example.com', role: 'viewer' });
    return route.fulfill({ status: adds === 1 ? 503 : 201, json: adds === 1 ? {} : { ok: true, status: 'invitation_sent' } });
  });
  await page.route('**/api/permissions/2', route => {
    if (route.request().method() === 'PATCH') { members = [{ ...member, role: route.request().postDataJSON().role }]; return route.fulfill({ json: { ok: true, role: members[0].role } }); }
    removes++; if (removes > 1) members = [];
    return route.fulfill({ status: removes === 1 ? 503 : 200, json: removes === 1 ? {} : { ok: true } });
  });
  await page.goto('/trip/A/collab'); await expect(page.getByRole('heading', { name: '旅程 A', exact: true })).toBeVisible();
  await page.getByTestId('collab-add-email').fill('new@example.com'); await page.getByTestId('collab-add-role-viewer').click(); await page.getByTestId('collab-add-submit').click();
  await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByTestId('collab-add-email')).toHaveValue('new@example.com');
  await page.getByTestId('collab-add-submit').click(); await expect(page.getByRole('status')).toContainText('已建立'); await expect(page.getByTestId('collab-add-email')).toHaveValue(''); expect(adds).toBe(2);
  const role = page.getByTestId('collab-role-trigger-2'); await role.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitemradio', { name: /共編成員/ })).toBeFocused(); await page.keyboard.press('ArrowDown'); await expect(page.getByRole('menuitemradio', { name: /檢視成員/ })).toBeFocused(); await page.keyboard.press('Escape'); await expect(role).toBeFocused(); await expect(page).toHaveURL(/\/trip\/A\/collab$/);
  await page.keyboard.press('Enter'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await expect(role).toContainText('檢視成員');
  await page.getByRole('button', { name: '移除 member@example.com' }).click(); await expect(page.getByTestId('confirm-modal-cancel')).toBeFocused();
  await page.getByTestId('confirm-modal-confirm').click(); await expect(page.getByRole('alertdialog').getByRole('alert')).toBeVisible(); await expect(page.getByTestId('collab-row-2')).toBeVisible();
  await page.getByTestId('confirm-modal-confirm').click(); await expect(page.getByRole('alertdialog')).toHaveCount(0); await expect(page.getByTestId('collab-panel')).toBeFocused(); await expect(page.getByTestId('collab-row-2')).toHaveCount(0); expect(removes).toBe(2);
  await page.getByRole('button', { name: '返回上一層' }).click(); await expect(page).toHaveURL(/\/trips\?selected=A$/);
});
test('collab has a safe identity and read retry when trip metadata is unavailable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await base(page); let failed = true;
  await page.route('**/api/trips/A', route => route.fulfill({ status: failed ? 503 : 200, json: failed ? {} : { tripId: 'A', title: '旅程 A' } }));
  await page.route('**/api/permissions?*', route => route.fulfill({ status: 403, json: {} }));
  await page.route('**/api/invitations?*', route => route.fulfill({ status: 403, json: {} }));
  await page.goto('/trip/A/collab'); await expect(page.getByRole('heading', { name: '行程 A', exact: true })).toBeVisible(); await expect(page.getByTestId('collab-add-submit')).toHaveCount(0);
  failed = false; await page.getByRole('button', { name: '重試行程名稱' }).focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('heading', { name: '旅程 A', exact: true })).toBeVisible(); await expect(page.getByTestId('collab-panel')).toContainText('只有行程擁有者可以管理旅伴');
});
