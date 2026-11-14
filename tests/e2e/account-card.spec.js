// @ts-check
/**
 * 桌機帳號置中卡片（#1711，#1705 變體 A）：≥720 為 560×720 置中實心卡片，<720 維持全螢幕；
 * 卡片內個人卡一律直式（版面依「是否在 sheet 內」而非視窗寬）。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

async function openSheet(page, width) {
  await page.goto('/trips');
  await page.getByTestId(width < 1024 ? 'titlebar-account' : 'sidebar-account-card').click();
  const sheet = page.getByRole('dialog', { name: '帳號' });
  await sheet.getByTestId('account-hero').getByText('個行程').waitFor();
  return sheet;
}
const box = (loc) => loc.evaluate((e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; });

test.describe('帳號置中卡片', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', '寬度由本檔自行設定');
    await setupApiMocks(page);
  });

  test('1280×900：560×720 置中、個人卡直式、Esc 關閉並還原焦點', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const sheet = await openSheet(page, 1280);
    const p = await box(sheet.locator('.account-sheet-panel'));
    expect(Math.abs(p.w - 560)).toBeLessThan(1.5);
    expect(Math.abs(p.h - 720)).toBeLessThan(1.5);
    expect(Math.abs((p.l + p.r) / 2 - 640)).toBeLessThan(1.5);
    expect(Math.abs((p.t + p.b) / 2 - 450)).toBeLessThan(1.5);
    expect(await sheet.getByTestId('account-hero').evaluate((e) => getComputedStyle(e).flexDirection)).toBe('column');
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId('sidebar-account-card')).toBeFocused();
  });

  test('1280×600：矮視窗卡片縮到 100vh-48', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    const sheet = await openSheet(page, 1280);
    expect(Math.abs((await box(sheet.locator('.account-sheet-panel'))).h - 552)).toBeLessThan(1.5);
  });

  test('390 手機：全螢幕不變', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const sheet = await openSheet(page, 390);
    const p = await box(sheet.locator('.account-sheet-panel'));
    expect(p.w).toBeCloseTo(390, 0);
    expect(p.h).toBeCloseTo(844, 0);
  });

  test('直接打開 /account（全頁）桌機個人卡仍橫式', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/account');
    await page.getByTestId('account-hero').waitFor();
    expect(await page.getByTestId('account-hero').evaluate((e) => getComputedStyle(e).flexDirection)).toBe('row');
  });
});
