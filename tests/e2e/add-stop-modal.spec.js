// @ts-check
/**
 * AddStopModal E2E — Section 3 (terracotta-add-stop-modal)
 *
 * 驗 mockup section 14：trip-level「+ 加景點」trigger 開 modal，3 tab
 * (搜尋/收藏/自訂) + 5 subtab + footer counter + 自訂 form 提交 → timeline
 * 出現 entry。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

test.describe('AddStopModal — Section 3', () => {
  test('TripPage TitleBar 「加景點」 button trigger 開 modal', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray');
    const trigger = page.getByTestId('trip-add-stop-trigger');
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByTestId('add-stop-modal')).toBeVisible();
  });

  test('modal 含 3 tab + 5 category subtab', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray');
    await page.getByTestId('trip-add-stop-trigger').click();
    // 3 tabs
    await expect(page.getByTestId('add-stop-tab-search')).toBeVisible();
    await expect(page.getByTestId('add-stop-tab-saved')).toBeVisible();
    await expect(page.getByTestId('add-stop-tab-custom')).toBeVisible();
    // 5 subtabs (search default tab → 顯示 subtab bar)
    await expect(page.getByTestId('add-stop-subtab-all')).toBeVisible();
    await expect(page.getByTestId('add-stop-subtab-attraction')).toBeVisible();
    await expect(page.getByTestId('add-stop-subtab-food')).toBeVisible();
    await expect(page.getByTestId('add-stop-subtab-hotel')).toBeVisible();
    await expect(page.getByTestId('add-stop-subtab-shopping')).toBeVisible();
    await expect(page.getByText('熱門景點 · 沖繩')).toBeVisible();
    await expect(page.getByTestId('add-stop-search-card-90001')).toBeVisible();
  });

  test('切到收藏 tab → render 收藏 grid 或 empty state', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray');
    await page.getByTestId('trip-add-stop-trigger').click();
    await page.getByTestId('add-stop-tab-saved').click();
    // mock initialSavedPois 預設 [] → mockup empty state「還沒收藏景點」
    await expect(page.getByText(/還沒收藏景點/)).toBeVisible();
  });

  test('自訂 tab → form fields render + counter 隨 title 更新', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray');
    await page.getByTestId('trip-add-stop-trigger').click();
    await page.getByTestId('add-stop-tab-custom').click();
    await expect(page.getByTestId('add-stop-custom-title')).toBeVisible();
    await expect(page.getByTestId('add-stop-custom-time')).toBeVisible();
    await expect(page.getByTestId('add-stop-custom-duration')).toBeVisible();
    await expect(page.getByTestId('add-stop-custom-note')).toBeVisible();
    // mockup-parity-qa-fixes: counter 0 也顯示「已選 0 個 · 將加入 ...」（mockup section 14:6518）
    await expect(page.getByTestId('add-stop-counter')).toContainText('已選');
    await expect(page.getByTestId('add-stop-counter')).toContainText('將加入');
    await page.getByTestId('add-stop-custom-title').fill('海邊散步');
    await expect(page.getByTestId('add-stop-counter')).toContainText('已選 1 個');
  });

  test('自訂 tab 缺 title 點完成 → inline error', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray');
    await page.getByTestId('trip-add-stop-trigger').click();
    await page.getByTestId('add-stop-tab-custom').click();
    await page.getByTestId('add-stop-confirm').click();
    await expect(page.getByTestId('add-stop-custom-error')).toBeVisible();
    await expect(page.getByTestId('add-stop-custom-error')).toContainText('請輸入');
  });

  test('Esc key → modal 關閉', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray');
    await page.getByTestId('trip-add-stop-trigger').click();
    await expect(page.getByTestId('add-stop-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('add-stop-modal')).not.toBeVisible();
  });

  test('close button → modal 關閉', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray');
    await page.getByTestId('trip-add-stop-trigger').click();
    await page.getByTestId('add-stop-modal-close').click();
    await expect(page.getByTestId('add-stop-modal')).not.toBeVisible();
  });

  test('subtab 切 food → .is-active 套到該 subtab', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray');
    await page.getByTestId('trip-add-stop-trigger').click();
    await expect(page.getByTestId('add-stop-subtab-all')).toHaveClass(/is-active/);
    await page.getByTestId('add-stop-subtab-food').click();
    await expect(page.getByTestId('add-stop-subtab-food')).toHaveClass(/is-active/);
    await expect(page.getByTestId('add-stop-subtab-all')).not.toHaveClass(/is-active/);
  });
});
