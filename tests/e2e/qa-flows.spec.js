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
    // Race-safe: 註冊 waitForResponse 在 click 之前 (Promise.all),避免 mock
    // 同步 fulfill 在 await 之前完成導致永久 hang
    await Promise.all([
      page.waitForResponse((res) => /\/api\/saved-pois$/.test(res.url()) && res.request().method() === 'POST'),
      page.getByTestId('explore-save-btn-90001').click(),
    ]);

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

test.describe('QA Flow 5 — 編輯行程', () => {
  test('EditTripPage 改 title + desc → 完成 → PUT /api/trips/:id', async ({ page }) => {
    /** @type {string[]} */
    const puts = [];
    page.on('request', (req) => {
      if (req.method() === 'PUT' && /\/api\/trips\/[^/]+$/.test(req.url())) {
        puts.push(req.postData() ?? '');
      }
    });

    // 先進 trip → 從 TitleBar 觸發 edit (建立 history,handleBack 不跳 about:blank)
    await page.goto('/trip/okinawa-trip-2026-Ray/edit');
    await expect(page.getByTestId('edit-trip-page')).toBeVisible();

    // 改 title
    const titleInput = page.getByTestId('edit-trip-title-input');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('沖繩 QA test 改名');

    // 改 description
    await page.getByTestId('edit-trip-desc-input').fill('QA spec 編輯描述');

    // 用 TitleBar 「儲存」 (formRef.requestSubmit)。
    // bottom edit-trip-submit 的 form="edit-trip-form" 對不到 form (form 沒設 id),
    // 是 dead button — 不在這支 spec 修,記在 QA 報告 follow-up。
    const submit = page.getByTestId('edit-trip-titlebar-save');
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect.poll(() => puts.length, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(puts[0]);
    expect(body.title).toBe('沖繩 QA test 改名');
    expect(body.description).toContain('QA spec');
  });
});

test.describe('QA Flow 6 — 編輯景點 (note inline)', () => {
  test('TimelineRail 展開 entry → 編輯備註 → 儲存 → PATCH /api/trips/:id/entries/:eid', async ({ page }) => {
    /** @type {string[]} */
    const patches = [];
    page.on('request', (req) => {
      if (req.method() === 'PATCH' && /\/api\/trips\/[^/]+\/entries\/\d+$/.test(req.url())) {
        patches.push(req.url());
      }
    });

    await page.goto('/trip/okinawa-trip-2026-Ray');
    // 展開 entry 101 (首里城)
    const row = page.getByTestId('timeline-rail-row-101');
    await expect(row).toBeVisible();
    await row.click();
    await expect(page.getByTestId('timeline-rail-detail-101')).toBeVisible();

    // 點編輯備註 → 出 textarea → 改 → 儲存
    await page.getByTestId('timeline-rail-edit-note-101').click();
    const noteInput = page.getByTestId('timeline-rail-note-input-101');
    await expect(noteInput).toBeVisible();
    await noteInput.fill('QA spec 改的備註');
    await page.getByTestId('timeline-rail-note-save-101').click();

    await expect.poll(() => patches.length, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
    expect(patches[0]).toMatch(/\/api\/trips\/okinawa-trip-2026-Ray\/entries\/101$/);
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
