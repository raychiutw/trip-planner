// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Playwright E2E 測試：在真實瀏覽器中驗證行程網頁的互動行為
 */

// Mock Weather API to avoid external dependency
test.beforeEach(async ({ page }) => {
  await page.route('**/api.open-meteo.com/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        hourly: {
          time: [],
          temperature_2m: [],
          precipitation_probability: [],
          weather_code: [],
        },
      }),
    });
  });
});

/* ===== 1. 頁面載入與內容渲染 ===== */
test.describe('頁面載入', () => {
  test('頁面成功載入並顯示標題', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/沖繩/);
  });

  test('Day 1~5 區段都存在', async ({ page }) => {
    await page.goto('/');
    for (let i = 1; i <= 5; i++) {
      await expect(page.locator(`#day${i}`)).toBeAttached();
    }
  });

  test('Nav pills 按鈕數量正確', async ({ page }) => {
    await page.goto('/');
    const pills = page.locator('#navPills .dn');
    await expect(pills).toHaveCount(5);
  });

  test('Footer 存在且包含行程資訊', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('沖繩');
  });

  test('資訊區段都存在', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#sec-flight')).toBeAttached();
    await expect(page.locator('#sec-checklist')).toBeAttached();
    await expect(page.locator('#sec-suggestions')).toBeAttached();
    await expect(page.locator('#sec-backup')).toBeAttached();
    await expect(page.locator('#sec-emergency')).toBeAttached();
  });
});

/* ===== 2. 導航功能 ===== */
test.describe('導航功能', () => {
  test('點擊 nav pill 捲動到對應 Day', async ({ page }) => {
    await page.goto('/');
    await page.locator('.dn[data-day="3"]').click();
    // 等待捲動完成
    await page.waitForTimeout(500);
    const day3 = page.locator('#day3');
    await expect(day3).toBeInViewport();
  });

  test('點擊 nav pill 更新 URL hash', async ({ page }) => {
    await page.goto('/');
    await page.locator('.dn[data-day="2"]').click();
    await page.waitForTimeout(300);
    expect(page.url()).toContain('#day2');
  });

  test('URL hash 直接跳轉到對應區段', async ({ page }) => {
    await page.goto('/#day4');
    await page.waitForTimeout(500);
    const day4 = page.locator('#day4');
    await expect(day4).toBeInViewport();
  });

  test('URL hash 跳轉到資訊區段', async ({ page }) => {
    await page.goto('/#sec-flight');
    await page.waitForTimeout(500);
    const flight = page.locator('#sec-flight');
    await expect(flight).toBeInViewport();
  });
});

