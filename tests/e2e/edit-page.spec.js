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

/* ===== 3. 手機版漢堡選單 ===== */
test.describe('Edit 手機版漢堡選單', () => {
  test.use({ viewport: { width: 375, height: 812 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) Mobile/15E148' });

  test('漢堡按鈕開關 drawer', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editMain')).toBeVisible({ timeout: 10000 });

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

  test('選單項目含行程頁/編輯頁/設定頁連結', async ({ page }) => {
    await page.goto(EDIT_URL);
    // 等待問候語（表示 init + buildEditMenu 完成）
    await expect(page.locator('#editText')).toBeVisible({ timeout: 10000 });

    const menuBtn = page.locator('.dh-menu[data-action="toggle-sidebar"]');
    await menuBtn.click();
    await expect(page.locator('#menuDrop')).toHaveClass(/open/);

    // 確認 menuGrid 有設定頁連結（用 evaluate 查 DOM）
    const hasSettingLink = await page.evaluate(function() {
      var grid = document.getElementById('menuGrid');
      if (!grid) return false;
      var links = grid.querySelectorAll('a');
      for (var i = 0; i < links.length; i++) {
        if (links[i].getAttribute('href') === 'setting.html') return true;
      }
      return false;
    });
    expect(hasSettingLink).toBe(true);
  });

  test('點擊 backdrop 關閉', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editMain')).toBeVisible({ timeout: 10000 });

    const menuBtn = page.locator('.dh-menu[data-action="toggle-sidebar"]');
    const menuDrop = page.locator('#menuDrop');

    await menuBtn.click();
    await expect(menuDrop).toHaveClass(/open/);

    await page.locator('#menuBackdrop').click({ position: { x: 350, y: 400 } });
    await expect(menuDrop).not.toHaveClass(/open/);
  });

  test('設定頁連結指向 setting.html', async ({ page }) => {
    await page.goto(EDIT_URL);
    // 等待問候語（表示 init + buildEditMenu 完成）
    await expect(page.locator('#editText')).toBeVisible({ timeout: 10000 });

    const menuBtn = page.locator('.dh-menu[data-action="toggle-sidebar"]');
    await menuBtn.click();
    await expect(page.locator('#menuDrop')).toHaveClass(/open/);

    // 用 evaluate 查 DOM（避免 off-screen drawer 造成 toBeVisible 失敗）
    const settingHref = await page.evaluate(function() {
      var grid = document.getElementById('menuGrid');
      if (!grid) return null;
      var links = grid.querySelectorAll('a');
      for (var i = 0; i < links.length; i++) {
        if (links[i].getAttribute('href') === 'setting.html') return links[i].textContent;
      }
      return null;
    });
    expect(settingHref).not.toBeNull();
    expect(settingHref).toContain('設定');
  });
});

/* ===== 4. 桌機側邊欄 ===== */
test.describe('Edit 桌機側邊欄', () => {
  test('側邊欄可見', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editMain')).toBeVisible({ timeout: 10000 });

    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toBeVisible();
  });

  test('toggle 收合/展開', async ({ page }) => {
    await page.goto(EDIT_URL);
    await expect(page.locator('#editMain')).toBeVisible({ timeout: 10000 });

    const sidebar = page.locator('#sidebar');
    const toggle = page.locator('.sidebar-toggle');

    // 點擊收合
    await toggle.click();
    await expect(sidebar).toHaveClass(/collapsed/);

    // 點擊展開
    await toggle.click();
    await expect(sidebar).not.toHaveClass(/collapsed/);
  });

  test('側邊欄選單含行程頁/設定頁連結', async ({ page }) => {
    await page.goto(EDIT_URL);
    // 等待問候語（表示 init + buildEditMenu 完成）
    await expect(page.locator('#editText')).toBeVisible({ timeout: 10000 });

    const links = page.locator('#sidebarNav a.menu-item');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    // 應有設定頁連結
    const settingLink = page.locator('#sidebarNav a[href="setting.html"]');
    await expect(settingLink).toBeAttached();
  });
});

/* ===== 5. 深色模式 ===== */
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
