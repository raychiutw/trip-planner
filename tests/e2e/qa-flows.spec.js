// @ts-check
/**
 * QA flows E2E — 4 個核心使用者流程
 *
 * 1. 新增行程 (NewTripPage /trips/new)
 *    POST /api/trips → navigate /trips?selected=:id
 * 2. 新增景點 (AddStopPage /trip/:id/add-stop?day=N)
 *    custom tab → 填 title → 完成 → POST /api/trips/:id/days/:n/entries
 * 3. 搜尋景點加入收藏 (ExplorePage)
 *    搜尋 → 點 heart → POST /api/poi-favorites → saved view 出現
 * 4. 移除收藏 (ExplorePage saved view)
 *    切到收藏 → 勾選 → 刪除 → ConfirmModal → DELETE /api/poi-favorites/:id
 *
 * 依賴 tests/e2e/api-mocks.js 的 setupApiMocks (含 POST /api/trips mock)
 *
 * 為避免與 setupApiMocks 路由打架,本檔不另註冊 page.route。
 * 改用 page.on('request') / page.on('response') 觀察 API call。
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');
import { pickDate } from './_helpers/pickDate.js';

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

    // 搜尋目的地 → mock 回沖繩美麗海水族館 (place_id ChIJPZ5hUjH65DQR_p_dD3CmCOo)
    await page.getByTestId('new-trip-destination-input').fill('沖繩');
    await expect(page.getByTestId('new-trip-dest-dropdown')).toBeVisible();
    await page.getByTestId('new-trip-dest-result-ChIJPZ5hUjH65DQR_p_dD3CmCOo').click();
    await expect(page.getByTestId('new-trip-destination-row-ChIJPZ5hUjH65DQR_p_dD3CmCOo')).toBeVisible();

    // 預設 dateMode = select → 用 TripDatePicker helper 選 start/end
    // (v2.33.17 之後 native <input type="date"> 已換成 TripDatePicker)
    await pickDate(page, 'new-trip-start-input', '2026-08-01');
    await pickDate(page, 'new-trip-end-input', '2026-08-05');

    // v2.33.120: titlebar action 拔掉，改用 bottom bar submit button
    const submitBtn = page.getByTestId('new-trip-submit');
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

test.describe('QA Flow 2 — 新增景點 (custom tab wedge guard)', () => {
  // v2.31.94：自訂 tab 新 contract — 必須 title + map pin coord 雙備齊才能 submit
  // (per design doc wedge: 保證有 coord 才能 submit)。POST entries 流程移到 search
  // tab E2E 覆蓋 (search 路徑無 map 依賴) — 此 test 改驗 guard 行為。
  test('custom tab title-only 維持 disabled — 無 map pin coord 不能 submit', async ({ page }, testInfo) => {
    // v2.31.94 設計：mobile 切自訂 tab 會 redirect 到 /add-custom-stop，testid 不同。
    // 本 test 鎖 desktop inline tab 路徑（map IME wedge）。mobile fullpage 由
    // add-custom-stop tests 覆蓋。
    testInfo.skip(testInfo.project.name.startsWith('mobile-'), 'desktop-only inline tab; mobile uses /add-custom-stop fullpage');
    /** @type {string[]} */
    const entryPostUrls = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/api\/trips\/[^/]+\/days\/\d+\/entries$/.test(req.url())) {
        entryPostUrls.push(req.url());
      }
    });

    await page.goto('/trip/okinawa-trip-2026-Ray');
    await page.goto('/trip/okinawa-trip-2026-Ray/add-stop?day=1');
    await expect(page.getByTestId('add-stop-page')).toBeVisible();

    await page.getByTestId('add-stop-tab-custom').click();
    await page.getByTestId('add-stop-custom-title').fill('海邊散步 — QA test');

    // CI 無 Google Maps browser key → map fail-load → customCoord 永遠 null →
    // 完成 disabled，不會 fire POST entries。確認 guard 阻擋。
    const titleBarConfirm = page.getByTestId('add-stop-titlebar-confirm');
    await expect(titleBarConfirm).toBeDisabled();

    // 確認沒 POST 漏出去
    await page.waitForTimeout(500);
    expect(entryPostUrls.length).toBe(0);
  });
});