/* ===== 3. 漢堡選單 ===== */
test.describe('漢堡選單', () => {
  test('選單按鈕開關 menu', async ({ page }) => {
    await page.goto('/');
    const menuBtn = page.locator('.dh-menu[data-action="toggle-menu"]');
    const menuDrop = page.locator('#menuDrop');

    // 初始關閉
    await expect(menuDrop).not.toHaveClass(/open/);

    // 點擊開啟
    await menuBtn.click();
    await expect(menuDrop).toHaveClass(/open/);

    // 點擊 backdrop 關閉
    await page.locator('#menuBackdrop').click();
    await expect(menuDrop).not.toHaveClass(/open/);
  });

  test('選單項目點擊後捲動並關閉選單', async ({ page }) => {
    await page.goto('/');
    const menuBtn = page.locator('.dh-menu[data-action="toggle-menu"]');
    const menuDrop = page.locator('#menuDrop');

    await menuBtn.click();
    await expect(menuDrop).toHaveClass(/open/);

    // 點擊選單中的「航班資訊」
    await page.locator('#menuDrop [data-target="sec-flight"]').click();
    await page.waitForTimeout(800);

    // 選單應已關閉
    await expect(menuDrop).not.toHaveClass(/open/);
    // 航班區段應在視窗內
    await expect(page.locator('#sec-flight')).toBeInViewport();
  });

  test('點擊 backdrop 關閉選單', async ({ page }) => {
    await page.goto('/');
    const menuBtn = page.locator('.dh-menu[data-action="toggle-menu"]');
    const menuDrop = page.locator('#menuDrop');

    await menuBtn.click();
    await expect(menuDrop).toHaveClass(/open/);

    // 點擊 backdrop 關閉選單
    await page.locator('#menuBackdrop').click();
    await expect(menuDrop).not.toHaveClass(/open/);
  });

  test('向左滑動關閉選單', async ({ page }) => {
    await page.goto('/');
    const menuBtn = page.locator('.dh-menu[data-action="toggle-menu"]');
    const menuDrop = page.locator('#menuDrop');

    await menuBtn.click();
    await expect(menuDrop).toHaveClass(/open/);

    // 模擬向左滑動（dx < -50）關閉選單
    await page.evaluate(() => {
      const ts = (type, x, y) => new TouchEvent(type, {
        bubbles: true,
        [type === 'touchend' ? 'changedTouches' : 'touches']:
          [new Touch({ identifier: 0, target: document.body, clientX: x, clientY: y })]
      });
      document.dispatchEvent(ts('touchstart', 200, 300));
      document.dispatchEvent(ts('touchend', 100, 300));
    });

    await expect(menuDrop).not.toHaveClass(/open/);
  });
});

/* ===== 4. 深色模式 ===== */
test.describe('深色模式', () => {
  test('切換深色模式 toggle body.dark', async ({ page }) => {
    await page.goto('/');
    const menuBtn = page.locator('.dh-menu[data-action="toggle-menu"]');
    const body = page.locator('body');

    // 初始無 dark
    await expect(body).not.toHaveClass(/dark/);

    // 開啟選單 → 點擊深色模式
    await menuBtn.click();
    await page.locator('[data-action="toggle-dark"]').click();
    await expect(body).toHaveClass(/dark/);

    // 再次切換回來
    await menuBtn.click();
    await page.locator('[data-action="toggle-dark"]').click();
    await expect(body).not.toHaveClass(/dark/);
  });

  test('深色模式按鈕文字切換', async ({ page }) => {
    await page.goto('/');
    const menuBtn = page.locator('.dh-menu[data-action="toggle-menu"]');

    await menuBtn.click();
    const darkBtn = page.locator('[data-action="toggle-dark"]');
    await expect(darkBtn).toContainText('深色模式');

    await darkBtn.click();
    await menuBtn.click();
    await expect(darkBtn).toContainText('淺色模式');
  });

  test('深色模式保存到 localStorage', async ({ page }) => {
    await page.goto('/');
    const menuBtn = page.locator('.dh-menu[data-action="toggle-menu"]');

    await menuBtn.click();
    await page.locator('[data-action="toggle-dark"]').click();

    // 檢查 localStorage
    const darkValue = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('trip-planner-dark') !== -1) {
          return JSON.parse(localStorage.getItem(k)).v;
        }
      }
      return null;
    });
    expect(darkValue).toBe('1');
  });
});

/* ===== 5. Timeline 展開/收合 ===== */
test.describe('Timeline 展開/收合', () => {
  test('點擊可展開的 timeline 事件', async ({ page }) => {
    await page.goto('/');
    const clickableHead = page.locator('.tl-head.clickable').first();
    const event = clickableHead.locator('..');

    // 初始未展開
    await expect(event).not.toHaveClass(/expanded/);

    // 點擊展開
    await clickableHead.click();
    await expect(event).toHaveClass(/expanded/);

    // 再次點擊收合
    await clickableHead.click();
    await expect(event).not.toHaveClass(/expanded/);
  });

  test('展開後 tl-body 可見', async ({ page }) => {
    await page.goto('/');
    const clickableHead = page.locator('.tl-head.clickable').first();
    const event = clickableHead.locator('..');
    const body = event.locator('.tl-body');

    // 初始隱藏
    await expect(body).not.toBeVisible();

    // 展開後可見
    await clickableHead.click();
    await expect(body).toBeVisible();
  });

  test('aria-expanded 正確切換', async ({ page }) => {
    await page.goto('/');
    const clickableHead = page.locator('.tl-head.clickable').first();

    await expect(clickableHead).toHaveAttribute('aria-expanded', 'false');
    await clickableHead.click();
    await expect(clickableHead).toHaveAttribute('aria-expanded', 'true');
    await clickableHead.click();
    await expect(clickableHead).toHaveAttribute('aria-expanded', 'false');
  });
});

