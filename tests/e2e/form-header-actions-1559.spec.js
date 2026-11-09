// @ts-check
/**
 * #1559 表單頁主要動作全部放標題列 — 真瀏覽器驗證。
 * chromium（桌機寬）與 mobile-chrome（Pixel 5, 393 寬）兩個 project 都會跑：
 *   - 主要動作在標題列內、標題列 sticky、無 .tp-page-bottom-bar
 *   - 手機寬度也顯示文字 label（不 icon-only），觸控目標 ≥44px
 *   - 送出中 busy label + disabled、返回鈕同時停用
 *   - 失敗：標題列正下方 role=alert 橫幅，主要動作恢復可點
 *   - EditTripPage：「完成」+「已自動儲存」+ 發布狀態卡片
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');
import { pickDate } from './_helpers/pickDate.js';

const TRIP = 'okinawa-trip-2026-Ray';

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

/** 標題列：操作頁是 StackPanelHeader（桌機中欄另有行程詳情的 TitleBar，所以優先找它）；NewTripPage 是 TitleBar。 */
const header = (page) => (page.url().includes('/trips/new') ? page.getByTestId('titlebar') : page.getByTestId('stack-panel-header')).first();

async function expectHeaderAction(page, testId, labelText) {
  const btn = header(page).getByTestId(testId);
  await expect(btn).toBeVisible();
  // 手機也要看得到文字（不是 icon-only）
  const label = btn.locator('.tp-titlebar-action-label');
  await expect(label).toBeVisible();
  await expect(label).toHaveText(labelText);
  const box = await btn.boundingBox();
  expect(box && box.height).toBeGreaterThanOrEqual(44);
  expect(box && box.width).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.tp-page-bottom-bar')).toHaveCount(0);
  return btn;
}

async function fillNewTrip(page) {
  await page.goto('/trips/new');
  await expect(page.getByTestId('new-trip-page')).toBeVisible();
  await page.getByTestId('new-trip-destination-input').fill('沖繩');
  await page.getByTestId('new-trip-dest-result-ChIJPZ5hUjH65DQR_p_dD3CmCOo').click();
  await pickDate(page, 'new-trip-start-input', '2026-08-01');
  await pickDate(page, 'new-trip-end-input', '2026-08-05');
}

test.describe('NewTripPage', () => {
  test('「建立」在標題列、有文字、sticky、摘要列、無取消鈕', async ({ page }) => {
    await page.goto('/trips/new');
    await expect(page.getByTestId('new-trip-page')).toBeVisible();
    const btn = await expectHeaderAction(page, 'new-trip-submit', '建立');
    await expect(btn).toBeDisabled();
    await expect(page.getByTestId('new-trip-cancel')).toHaveCount(0);
    await expect(page.locator('.tp-form-summary')).toContainText('請先選擇目的地');
  });

  test('標題列捲動後仍在視窗頂端（sticky），主要動作隨時可點', async ({ page }) => {
    await fillNewTrip(page);
    // 不用 mouse.wheel：mobile WebKit 不支援（會直接丟錯），改以程式捲動；並確認真的捲動過，避免 sticky 斷言在沒捲動時恆真。
    const scrolled = await page.evaluate(() => {
      let n = 0;
      document.querySelectorAll('*').forEach((el) => { if (el.scrollHeight > el.clientHeight + 50) { el.scrollTop = el.scrollHeight; if (el.scrollTop > 0) n++; } });
      return n + window.scrollY;
    });
    expect(scrolled, '頁面應有可捲動內容且已捲動').toBeGreaterThan(0);
    const btn = header(page).getByTestId('new-trip-submit');
    await expect(btn).toBeEnabled();
    const box = await btn.boundingBox();
    expect(box && box.y).toBeLessThan(120);
  });

  test('送出中：busy label + disabled + aria-busy，返回鈕停用', async ({ page }) => {
    await fillNewTrip(page);
    await page.route('**/api/trips', async (route) => {
      if (route.request().method() === 'POST') await new Promise((r) => setTimeout(r, 1500));
      await route.fallback();
    });
    const btn = header(page).getByTestId('new-trip-submit');
    await btn.click();
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveAttribute('aria-busy', 'true');
    await expect(btn.locator('.tp-titlebar-action-label')).toHaveText('建立中⋯');
    await expect(header(page).getByRole('button', { name: '返回前頁' })).toBeDisabled();
  });

  test('失敗：標題列正下方 role=alert 橫幅，建立恢復可點以便重試', async ({ page }) => {
    await fillNewTrip(page);
    await page.route('**/api/trips', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: '建立失敗：網路異常' } }) });
      } else await route.fallback();
    });
    const btn = header(page).getByTestId('new-trip-submit');
    await btn.click();
    const alert = page.getByRole('alert').filter({ hasText: /建立|失敗|異常/ });
    await expect(alert).toBeVisible();
    await expect(btn).toBeEnabled();
    // 橫幅貼在標題列下方：top 介於標題列底與標題列底 + 摘要列高度（≤ 80px）之間
    const hb = await header(page).boundingBox();
    const ab = await alert.boundingBox();
    expect(ab && hb && ab.y - (hb.y + hb.height)).toBeLessThan(80);
  });
});

test.describe('操作頁', () => {
  test('AddStopPage：完成在標題列、計數在摘要列、無取消鈕', async ({ page }) => {
    await page.goto(`/trip/${TRIP}/add-stop?day=1`);
    await expect(page.getByTestId('add-stop-page')).toBeVisible();
    await expectHeaderAction(page, 'add-stop-confirm', '完成');
    await expect(page.getByTestId('add-stop-cancel')).toHaveCount(0);
    await expect(page.locator('.tp-form-summary').getByTestId('add-stop-counter')).toContainText('已選');
  });

  test('ChangePoiPage：確認在標題列、無取消鈕', async ({ page }) => {
    await page.goto(`/trip/${TRIP}/stop/101/change-poi?mode=master`);
    await expect(page.getByTestId('change-poi-page')).toBeVisible();
    await expectHeaderAction(page, 'change-poi-submit', '置換景點');
    await expect(page.getByTestId('change-poi-cancel')).toHaveCount(0);
  });

  test('EntryActionPage：複製在標題列、無取消鈕', async ({ page }) => {
    await page.goto(`/trip/${TRIP}/stop/101/copy`);
    await expect(page.getByTestId('entry-action-day-2')).toBeVisible();
    await expectHeaderAction(page, 'entry-action-confirm', '複製');
    await expect(page.getByTestId('entry-action-cancel')).toHaveCount(0);
  });

  test('EditTripPage：完成在標題列、已自動儲存、發布狀態在內容區頂端卡片', async ({ page }) => {
    await page.goto(`/trip/${TRIP}/edit`);
    await expect(page.getByTestId('edit-trip-page')).toBeVisible();
    await expectHeaderAction(page, 'edit-trip-done', '完成');
    await expect(page.locator('.tp-form-summary')).toContainText('已自動儲存');
    const card = page.getByTestId('edit-trip-publish-card');
    await expect(card).toBeVisible();
    await expect(card.getByRole('radiogroup', { name: '發布狀態' })).toBeVisible();
    await expect(header(page).getByTestId('edit-trip-published-on')).toHaveCount(0);
    await header(page).getByTestId('edit-trip-done').click();
    await expect(page).not.toHaveURL(/\/edit$/);
  });
});