test.describe('QA Flow 3 — 搜尋景點加入收藏', () => {
  test('Explore 搜尋 → 點 heart → POST /api/poi-favorites → 切到 /favorites 看到該 POI (v2.21.0)', async ({ page }) => {
    /** @type {string[]} */
    const savedPosts = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/api\/poi-favorites$/.test(req.url())) {
        savedPosts.push(req.postData() ?? '');
      }
    });

    await page.goto('/explore');
    await expect(page.getByTestId('explore-page')).toBeVisible();

    // 搜尋
    await page.getByTestId('explore-search-input').fill('沖繩');
    await page.getByTestId('explore-search-submit').click();

    // mock results → place_id ChIJPZ5hUjH65DQR_p_dD3CmCOo 卡片
    const heartBtn = page.getByTestId('explore-save-btn-ChIJPZ5hUjH65DQR_p_dD3CmCOo');
    await expect(heartBtn).toBeVisible();
    await heartBtn.click();

    // POST /api/poi-favorites 應發生
    await expect.poll(() => savedPosts.length, { timeout: 5000 }).toBeGreaterThanOrEqual(1);

    // v2.33.140: ExplorePage 收藏 TitleBar action 拔除（back ← 已回 /favorites 重複入口），
    // 直接 navigate 走 URL — E2E 測 favorites 顯示，不 test 導航 UI。
    await page.goto('/favorites');
    await expect(page.getByTestId('favorites-page')).toBeVisible();
    await expect(page.getByTestId('favorites-count')).toContainText('1 個');
    await expect(page.getByText('沖繩美麗海水族館').first()).toBeVisible();
  });
});

