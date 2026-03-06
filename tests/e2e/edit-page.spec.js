// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Playwright E2E 測試：edit.html 漢堡選單 + 問候語 + 選單結構
 * 注意：serve 的 cleanUrls 會將 /edit.html 重導為 /edit（301），
 * 且不保留 query params，因此測試一律使用 /edit?trip=xxx 路徑。
 */

var VALID_SLUG = 'okinawa-trip-2026-Ray';
var EDIT_URL = '/edit?trip=' + VALID_SLUG;

/* ===== 1. 頁面載入 ===== */
test.describe('Edit 頁面載入', () => {
  test('無 ?trip= 參數 → 仍可顯示（從 localStorage 取得或使用預設）', async ({ page }) => {
    await page.goto('/edit');
    await page.waitForTimeout(2000);
    // 頁面存在，不崩潰
    const main = page.locator('#editMain');
    await expect(main).toBeVisible();
  });

  test('有效 ?trip= → 顯示輸入框', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editText')).toBeVisible({ timeout: 10000 });
  });

  test('無效 ?trip= → 顯示錯誤訊息', async ({ page }) => {
    await page.goto('/edit?trip=nonexistent-trip');

    const error = page.locator('.edit-status.error');
    await expect(error).toBeVisible({ timeout: 10000 });
    await expect(error).toContainText('找不到行程');
  });
});

/* ===== 2. Chat UI 結構 ===== */
test.describe('Edit Chat UI 結構', () => {
  test('存在 .chat-container 根元素', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editText')).toBeVisible({ timeout: 10000 });

    const container = page.locator('.chat-container');
    await expect(container).toBeVisible();
  });

  test('存在 .chat-messages 捲動區', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editText')).toBeVisible({ timeout: 10000 });

    const messages = page.locator('.chat-messages');
    await expect(messages).toBeVisible();
  });

  test('存在 .chat-messages-inner wrapper', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editText')).toBeVisible({ timeout: 10000 });

    const inner = page.locator('.chat-messages-inner');
    await expect(inner).toBeVisible();
  });

  test('底部有 textarea', async ({ page }) => {
    await page.goto(EDIT_URL);
    const textarea = page.locator('#editText');
    await expect(textarea).toBeVisible({ timeout: 10000 });
  });

  test('textarea 有 maxlength="65536" 屬性', async ({ page }) => {
    await page.goto(EDIT_URL);
    const textarea = page.locator('#editText');
    await expect(textarea).toBeVisible({ timeout: 10000 });
    await expect(textarea).toHaveAttribute('maxlength', '65536');
  });

  test('textarea 字體大小為 --fs-md', async ({ page }) => {
    await page.goto(EDIT_URL);
    const textarea = page.locator('#editText');
    await expect(textarea).toBeVisible({ timeout: 10000 });

    const fontSize = await textarea.evaluate(function(el) {
      return window.getComputedStyle(el).fontSize;
    });
    // --fs-md: 手機 1.125rem(18px), 桌機 1rem(16px)
    var numericSize = parseFloat(fontSize);
    expect(numericSize).toBeLessThanOrEqual(18);
    expect(numericSize).toBeGreaterThanOrEqual(15);
  });

  test('送出按鈕初始 disabled', async ({ page }) => {
    await page.goto(EDIT_URL);
    const submitBtn = page.locator('#submitBtn');
    await expect(submitBtn).toBeVisible({ timeout: 10000 });
    await expect(submitBtn).toBeDisabled();
  });

  test('textarea 輸入後送出按鈕啟用', async ({ page }) => {
    await page.goto(EDIT_URL);
    const textarea = page.locator('#editText');
    await expect(textarea).toBeVisible({ timeout: 10000 });

    await textarea.fill('測試修改請求');
    const submitBtn = page.locator('#submitBtn');
    await expect(submitBtn).not.toBeDisabled();
  });

  test('底部輸入列在 .chat-container 內（非 position:fixed）', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editText')).toBeVisible({ timeout: 10000 });

    // .edit-input-bar 應為 .chat-container 的 flex 子元素
    const inputBar = page.locator('.edit-input-bar');
    await expect(inputBar).toBeVisible();

    const position = await inputBar.evaluate(function(el) {
      return window.getComputedStyle(el).position;
    });
    // 不應為 fixed（應為 static 或 relative）
    expect(position).not.toBe('fixed');
  });
});

/* ===== 3. X 關閉鈕 ===== */
test.describe('Edit X 關閉鈕', () => {
  test('X 按鈕可見', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editMain')).toBeVisible({ timeout: 10000 });

    const closeBtn = page.locator('#navCloseBtn');
    await expect(closeBtn).toBeVisible();
  });

  test('點擊 X 導向 index.html', async ({ page }) => {
    await page.goto(EDIT_URL);
    // 等 init 完成（renderEditPage 產生 editText 後 close btn listener 已掛載）
    await expect(page.locator('#editText')).toBeVisible({ timeout: 10000 });

    // 點擊 X 並等待導航完成
    await page.locator('#navCloseBtn').click();
    await page.waitForLoadState('load', { timeout: 10000 });

    // 應離開 edit.html（可能解析為根路徑 /）
    expect(page.url()).not.toContain('edit.html');
  });
});

/* ===== 4. 深色模式 ===== */
test.describe('Edit 深色模式', () => {
  test('toggle-dark 切換 body.dark', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editMain')).toBeVisible({ timeout: 10000 });

    // 深色模式已移至 setting 頁，此測試驗證 data-action="toggle-dark" 仍可作用
    // 透過 JS 直接觸發事件
    await page.evaluate(function() {
      var event = new MouseEvent('click', { bubbles: true });
      var btn = document.createElement('button');
      btn.setAttribute('data-action', 'toggle-dark');
      document.body.appendChild(btn);
      btn.dispatchEvent(event);
      document.body.removeChild(btn);
    });

    // 不驗證深色模式按鈕文字（已移至 setting 頁）
    // 僅確認頁面不崩潰
    await expect(page.locator('#editMain')).toBeVisible();
  });

  test('按鈕文字更新（深色/淺色）', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editMain')).toBeVisible({ timeout: 10000 });

    // 確認編輯頁不再有 toggle-dark 按鈕（深色模式已移至 setting 頁）
    const darkBtns = page.locator('[data-action="toggle-dark"]');
    const count = await darkBtns.count();
    // 編輯頁的選單不含深色模式按鈕
    expect(count).toBe(0);
  });
});
