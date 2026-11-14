// @ts-check
/**
 * 桌機 HIG 16（#1708）：側欄整欄隱藏。切換鈕、⌥⇧S、<1200px 自動收合（推開內容）、手動偏好、reduced motion。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'chromium', '只在 chromium 專案跑'); });

const TRIP = 'okinawa-trip-2026-Ray';
const TOGGLE = /^(隱藏|顯示)側欄/;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await setupApiMocks(page);
  await page.route(/maps\.googleapis\.com/, (r) => r.abort());
});

// 收合時側欄內與中欄左上各有一顆（側欄那顆在 visibility 過渡中仍可見），取 DOM 最後一顆＝實際可點的
const toggle = (page) => page.getByRole('button', { name: TOGGLE }).last();
const mainX = async (page) => (await page.getByTestId('app-shell-main').boundingBox())?.x ?? -1;

test('按鈕切換：整欄隱藏、中欄推到最左、aria-expanded 跟著變，偏好存本機', async ({ page }) => {
  await page.goto(`/trips?selected=${TRIP}`);
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle(page)).toHaveAttribute('aria-controls', 'desktop-sidebar');
  expect(await mainX(page)).toBeGreaterThan(200);

  await toggle(page).click();
  await expect(page.getByTestId('app-shell-sidebar')).toBeHidden();
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => mainX(page)).toBeLessThan(2);

  await page.reload();
  await expect(page.getByTestId('app-shell-sidebar')).toBeHidden();
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');

  await toggle(page).click();
  await expect(page.getByTestId('app-shell-sidebar')).toBeVisible();
  await expect.poll(() => mainX(page)).toBeGreaterThan(200);
});

test('⌥⇧S 切換，按鈕帶 aria-keyshortcuts 與 tooltip', async ({ page }) => {
  await page.goto(`/trips?selected=${TRIP}`);
  await expect(toggle(page)).toHaveAttribute('aria-keyshortcuts', 'Alt+Shift+S');
  await expect(toggle(page)).toHaveAttribute('title', /隱藏側欄.*⌥⇧S/);
  await page.keyboard.press('Alt+Shift+s');
  await expect(page.getByTestId('app-shell-sidebar')).toBeHidden();
  await page.keyboard.press('Alt+Shift+s');
  await expect(page.getByTestId('app-shell-sidebar')).toBeVisible();
});

test('視窗 <1200 自動收合，手動展開是推開內容；跨過門檻重設；不覆寫手動偏好', async ({ page }) => {
  await page.goto(`/trips?selected=${TRIP}`);
  await page.setViewportSize({ width: 1100, height: 800 });
  await expect(page.getByTestId('app-shell-sidebar')).toBeHidden();
  await toggle(page).click(); // 窄視窗手動展開
  await expect(page.getByTestId('app-shell-sidebar')).toBeVisible();
  await expect.poll(() => mainX(page)).toBeGreaterThan(200);

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByTestId('app-shell-sidebar')).toBeVisible();
  await page.setViewportSize({ width: 1100, height: 800 });
  await expect(page.getByTestId('app-shell-sidebar')).toBeHidden(); // 窄視窗的展開不跨門檻保留

  // 寬視窗手動收合 → 窄再寬，仍是收合（手動偏好沒被自動行為覆寫）
  await page.setViewportSize({ width: 1280, height: 800 });
  await toggle(page).click();
  await page.setViewportSize({ width: 1100, height: 800 });
  await toggle(page).click(); // 窄視窗展開，不能改寫偏好
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByTestId('app-shell-sidebar')).toBeHidden();
});

test('reduced motion：欄寬不做動畫', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/trips?selected=${TRIP}`);
  const dur = await page.getByTestId('app-shell').evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(dur.split(',').every((d) => parseFloat(d) < 0.001), dur).toBe(true);
});

test('手機寬度沒有側欄切換鈕', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/trips?selected=${TRIP}`);
  await expect(toggle(page)).toHaveCount(0);
});
