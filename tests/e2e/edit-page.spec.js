// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Playwright E2E 測試：edit.html 漢堡選單 + X 關閉 + 深色模式
 * 注意：serve 的 cleanUrls 會將 /edit.html 重導為 /edit（301），
 * 且不保留 query params，因此測試一律使用 /edit?trip=xxx 路徑。
 */

var VALID_SLUG = 'okinawa-trip-2026-Ray';
var EDIT_URL = '/edit?trip=' + VALID_SLUG;

/* ===== 1. 頁面載入 ===== */
test.describe('Edit 頁面載入', () => {
  test('無 ?trip= 參數 → 重導 index.html', async ({ page }) => {
    await page.goto('/edit');
    // window.location.replace('index.html') → serve cleanUrls → /
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain('/edit');
  });

  test('有效 ?trip= → 顯示編輯表單與行程名稱', async ({ page }) => {
    await page.goto(EDIT_URL);

    // 等待表單渲染
    const textarea = page.locator('#editText');
    await expect(textarea).toBeVisible({ timeout: 10000 });

    // 應顯示行程名稱
    const boundInfo = page.locator('.edit-bound-info');
    await expect(boundInfo).toBeVisible();
    await expect(boundInfo).toContainText('Ray');
  });

  test('無效 ?trip= → 顯示錯誤訊息', async ({ page }) => {
    await page.goto('/edit?trip=nonexistent-trip');

    const error = page.locator('.edit-status.error');
    await expect(error).toBeVisible({ timeout: 10000 });
    await expect(error).toContainText('找不到行程');
  });
});

/* ===== 2. X 關閉按鈕 ===== */
test.describe('X 關閉按鈕', () => {
  test('可見且 href 含 index.html?trip={slug}', async ({ page }) => {
    await page.goto(EDIT_URL);
    // 等待 init 完成（X 按鈕 href 在 fetch 後設定）
    await expect(page.locator('#editText')).toBeVisible({ timeout: 10000 });

    const closeBtn = page.locator('.edit-card-header .edit-close');
    await expect(closeBtn).toBeVisible();

    const href = await closeBtn.getAttribute('href');
    expect(href).toContain('index.html');
    expect(href).toContain('trip=' + VALID_SLUG);
  });
});

/* ===== 3. 手機版漢堡選單 ===== */
test.describe('Edit 手機版漢堡選單', () => {
  test.use({ viewport: { width: 375, height: 812 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) Mobile/15E148' });

  test('漢堡按鈕開關 drawer', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editText')).toBeVisible({ timeout: 10000 });

    const menuBtn = page.locator('.dh-menu[data-action="toggle-sidebar"]');
    const menuDrop = page.locator('#menuDrop');

    // 初始關閉
    await expect(menuDrop).not.toHaveClass(/open/);

    // 點擊開啟
    await menuBtn.click();
    await expect(menuDrop).toHaveClass(/open/);

    // 點擊 backdrop 關閉
    await page.locator('#menuBackdrop').click({ position: { x: 350, y: 400 } });
    await expect(menuDrop).not.toHaveClass(/open/);
  });

  test('選單項目為 <a> 連結指向 index.html?trip={slug}#sec-xxx', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editText')).toBeVisible({ timeout: 10000 });

    const menuBtn = page.locator('.dh-menu[data-action="toggle-sidebar"]');
    await menuBtn.click();
    await expect(page.locator('#menuDrop')).toHaveClass(/open/);

    // 檢查選單連結
    const links = page.locator('#menuGrid a.menu-item');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    // 第一個連結應指向航班資訊
    const firstHref = await links.first().getAttribute('href');
    expect(firstHref).toContain('index.html?trip=' + VALID_SLUG);
    expect(firstHref).toContain('#sec-flight');
  });

  test('點擊 backdrop 關閉', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editText')).toBeVisible({ timeout: 10000 });

    const menuBtn = page.locator('.dh-menu[data-action="toggle-sidebar"]');
    const menuDrop = page.locator('#menuDrop');

    await menuBtn.click();
    await expect(menuDrop).toHaveClass(/open/);

    await page.locator('#menuBackdrop').click({ position: { x: 350, y: 400 } });
    await expect(menuDrop).not.toHaveClass(/open/);
  });

  test('切換行程檔指向 switch.html', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editText')).toBeVisible({ timeout: 10000 });

    const menuBtn = page.locator('.dh-menu[data-action="toggle-sidebar"]');
    await menuBtn.click();
    await expect(page.locator('#menuDrop')).toHaveClass(/open/);

    const switchLink = page.locator('#menuGrid a[href="switch.html"]');
    await expect(switchLink).toBeVisible();
    await expect(switchLink).toContainText('切換行程檔');
  });
});

/* ===== 4. 桌機側邊欄 ===== */
test.describe('Edit 桌機側邊欄', () => {
  test('側邊欄可見', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editText')).toBeVisible({ timeout: 10000 });

    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toBeVisible();
  });

  test('toggle 收合/展開', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editText')).toBeVisible({ timeout: 10000 });

    const sidebar = page.locator('#sidebar');
    const toggle = page.locator('.sidebar-toggle');

    // 點擊收合
    await toggle.click();
    await expect(sidebar).toHaveClass(/collapsed/);

    // 點擊展開
    await toggle.click();
    await expect(sidebar).not.toHaveClass(/collapsed/);
  });

  test('選單項目為 <a> 連結', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editText')).toBeVisible({ timeout: 10000 });

    const links = page.locator('#sidebarNav a.menu-item');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    const firstHref = await links.first().getAttribute('href');
    expect(firstHref).toContain('index.html?trip=' + VALID_SLUG);
    expect(firstHref).toContain('#sec-flight');
  });
});

/* ===== 5. 深色模式 ===== */
test.describe('Edit 深色模式', () => {
  test('toggle-dark 切換 body.dark', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editText')).toBeVisible({ timeout: 10000 });

    const body = page.locator('body');
    await expect(body).not.toHaveClass(/dark/);

    // 點擊側邊欄深色模式按鈕
    await page.locator('#sidebarNav [data-action="toggle-dark"]').click();
    await expect(body).toHaveClass(/dark/);

    // 再次切換回來
    await page.locator('#sidebarNav [data-action="toggle-dark"]').click();
    await expect(body).not.toHaveClass(/dark/);
  });

  test('按鈕文字更新（深色/淺色）', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editText')).toBeVisible({ timeout: 10000 });

    const darkBtn = page.locator('#sidebarNav [data-action="toggle-dark"]');
    await expect(darkBtn).toContainText('深色模式');

    await darkBtn.click();
    await expect(darkBtn).toContainText('淺色模式');
  });
});
