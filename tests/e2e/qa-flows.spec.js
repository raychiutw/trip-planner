// @ts-check
/**
 * QA flows E2E — 4 個核心使用者流程
 *
 * 1. 新增行程 (NewTripPage /trips/new)
 *    POST /api/trips → navigate /trips?selected=:id
 * 2. 新增景點 (AddStopPage /trip/:id/add-stop?day=N)
 *    custom tab → 填 title → 完成 → POST /api/trips/:id/days/:n/entries
 * 3. 搜尋景點加入收藏 (ExplorePage)
 *    搜尋 → 點 heart → POST /api/saved-pois → saved view 出現
 * 4. 移除收藏 (ExplorePage saved view)
 *    切到收藏 → 勾選 → 刪除 → ConfirmModal → DELETE /api/saved-pois/:id
 *
 * 依賴 tests/e2e/api-mocks.js 的 setupApiMocks (含 POST /api/trips mock)
 *
 * 為避免與 setupApiMocks 路由打架,本檔不另註冊 page.route。
 * 改用 page.on('request') / page.on('response') 觀察 API call。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
});

test.describe('QA Flow 1 — 新增行程', () => {
  test('搜尋目的地 + 填日期 + 提交 → POST /api/trips → 導向 /trips?selected=', async ({ page }) => {
    /** @type {string[]} */
    const apiPosts = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/api\/trips$/.test(req.url())) {
        apiPosts.push(req.postData() ?? '');
      }
    });

    await page.goto('/trips/new');
    await expect(page.getByTestId('new-trip-page')).toBeVisible();

    // 搜尋目的地 → mock 回沖繩美麗海水族館 (osm_id 90001)
    await page.getByTestId('new-trip-destination-input').fill('沖繩');
    await expect(page.getByTestId('new-trip-dest-dropdown')).toBeVisible();
    await page.getByTestId('new-trip-dest-result-90001').click();
    await expect(page.getByTestId('new-trip-destination-row-90001')).toBeVisible();

    // 預設 dateMode = select → 填 start/end
    await page.getByTestId('new-trip-start-input').fill('2026-08-01');
    await page.getByTestId('new-trip-end-input').fill('2026-08-05');

    // titleBar 完成按鈕
    const submitBtn = page.getByTestId('new-trip-titlebar-create');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 等待 navigate → /trips?selected=:id
    await page.waitForURL(/\/trips\?selected=/);
    expect(page.url()).toMatch(/selected=.+/);
    expect(apiPosts.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(apiPosts[0]);
    expect(body.name).toBeTruthy();
    expect(body.startDate).toBe('2026-08-01');
    expect(body.endDate).toBe('2026-08-05');
    expect(body.destinations).toHaveLength(1);
  });
});

test.describe('QA Flow 2 — 新增景點 (custom tab confirm)', () => {
  test('custom tab 填 title → 完成 → POST entries → 觸發 tp-entry-updated', async ({ page }) => {
    /** @type {string[]} */
    const entryPostUrls = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/api\/trips\/[^/]+\/days\/\d+\/entries$/.test(req.url())) {
        entryPostUrls.push(req.url());
      }
    });

    // 先 goto /trip/:id 建 history,再透過 + 加景點 navigate → handleBack 可回得到
    await page.goto('/trip/okinawa-trip-2026-Ray');
    await page.getByTestId('trip-add-stop-trigger').click();
    await expect(page.getByTestId('add-stop-page')).toBeVisible();

    await page.getByTestId('add-stop-tab-custom').click();
    await page.getByTestId('add-stop-custom-title').fill('海邊散步 — QA test');

    const titleBarConfirm = page.getByTestId('add-stop-titlebar-confirm');
    await expect(titleBarConfirm).toBeEnabled();
    await titleBarConfirm.click();

    // POST 應發生 + 成功後 handleBack() → 回 /trip/:id 或 /trips?selected=:id (fallback)
    await expect.poll(() => entryPostUrls.length, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
    expect(entryPostUrls[0]).toMatch(/\/api\/trips\/okinawa-trip-2026-Ray\/days\/1\/entries/);
    await page.waitForURL(/(?:\/trip\/okinawa-trip-2026-Ray|\/trips\?selected=okinawa-trip-2026-Ray)/, { timeout: 5000 });
  });
});

test.describe('QA Flow 3 — 搜尋景點加入收藏', () => {
  test('Explore 搜尋 → 點 heart → POST /api/saved-pois → 切到收藏 view 看到該 POI', async ({ page }) => {
    /** @type {string[]} */
    const savedPosts = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/api\/saved-pois$/.test(req.url())) {
        savedPosts.push(req.postData() ?? '');
      }
    });

    await page.goto('/explore');
    await expect(page.getByTestId('explore-page')).toBeVisible();

    // 搜尋
    await page.getByTestId('explore-search-input').fill('沖繩');
    await page.getByTestId('explore-search-submit').click();

    // mock results → osm_id 90001 卡片
    const heartBtn = page.getByTestId('explore-save-btn-90001');
    await expect(heartBtn).toBeVisible();
    await heartBtn.click();

    // POST /api/saved-pois 應發生
    await expect.poll(() => savedPosts.length, { timeout: 5000 }).toBeGreaterThanOrEqual(1);

    // 切到 saved view → count 1 個 + 看到 POI 名稱
    await page.getByTestId('explore-saved-titlebar').click();
    await expect(page.getByTestId('explore-saved')).toBeVisible();
    await expect(page.getByTestId('explore-saved-count')).toContainText('1 個');
    await expect(page.getByText('沖繩美麗海水族館').first()).toBeVisible();
  });
});

test.describe('QA Flow 4 — 移除收藏', () => {
  test('saved view 勾選 → 刪除 → ConfirmModal 確認 → DELETE /api/saved-pois/:id', async ({ page }) => {
    /** @type {string[]} */
    const deletes = [];
    page.on('request', (req) => {
      if (req.method() === 'DELETE' && /\/api\/saved-pois\/\d+$/.test(req.url())) {
        deletes.push(req.url());
      }
    });

    // Step 1: 先加一個收藏 (走 setupApiMocks 的 POST /saved-pois 路徑)
    await page.goto('/explore');
    await page.getByTestId('explore-search-input').fill('沖繩');
    await page.getByTestId('explore-search-submit').click();
    await page.getByTestId('explore-save-btn-90001').click();

    // 等收藏入庫 (POST 完成)
    await page.waitForResponse((res) => /\/api\/saved-pois$/.test(res.url()) && res.request().method() === 'POST');

    // Step 2: 切到 saved view
    await page.getByTestId('explore-saved-titlebar').click();
    await expect(page.getByTestId('explore-saved')).toBeVisible();
    await expect(page.getByTestId('explore-saved-count')).toContainText('1 個');

    // Step 3: 勾選第一張卡 (id 由 setupApiMocks 動態生成 ≥ 8001)
    const firstCheck = page.locator('[data-testid^="saved-check-"]').first();
    await firstCheck.check();

    // toolbar 出現「刪除」 button
    const deleteBtn = page.getByTestId('explore-delete-selected');
    await expect(deleteBtn).toBeEnabled();
    await deleteBtn.click();

    // ConfirmModal
    const confirmModal = page.getByTestId('confirm-modal');
    await expect(confirmModal).toBeVisible();
    await page.getByTestId('confirm-modal-confirm').click();

    // 等 DELETE 發出 + 卡片消失
    await expect.poll(() => deletes.length, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
    await expect(page.getByText('還沒有儲存任何 POI').first()).toBeVisible();
  });
});