test.describe('QA Flow 4 — 移除收藏 (v2.22.0 PoiFavoritesPage)', () => {
  test('/favorites 勾選 → 刪除 → ConfirmModal 確認 → DELETE /api/poi-favorites/:id', async ({ page }) => {
    /** @type {string[]} */
    const deletes = [];
    page.on('request', (req) => {
      if (req.method() === 'DELETE' && /\/api\/poi-favorites\/\d+$/.test(req.url())) {
        deletes.push(req.url());
      }
    });

    // Step 1: 先 explore 加一個收藏
    await page.goto('/explore');
    await page.getByTestId('explore-search-input').fill('沖繩');
    await page.getByTestId('explore-search-submit').click();
    await Promise.all([
      page.waitForResponse((res) => /\/api\/poi-favorites$/.test(res.url()) && res.request().method() === 'POST'),
      page.getByTestId('explore-save-btn-ChIJPZ5hUjH65DQR_p_dD3CmCOo').click(),
    ]);

    // Step 2: v2.33.140 ExplorePage 收藏 action 拔除，直接 navigate /favorites
    await page.goto('/favorites');
    await expect(page.getByTestId('favorites-page')).toBeVisible();
    await expect(page.getByTestId('favorites-count')).toContainText('1 個');

    // Step 3: 勾選第一張卡
    const firstCheck = page.locator('[data-testid^="favorites-check-"]').first();
    await firstCheck.check();

    // toolbar 出現「刪除」 button
    const deleteBtn = page.getByTestId('favorites-delete-selected');
    await expect(deleteBtn).toBeEnabled();
    await deleteBtn.click();

    // ConfirmModal
    const confirmModal = page.getByTestId('confirm-modal');
    await expect(confirmModal).toBeVisible();
    await page.getByTestId('confirm-modal-confirm').click();

    // 等 DELETE 發出 + empty CTA 出現
    await expect.poll(() => deletes.length, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
    await expect(page.getByTestId('favorites-empty')).toBeVisible();
  });
});

test.describe('QA Flow 5 — 編輯行程 (v2.33.108 auto-save)', () => {
  test('EditTripPage 改 title + desc → debounce 800ms → PUT /api/trips/:id (auto-save)', async ({ page }) => {
    /** @type {string[]} */
    const puts = [];
    page.on('request', (req) => {
      if (req.method() === 'PUT' && /\/api\/trips\/[^/]+$/.test(req.url())) {
        puts.push(req.postData() ?? '');
      }
    });

    await page.goto('/trip/okinawa-trip-2026-Ray/edit');
    await expect(page.getByTestId('edit-trip-page')).toBeVisible();

    // v2.33.108: 移除「儲存」button，改 onChange + 800ms debounce → PUT
    const titleInput = page.getByTestId('edit-trip-title-input');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('沖繩 QA test 改名');

    await page.getByTestId('edit-trip-desc-input').fill('QA spec 編輯描述');

    // 等 debounce 800ms + auto-save fire → PUT
    await expect.poll(() => puts.length, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
    // Take latest PUT (multiple may fire as user types — auto-save coalesces）
    const body = JSON.parse(puts[puts.length - 1]);
    expect(body.title).toBe('沖繩 QA test 改名');
    expect(body.description).toContain('QA spec');
  });

  test('返回 button → navigate back (v2.33.108: 無 ConfirmModal — auto-save 已 commit)', async ({ page }) => {
    await page.goto('/trip/okinawa-trip-2026-Ray/edit');
    await expect(page.getByTestId('edit-trip-page')).toBeVisible();

    // 「返回」button (rename from「取消」)
    const back = page.getByTestId('edit-trip-back');
    await expect(back).toBeVisible();
    await back.click();
    // navigate occurs，URL 離開 /edit
    await expect(page).not.toHaveURL(/\/edit$/);
  });
});

test.describe('QA Flow 6 — 編輯景點 (note inline, v2.33.108 auto-save)', () => {
  test('TimelineRail 展開 entry → 編輯備註 → onBlur → PATCH /api/trips/:id/entries/:eid/pois/:poiId (v2.43.0 per-POI 備註)', async ({ page }) => {
    /** @type {string[]} */
    const patches = [];
    page.on('request', (req) => {
      // v2.43.0 備註 cutover：note 編輯改打 per-POI 端點 /entries/:eid/pois/:masterPoiId
      // （不再是 entry-level /entries/:eid）。master poiId 取自 entry.stopPois sortOrder=1。
      if (req.method() === 'PATCH' && /\/api\/trips\/[^/]+\/entries\/\d+\/pois\/\d+$/.test(req.url())) {
        patches.push(req.url());
      }
    });

    await page.goto('/trip/okinawa-trip-2026-Ray');
    const row = page.getByTestId('timeline-rail-row-101');
    await expect(row).toBeVisible();
    await row.click();
    await expect(page.getByTestId('timeline-rail-detail-101')).toBeVisible();

    // v2.33.108: 移除「儲存」button，改 onBlur 觸發 auto-save PATCH
    await page.getByTestId('timeline-rail-note-value-101').click();
    const noteInput = page.getByTestId('timeline-rail-note-input-101');
    await expect(noteInput).toBeVisible();
    await noteInput.fill('QA spec 改的備註');
    await noteInput.blur(); // onBlur → flush autosave

    await expect.poll(() => patches.length, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
    expect(patches[0]).toMatch(/\/api\/trips\/okinawa-trip-2026-Ray\/entries\/101\/pois\/\d+$/);
  });
});

test.describe('QA Flow 7 — 移動景點 (cross-day)', () => {
  test('展開 entry → 移動 → 選 day 2 → 確認 → PATCH { day_id }', async ({ page }) => {
    /** @type {Array<{url: string, body: string | null}>} */
    const patches = [];
    page.on('request', (req) => {
      if (req.method() === 'PATCH' && /\/api\/trips\/[^/]+\/entries\/\d+$/.test(req.url())) {
        patches.push({ url: req.url(), body: req.postData() });
      }
    });

    await page.goto('/trip/okinawa-trip-2026-Ray');
    await page.getByTestId('timeline-rail-row-101').click();
    await page.getByTestId('timeline-rail-move-open-101').click();

    // navigate 到 /trip/.../stop/101/move
    await expect(page).toHaveURL(/\/trip\/okinawa-trip-2026-Ray\/stop\/101\/move/);
    await expect(page.getByTestId('entry-action-page')).toBeVisible();

    // 等 day list 載入完
    await expect(page.getByTestId('entry-action-day-2')).toBeVisible();
    await page.getByTestId('entry-action-day-2').click();
    await page.getByTestId('entry-action-confirm').click();

    await expect.poll(() => patches.length, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(patches[0].body || '{}');
    // v2.45.0 fix: move PATCH body uses snake_case `day_id` to match the backend
    // ALLOWED_FIELDS (functions/api/trips/[id]/entries/[eid].ts:28 + `'day_id' in body`).
    // The prior `dayId` (camelCase) was never read by the backend → move was a no-op;
    // this mock-API test asserted the broken shape and passed as a false green.
    expect(body.day_id).toBe(2);
  });
});

test.describe('QA Flow 8 — 刪除景點', () => {
  test('展開 entry → 點刪除 → ConfirmModal 確認 → DELETE /api/trips/:id/entries/:eid', async ({ page }) => {
    /** @type {string[]} */
    const deletes = [];
    page.on('request', (req) => {
      if (req.method() === 'DELETE' && /\/api\/trips\/[^/]+\/entries\/\d+$/.test(req.url())) {
        deletes.push(req.url());
      }
    });

    await page.goto('/trip/okinawa-trip-2026-Ray');
    await page.getByTestId('timeline-rail-row-101').click();
    await page.getByTestId('timeline-rail-delete-101').click();

    // TimelineRail 用自己的 inline modal (不是 ConfirmModal 組件)
    const modal = page.getByTestId('timeline-rail-delete-modal-101');
    await expect(modal).toBeVisible();
    await page.getByTestId('timeline-rail-delete-confirm-101').click();

    await expect.poll(() => deletes.length, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
    expect(deletes[0]).toMatch(/\/api\/trips\/okinawa-trip-2026-Ray\/entries\/101$/);
  });
});

test.describe('QA Flow 9 — 刪除行程', () => {
  test('TripsListPage card menu → 刪除 → ConfirmModal 確認 → DELETE /api/trips/:id', async ({ page }) => {
    /** @type {string[]} */
    const deletes = [];
    page.on('request', (req) => {
      if (req.method() === 'DELETE' && /\/api\/trips\/[^/]+$/.test(req.url()) && !/\/entries\//.test(req.url())) {
        deletes.push(req.url());
      }
    });

    await page.goto('/trips');
    await expect(page.getByTestId('trips-list-page')).toBeVisible();
    await expect(page.getByTestId('trips-list-card-okinawa-trip-2026-Ray')).toBeVisible();

    // open card menu (TripCardMenu portal)
    await page.getByTestId('trip-card-menu-trigger-okinawa-trip-2026-Ray').click();
    await expect(page.getByTestId('trip-card-menu-okinawa-trip-2026-Ray')).toBeVisible();
    await page.getByTestId('trip-card-menu-delete-okinawa-trip-2026-Ray').click();

    // ConfirmModal
    await expect(page.getByTestId('confirm-modal')).toBeVisible();
    await page.getByTestId('confirm-modal-confirm').click();

    await expect.poll(() => deletes.length, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
    expect(deletes[0]).toMatch(/\/api\/trips\/okinawa-trip-2026-Ray$/);
  });
});

test.describe('QA Flow 10 — 帳號頁', () => {
  test('AccountPage render hero + 6 個 row testid + 點 row 跳對應 path', async ({ page }) => {
    await page.goto('/account');
    await expect(page.getByTestId('account-page')).toBeVisible();
    await expect(page.getByTestId('account-hero')).toBeVisible();

    // 6 rows: appearance / notifications / connected-apps / developer / sessions / logout
    const expectedRows = [
      'appearance',
      'notifications',
      'connected-apps',
      'developer',
      'sessions',
      'logout',
    ];
    for (const key of expectedRows) {
      await expect(page.getByTestId(`account-row-${key}`)).toBeVisible();
    }

    // 「開發者選項」 to=/developer/apps (regression: AccountPage.tsx 原 to=/settings/developer-apps 404,
    // 1c15055 修。此 spec lock canonical route。)
    const devRow = page.getByTestId('account-row-developer');
    await expect(devRow).toHaveAttribute('href', '/developer/apps');
  });

  test('登出 row → 開 ConfirmModal', async ({ page }) => {
    await page.goto('/account');
    await page.getByTestId('account-row-logout').click();
    await expect(page.getByTestId('confirm-modal')).toBeVisible();
    // 不真按 confirm,避免清掉 mock session
    await page.getByTestId('confirm-modal-cancel').click();
    await expect(page.getByTestId('confirm-modal')).not.toBeVisible();
  });
});
