// @ts-check
/**
 * Account hub page E2E — Section 2 (terracotta-account-hub-page)
 *
 * 驗 mockup section 19：profile hero (avatar + name + email + 3 stats) +
 * 3 group settings rows + 登出 confirm modal flow + appearance/notification
 * subroute reachable。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

test.describe('AccountPage — Section 2', () => {
  test('hero render avatar + displayName + email + 3 stats', async ({ page }) => {
    await page.goto('/account');
    const hero = page.getByTestId('account-hero');
    await expect(hero).toBeVisible();
    // displayName = 'Ray', initial = 'R'
    await expect(hero).toContainText('Ray');
    await expect(hero).toContainText('lean.lean@gmail.com');
    // 3 stats from /api/account/stats mock: 5 個行程 / 12 天旅程 / 3 位旅伴
    await expect(hero).toContainText('5');
    await expect(hero).toContainText('12');
    await expect(hero).toContainText('3');
  });

  test('3 group settings rows render: 應用程式 / 共編 & 整合 / 帳號', async ({ page }) => {
    await page.goto('/account');
    // 用 testid 抓 group label，避免 mobile viewport 下 DesktopSidebar (display:none
    // 但 DOM 仍在) / GlobalBottomNav 的 nav span 干擾 getByText 順序判定。
    await expect(page.getByTestId('account-group-label-application')).toHaveText('應用程式');
    await expect(page.getByTestId('account-group-label-collab')).toHaveText('共編 & 整合');
    await expect(page.getByTestId('account-group-label-account')).toHaveText('帳號');
  });

  test('外觀設定 row click → /account/appearance', async ({ page }) => {
    await page.goto('/account');
    await page.getByTestId('account-row-appearance').click();
    await expect(page).toHaveURL(/\/account\/appearance$/);
    // AppearanceSettingsPage TitleBar
    await expect(page.getByRole('heading', { name: '外觀設定' })).toBeVisible();
  });

  test('通知設定 row click → /account/notifications', async ({ page }) => {
    await page.goto('/account');
    await page.getByTestId('account-row-notifications').click();
    await expect(page).toHaveURL(/\/account\/notifications$/);
  });

  test('登出 row click → confirm modal 開啟', async ({ page }) => {
    await page.goto('/account');
    await expect(page.getByTestId('confirm-modal-confirm')).not.toBeVisible();
    await page.getByTestId('account-row-logout').click();
    await expect(page.getByTestId('confirm-modal-confirm')).toBeVisible();
    await expect(page.getByText('確認登出？')).toBeVisible();
  });

  test('登出 confirm → POST /api/oauth/logout + navigate /login', async ({ page }) => {
    await page.goto('/account');
    await page.getByTestId('account-row-logout').click();
    await Promise.all([
      page.waitForRequest((req) => req.url().endsWith('/api/oauth/logout') && req.method() === 'POST'),
      page.getByTestId('confirm-modal-confirm').click(),
    ]);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('登出 modal 取消 → modal 關閉，URL 不變', async ({ page }) => {
    await page.goto('/account');
    await page.getByTestId('account-row-logout').click();
    await expect(page.getByTestId('confirm-modal-confirm')).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.getByTestId('confirm-modal-confirm')).not.toBeVisible();
    await expect(page).toHaveURL(/\/account$/);
  });

  test('sidebar 點 account chip → 已在 /account', async ({ page, viewport }) => {
    if (!viewport || viewport.width < 1024) {
      // sidebar 在 mobile 隱藏；只跑 desktop
      test.skip();
    }
    await page.goto('/trips');
    await page.getByTestId('sidebar-account-card').click();
    await expect(page).toHaveURL(/\/account$/);
  });
});