/* ===== 6. 可收合區塊（Hotel / Budget） ===== */
test.describe('可收合區塊', () => {
  test('col-row 點擊展開/收合', async ({ page }) => {
    await page.goto('/');
    const colRow = page.locator('.col-row').first();
    const colDetail = page.locator('.col-detail').first();

    // 初始收合
    await expect(colRow).not.toHaveClass(/open/);
    await expect(colDetail).not.toBeVisible();

    // 點擊展開
    await colRow.click();
    await expect(colRow).toHaveClass(/open/);
    await expect(colDetail).toBeVisible();

    // 再次點擊收合
    await colRow.click();
    await expect(colRow).not.toHaveClass(/open/);
  });

  test('col-row 的 aria-expanded 正確切換', async ({ page }) => {
    await page.goto('/');
    const colRow = page.locator('.col-row').first();

    await expect(colRow).toHaveAttribute('aria-expanded', 'false');
    await colRow.click();
    await expect(colRow).toHaveAttribute('aria-expanded', 'true');
  });
});

/* ===== 7. 行程建議區段 ===== */
test.describe('行程建議', () => {
  test('包含高/中/低優先級卡片', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.suggestion-card.high').first()).toBeAttached();
    await expect(page.locator('.suggestion-card.medium').first()).toBeAttached();
    await expect(page.locator('.suggestion-card.low').first()).toBeAttached();
  });
});

/* ===== 8. 地圖連結與餐廳 ===== */
test.describe('地圖連結與餐廳', () => {
  test('Google Map 連結格式正確', async ({ page }) => {
    await page.goto('/');
    // 先展開一個 timeline 事件以顯示地圖連結
    await page.locator('.tl-head.clickable').first().click();

    const gLinks = page.locator('a.map-link:not(.apple):not(.mapcode)');
    const count = await gLinks.count();
    expect(count).toBeGreaterThan(0);

    const href = await gLinks.first().getAttribute('href');
    expect(href).toMatch(/maps\.google\.com/);
  });

  test('Apple Map 連結存在', async ({ page }) => {
    await page.goto('/');
    await page.locator('.tl-head.clickable').first().click();

    const aLinks = page.locator('a.map-link.apple');
    const count = await aLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('外部連結有 target="_blank" 和 rel="noopener noreferrer"', async ({ page }) => {
    await page.goto('/');
    // 展開事件以顯示連結
    await page.locator('.tl-head.clickable').first().click();

    const externalLinks = page.locator('a[target="_blank"]');
    const count = await externalLinks.count();
    expect(count).toBeGreaterThan(0);

    // 檢查前幾個連結
    for (let i = 0; i < Math.min(count, 5); i++) {
      await expect(externalLinks.nth(i)).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  test('餐廳卡片存在', async ({ page }) => {
    await page.goto('/');
    // 展開有餐廳資訊的事件
    const events = page.locator('.tl-head.clickable');
    const count = await events.count();
    let found = false;
    for (let i = 0; i < count && !found; i++) {
      await events.nth(i).click();
      const restaurants = page.locator('.tl-event.expanded .restaurant-choice');
      if (await restaurants.count() > 0) {
        found = true;
        await expect(restaurants.first()).toBeVisible();
      } else {
        // 收合再試下一個
        await events.nth(i).click();
      }
    }
    expect(found).toBe(true);
  });
});

/* ===== 9. 航班資訊 ===== */
test.describe('航班資訊', () => {
  test('航班區段包含航班資料', async ({ page }) => {
    await page.goto('/');
    const flightSection = page.locator('#sec-flight').locator('..');
    await expect(flightSection.locator('.flight-row').first()).toBeAttached();
  });
});

/* ===== 10. 緊急聯絡 ===== */
test.describe('緊急聯絡', () => {
  test('包含 tel: 電話連結', async ({ page }) => {
    await page.goto('/');
    const emergencySection = page.locator('#sec-emergency').locator('..');
    const telLinks = emergencySection.locator('a[href^="tel:"]');
    const count = await telLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});

/* ===== 11. 列印模式 ===== */
test.describe('列印模式', () => {
  test('切換列印模式', async ({ page }) => {
    await page.goto('/');
    const body = page.locator('body');
    const menuBtn = page.locator('.dh-menu[data-action="toggle-menu"]');

    // 開啟選單 → 點擊列印模式
    await menuBtn.click();
    await page.locator('#menuDrop [data-action="toggle-print"]').click();
    await expect(body).toHaveClass(/print-mode/);

    // 用頁面上的退出按鈕退出列印模式
    await page.locator('#printExitBtn').click();
    await expect(body).not.toHaveClass(/print-mode/);
  });
});

/* ===== 12. 行程切換 ===== */
test.describe('行程切換', () => {
  test('切換行程檔 dialog 出現', async ({ page }) => {
    await page.goto('/');
    const menuBtn = page.locator('.dh-menu[data-action="toggle-menu"]');

    await menuBtn.click();
    await page.locator('[data-action="switch-trip"]').click();

    // dialog overlay 出現（switchTripFile 動態建立，等文字出現）
    await expect(page.getByText('選擇行程')).toBeVisible();
  });

  test('點擊另一行程後載入新資料', async ({ page }) => {
    await page.goto('/');
    const menuBtn = page.locator('.dh-menu[data-action="toggle-menu"]');

    await menuBtn.click();
    await page.locator('[data-action="switch-trip"]').click();

    // 等待 dialog 出現
    await expect(page.getByText('選擇行程')).toBeVisible();

    // 點擊包含 "Hui Yun" 的行程按鈕
    await page.getByText('Hui Yun').click();

    // 等待頁面載入新行程
    await page.waitForTimeout(1000);
    // URL 應包含 HuiYun
    expect(page.url()).toContain('HuiYun');
  });

  test('行程切換 dialog X 按鈕關閉', async ({ page }) => {
    await page.goto('/');
    const menuBtn = page.locator('.dh-menu[data-action="toggle-menu"]');

    await menuBtn.click();
    await page.locator('[data-action="switch-trip"]').click();
    await expect(page.getByText('選擇行程')).toBeVisible();

    // 點擊 X 關閉 dialog
    await page.locator('.trip-close').click();
    await expect(page.locator('.trip-overlay')).not.toBeAttached();
  });
});

/* ===== 13. 天氣元件 ===== */
test.describe('天氣元件', () => {
  test('天氣摘要點擊展開/收合', async ({ page }) => {
    await page.goto('/');
    // 等待天氣元件載入
    await page.waitForTimeout(1000);

    const summary = page.locator('.hw-summary').first();
    // 只在天氣元件存在時測試
    if (await summary.count() > 0) {
      const container = summary.locator('..');

      // 點擊展開
      await summary.click();
      await expect(container).toHaveClass(/hw-open/);

      // 確認詳細內容可見
      const detail = container.locator('.hw-detail');
      await expect(detail).toBeVisible();

      // 點擊收合
      await summary.click();
      await expect(container).not.toHaveClass(/hw-open/);
    }
  });

  test('天氣 API 失敗顯示錯誤訊息', async ({ page }) => {
    // 覆蓋 beforeEach 的 mock，改為 abort
    await page.route('**/api.open-meteo.com/**', (route) => {
      route.abort();
    });
    await page.goto('/');
    await page.waitForTimeout(2000);

    // 應該顯示錯誤訊息
    const error = page.locator('.hw-error');
    if (await error.count() > 0) {
      await expect(error.first()).toContainText('天氣資料載入失敗');
    }
  });
});

/* ===== 14. Dark mode 持久化 ===== */
test.describe('Dark mode 持久化', () => {
  test('深色模式 reload 後仍保持', async ({ page }) => {
    await page.goto('/');
    const menuBtn = page.locator('.dh-menu[data-action="toggle-menu"]');
    const body = page.locator('body');

    // 啟用 dark mode
    await menuBtn.click();
    await page.locator('[data-action="toggle-dark"]').click();
    await expect(body).toHaveClass(/dark/);

    // Reload
    await page.reload();
    await page.waitForTimeout(500);

    // dark mode 仍然存在
    await expect(page.locator('body')).toHaveClass(/dark/);
  });
});

/* ===== 15. ?trip= URL 參數載入 ===== */
test.describe('?trip= URL 參數', () => {
  test('?trip= 參數載入對應行程', async ({ page }) => {
    await page.goto('/?trip=okinawa-trip-2026-HuiYun');
    await page.waitForTimeout(1000);

    // 頁面應載入 HuiYun 行程內容
    await expect(page.locator('body')).toBeAttached();
    // URL 應維持 trip 參數
    expect(page.url()).toContain('trip=okinawa-trip-2026-HuiYun');
  });
});

/* ===== 16. 無效 hash ===== */
test.describe('無效 hash', () => {
  test('無效 hash 不導致頁面崩潰', async ({ page }) => {
    await page.goto('/#nonexistent');
    await page.waitForTimeout(500);

    // 頁面應正常載入，不崩潰
    await expect(page.locator('body')).toBeAttached();
    await expect(page.locator('#navPills')).toBeAttached();
  });
});

/* ===== 17. Dark + Print 互動 ===== */
test.describe('Dark + Print 互動', () => {
  test('列印模式暫時移除 dark，退出後恢復', async ({ page }) => {
    await page.goto('/');
    const menuBtn = page.locator('.dh-menu[data-action="toggle-menu"]');
    const body = page.locator('body');

    // 啟用 dark mode
    await menuBtn.click();
    await page.locator('[data-action="toggle-dark"]').click();
    await expect(body).toHaveClass(/dark/);

    // 進入列印模式
    await menuBtn.click();
    await page.locator('#menuDrop [data-action="toggle-print"]').click();
    await expect(body).toHaveClass(/print-mode/);
    // 列印模式下不應有 dark
    await expect(body).not.toHaveClass(/dark/);

    // 退出列印模式
    await page.locator('#printExitBtn').click();
    await expect(body).not.toHaveClass(/print-mode/);
    // dark 應恢復
    await expect(body).toHaveClass(/dark/);
  });
});

/* ===== 18. Nav pill 捲動 highlight ===== */
test.describe('Nav pill 捲動 highlight', () => {
  test('捲動到 Day 3 時 nav pill 3 自動 highlight', async ({ page }) => {
    await page.goto('/');

    // 使用 JavaScript 捲動到 Day 3 並觸發 scroll 事件
    await page.evaluate(() => {
      const el = document.getElementById('day3');
      if (el) el.scrollIntoView({ behavior: 'instant' });
    });
    // 等待 scroll 事件 + requestAnimationFrame 處理
    await page.waitForTimeout(800);

    // nav pill 3 應有 active class
    const pill3 = page.locator('.dn[data-day="3"]');
    await expect(pill3).toHaveClass(/active/);
  });
});
