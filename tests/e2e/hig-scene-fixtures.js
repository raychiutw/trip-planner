// @ts-check
/**
 * HIG 場景的共用資料：場景清單與 API mock。hig-scenes.spec.js（截圖與觸控目標）與
 * hig-a11y-collect.spec.js（axe、重排、鍵盤焦點的收集）共用，避免兩邊的場景清單各自過期。
 */
const { expect } = require('@playwright/test');
const { MOCK_TRIPS_LIST } = require('./api-mocks');

const TRIP = MOCK_TRIPS_LIST[0].tripId;

const errBody = (code, message = '') => ({ error: { code, message } });
const stubLogin = (status, code, headers = {}) => (page) =>
  page.route(/\/api\/oauth\/login$/, (r) =>
    r.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(errBody(code)) }));
const submitLogin = async (page) => {
  await page.locator('input[type=email]').fill('ray@example.com');
  await page.locator('input[type=password]').fill('wrong-password');
  await Promise.all([
    page.waitForResponse(/\/api\/oauth\/login$/),
    page.locator('button[type=submit]').click(),
  ]);
};
const INVITE = { tripId: TRIP, tripTitle: '沖繩家族之旅', invitedEmail: 'ray@example.com', role: 'member', inviterDisplayName: 'Mia', inviterEmail: 'mia@example.com', expiresAt: '2026-12-31T00:00:00Z' };
const stubInvite = (page) =>
  page.route(/\/api\/invitations(\?.*)?$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(INVITE) }));
// 真實契約：GET /api/invitations?token= 對無效／過期／已接受都回 410（functions/api/_errors.ts），
// 訊息來自 src/types/api.ts。用不存在的錯誤碼會讓頁面走到「未知錯誤→重試」分支，拍到不真實的畫面。
const stubInviteInvalid = (page) =>
  page.route(/\/api\/invitations(\?.*)?$/, (r) =>
    r.fulfill({ status: 410, contentType: 'application/json', body: JSON.stringify(errBody('INVITATION_INVALID', '邀請連結無效，請聯絡邀請者重寄')) }));
const stubTripsEmpty = (page) =>
  page.route(/\/api\/my-trips$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
const stubTripsError = (page) =>
  page.route(/\/api\/my-trips$/, (r) => r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify(errBody('INTERNAL')) }));

// ── 彈出層場景（#1565～#1568）：每個都從使用者實際走得到的操作打開彈出層 ──
const openAccountSheet = (page) =>
  page.locator('[data-testid=titlebar-account], [data-testid=sidebar-account-card]').filter({ visible: true }).first().click();
// 聊天送出：授權狀態與資料同意狀態由各場景的 stub 決定，攔下送出的是 ChatPage 自己的判斷。
const sendChat = async (page) => {
  await page.getByTestId('chat-input').fill('幫我規劃 Day 1 的早午餐');
  await page.getByTestId('chat-send').click();
};
const stubAiAuthorization = (authorized) => (page) =>
  page.route(/\/api\/account\/ai-authorization$/, (r) => r.fulfill(json({ authorized })));
// 形狀照 useAiDataConsent 的 isConsent 型別守衛；文案是 server 回的，這裡放同形狀的示意文字。
const AI_DATA_CONSENT = {
  status: 'none', currentVersion: '2026-11-01', acceptedVersion: null, acceptedAt: null, enforced: true,
  text: {
    version: '2026-11-01', title: 'AI 助理如何使用你的資料', intro: '使用 AI 聊天、行程健檢與 AI 筆記前，請先了解你的行程資料會如何被處理。',
    sections: [
      { heading: '會送出哪些資料', items: ['行程標題、日期與停留點', '你在聊天輸入的訊息'] },
      { heading: '不會送出哪些資料', items: ['你的密碼與登入憑證', '其他行程的內容'] },
    ],
    withdrawal: ['撤回後 AI 功能立即停用', '已產生的內容不會被刪除'],
  },
};
const stubAiDataConsent = (page) =>
  page.route(/\/api\/account\/ai-data-consent$/, (r) => r.fulfill(json(AI_DATA_CONSENT)));
const stubAiConsentFlow = async (page) => {
  await stubAiAuthorization(false)(page);
};
const stubAiDataConsentFlow = async (page) => {
  await stubAiAuthorization(true)(page);
  await stubAiDataConsent(page);
};
const SHARE_ROW = { id: 1, label: '給爸媽', visibleSections: '["flights","lodgings"]', expiresAt: null, viewCount: 3, anonymous: 0, createdBy: 'ray@example.com', createdAt: '2026-10-20T08:00:00Z', revokedAt: null };
const stubShares = (page) =>
  page.route(new RegExp(`/api/trips/${TRIP}/shares$`), (r) =>
    r.request().method() === 'GET' ? r.fulfill(json({ shares: [SHARE_ROW] })) : r.fallback());
const FAVORITE = { id: 8001, poiId: 1, poiName: '首里城', poiAddress: '沖繩縣那霸市首里金城町 1-2', poiType: 'attraction', favoritedAt: '2026-10-01T00:00:00Z', note: null, poiLat: 26.217, poiLng: 127.719 };
// 真實契約（functions/api/poi-favorites/[id]/add-to-trip.ts）：時段重疊回 409，body 是 { error: 'CONFLICT', conflictWith }。
const stubFavoriteConflict = async (page) => {
  await page.route(/\/api\/poi-favorites$/, (r) => r.fulfill(json([FAVORITE])));
  await page.route(/\/api\/poi-favorites\/8001\/add-to-trip$/, (r) =>
    r.fulfill(json({ error: 'CONFLICT', conflictWith: { entryId: 101, time: '09:00-10:30', title: '國際通', dayNum: 1 } }, 409)));
};
const submitFavoriteToTrip = async (page) => {
  await page.getByTestId('favorites-add-to-trip-trip').locator('button').first().click();
  await page.getByRole('option').first().click();
  const submit = page.getByTestId('favorites-add-to-trip-submit');
  await expect(submit).toBeEnabled();
  await Promise.all([page.waitForResponse(/\/add-to-trip$/), submit.click()]);
};
const openRegionInput = async (page) => {
  await page.getByTestId('explore-region-pill').click();
  await page.getByTestId('explore-region-option-custom').click();
};
// deletedAt 是 D1 的 datetime('now') 格式（空格分隔、無時區），formatDeletedAt 只認這個格式。
const EXCLUSION = { id: 7, docType: 'emergency', semanticKey: 'police-110', label: '日本警察（110）', deletedAt: '2026-10-28 03:00:00' };
const stubExclusions = (page) =>
  page.route(new RegExp(`/api/trips/${TRIP}/notes/emergency/exclusions$`), (r) => r.fulfill(json({ items: [EXCLUSION] })));
const openEmergencyExclusions = async (page) => {
  // 桌機寬各區塊預設全展開、手機寬只展開第一區；已展開就不要再點（會收合）。
  const head = page.getByTestId('trip-notes-section-head-emergency');
  if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click();
  await page.getByTestId('trip-notes-exclusions-emergency').click();
};
const stubSessionRevokeFails = (page) =>
  page.route(/\/api\/account\/sessions\/iphone$/, (r) =>
    r.request().method() === 'DELETE' ? r.fulfill(json(errBody('INTERNAL'), 500)) : r.fallback());
// 離線狀態由 window 的 offline 事件驅動（useOnlineStatus 同時聽這個事件）；不真的斷網，避免後續請求全失敗。
// 狀態切到離線有 3 秒 debounce，之後橫幅與（TripPage 內的）離線 Toast 才出現。
const goOffline = (page) => page.evaluate(() => window.dispatchEvent(new Event('offline')));
// 離線時全域橫幅是唯一的離線提示（#1587 14，離線 Toast 不再出現）；Toast 只剩「已恢復連線」。
// 先等橫幅出現（離線 3 秒 debounce），再送 online 事件，橫幅收掉、Toast 出現。
const goOfflineThenOnline = async (page) => {
  await goOffline(page);
  await expect(page.getByTestId('server-status-banner')).toBeVisible({ timeout: 6000 });
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
};
// 少於 2 字現在是欄位自己的錯誤文字（#1587 16，不再發 Toast）；error Toast 改取證「搜尋失敗」。
// 只讓 q=ab 失敗，頁面載入時的自動搜尋不受影響，Toast 才會剛好出現在這一次操作之後。
const stubSearchFails = (page) =>
  page.route(/\/api\/poi-search\?q=ab/, (r) => r.fulfill(json(errBody('INTERNAL'), 500)));
const searchFails = async (page) => {
  await page.getByTestId('explore-search-input').fill('ab');
  await page.getByTestId('explore-search-submit').click();
};

// ── #1566：加入行程表單與錨定選單／下拉面板 ──
const stubFavoriteList = (page) => page.route(/\/api\/poi-favorites$/, (r) => r.fulfill(json([FAVORITE])));
const DIRECT_ADD_PATH = '/add-to-trip?place_id=ChIJ_demo_shuri&name=%E9%A6%96%E9%87%8C%E5%9F%8E&lat=26.217&lng=127.719&address=%E6%B2%96%E7%B9%A9%E7%B8%A3%E9%82%A3%E9%9C%B8%E5%B8%82%E9%A6%96%E9%87%8C%E9%87%91%E5%9F%8E%E7%94%BA%201-2&category=attraction';
// 兩個行程不會自動帶入，使用者要自己選；選完才會載入天數。
const pickTripOnly = async (page) => {
  await page.getByTestId('favorites-add-to-trip-trip').locator('button').first().click();
  await page.getByRole('option').first().click();
  await expect(page.getByTestId('favorites-add-to-trip-day')).toBeVisible();
  await page.waitForTimeout(400); // 等下拉收合動畫跑完，不然拍到轉到一半的箭頭
};
const openTripCardMenu = (page) => page.getByTestId(`trip-card-menu-trigger-${TRIP}`).click();
const openTripActionsMenu = (page) => page.getByTestId('trips-embedded-menu-trigger').click();
const openRailRowMenu = (page) => page.locator('[data-testid^="timeline-rail-menu-"]').first().click();
const openSortSelect = (page) => page.getByTestId('trips-list-sort').locator('button').first().click();
// 日期面板的格子標籤帶著星期與月份，固定「今天」才能讓違規清單穩定（否則每天都變）。
const freezeToday = (page) => page.clock.setFixedTime(new Date('2026-11-06T12:00:00Z'));
const openDatePicker = (page) => page.locator('.tp-date-trigger').first().click();
const openTimePicker = async (page) => {
  await pickTripOnly(page);
  await page.getByTestId('favorites-add-to-trip-start').locator('button').first().click();
};

/**
 * @typedef {{ name: string, path: string, loggedIn?: boolean, proof?: string, proofText?: string | RegExp, stub?: (page: any) => Promise<void>, act?: (page: any) => Promise<void>, scope?: string, noTargets?: boolean, viewports?: ('mobile' | 'desktop')[] }} Scene
 * proof：頁面渲染完成時一定存在的 data-testid；proofText 是畫面上一定要出現的文字（錯誤態、空狀態用，
 * 證明拍到的是想取證的那一種狀態，不是任意一種）；沒有時退而求其次檢查沒有錯誤頁。
 * stub：進頁前追加的 API 覆寫（後註冊的 route 優先）；act：進頁後的互動（例如送出表單）。
 * scope（彈出層場景）：彈出層根元素的 CSS selector。必須可見；proof／proofText 只在它裡面找
 *   （「只有彈出層內才會出現」才算數，背景頁面有同樣的字不行）；觸控目標也只量它裡面，
 *   且必須至少量到一個元素（量不到代表量測沒涵蓋彈出層）。
 * noTargets：彈出層本來就沒有可點擊元素（橫幅、Toast），不要求量到元素。
 * viewports：只在這些寬度取證（桌機寬才有的表面，例如 TripSheet 右欄；預設兩種寬度都跑）。
 */
/** @type {Scene[]} */
const SCENES = [
  { name: 'landing', path: '/', loggedIn: false },
  { name: 'login', path: '/login', loggedIn: false },
  { name: 'signup', path: '/signup', loggedIn: false },
  { name: 'forgot-password', path: '/login/forgot', loggedIn: false },
  { name: 'privacy', path: '/privacy', loggedIn: false },
  { name: 'trips-list', path: '/trips', proof: 'trips-list-page' },
  { name: 'trips-new', path: '/trips/new' },
  { name: 'explore', path: '/explore' },
  { name: 'favorites', path: '/favorites' },
  { name: 'chat', path: '/chat' },
  { name: 'map', path: '/map' },
  { name: 'account', path: '/account' },
  { name: 'account-appearance', path: '/account/appearance' },
  { name: 'account-notifications', path: '/account/notifications' },
  { name: 'account-sessions', path: '/account/sessions' },
  { name: 'account-connected-apps', path: '/account/connected-apps' },
  { name: 'developer-apps', path: '/developer/apps' },
  { name: 'developer-apps-new', path: '/developer/apps/new' },
  { name: 'trip-detail', path: `/trip/${TRIP}` },
  { name: 'trip-map', path: `/trip/${TRIP}/map` },
  { name: 'trip-notes', path: `/trip/${TRIP}/notes` },
  { name: 'trip-print', path: `/trip/${TRIP}/print` },
  { name: 'trip-collab', path: `/trip/${TRIP}/collab` },
  { name: 'trip-health', path: `/trip/${TRIP}/health` },
  { name: 'trip-edit', path: `/trip/${TRIP}/edit` },
  { name: 'trip-add-stop', path: `/trip/${TRIP}/add-stop` },
  { name: 'trip-add-entry', path: `/trip/${TRIP}/add-entry` },
  // ── 認證流程的各狀態、邀請與清單的空／錯誤態（取證補強）──
  { name: 'login-error', path: '/login', loggedIn: false, stub: stubLogin(401, 'LOGIN_INVALID'), act: submitLogin, proofText: '電子郵件或密碼錯誤' },
  { name: 'login-rate-limited', path: '/login', loggedIn: false, stub: stubLogin(429, 'LOGIN_RATE_LIMITED', { 'Retry-After': '900' }), act: submitLogin, proof: 'login-page-locked' },
  { name: 'signup-check-email', path: '/signup/check-email?email=ray%40example.com', loggedIn: false, proofText: /ray@example\.com/ },
  { name: 'reset-password', path: '/auth/password/reset?token=demo-token', loggedIn: false, proofText: '設定新密碼' },
  { name: 'verify-email', path: '/auth/verify-email?token=demo-token', loggedIn: false, proofText: '點此完成驗證' },
  { name: 'invite', path: '/invite?token=demo-invite', loggedIn: false, stub: stubInvite, proofText: '沖繩家族之旅' },
  { name: 'invite-invalid', path: '/invite?token=bad-token', loggedIn: false, stub: stubInviteInvalid, proof: 'invite-error', proofText: '請聯絡邀請者重寄' },
  { name: 'trips-list-empty', path: '/trips', stub: stubTripsEmpty, proof: 'trips-list-empty' },
  { name: 'trips-list-error', path: '/trips', stub: stubTripsError, proofText: '無法載入你的行程清單' },
  // ── 彈出層（Sheet／Modal／Dialog／Banner／Toast）──
  { name: 'popup-account-sheet', path: '/trips', act: openAccountSheet, scope: '[role="dialog"][aria-label="帳號"]', proof: 'account-page' },
  { name: 'popup-ai-consent-sheet', path: '/chat', stub: stubAiConsentFlow, act: sendChat, scope: '[data-testid="ai-consent-sheet"]', proof: 'ai-consent-quoted' },
  { name: 'popup-ai-data-consent-sheet', path: '/chat', stub: stubAiDataConsentFlow, act: sendChat, scope: '[data-testid="ai-data-consent-sheet"]', proof: 'ai-data-consent-accept' },
  { name: 'popup-share-link-modal', path: `/trip/${TRIP}/print`, stub: stubShares, act: (page) => page.getByTestId('trip-print-share').click(), scope: '[data-testid="share-modal"]', proof: 'share-link-row' },
  { name: 'popup-confirm-modal', path: '/account/sessions', act: (page) => page.getByTestId('sessions-revoke-all').click(), scope: '[data-testid="confirm-modal"]', proof: 'confirm-modal-confirm' },
  { name: 'popup-conflict-modal', path: '/favorites/8001/add-to-trip', stub: stubFavoriteConflict, act: submitFavoriteToTrip, scope: '[data-testid="conflict-modal"]', proof: 'conflict-modal-summary' },
  { name: 'popup-input-modal', path: '/explore', act: openRegionInput, scope: '[data-testid="input-modal"]', proof: 'input-modal-field' },
  { name: 'popup-note-ai-exclusions-dialog', path: `/trip/${TRIP}/notes`, stub: stubExclusions, act: openEmergencyExclusions, scope: '[role="dialog"][aria-labelledby="tp-note-ai-exclusions-title"]', proofText: '日本警察（110）' },
  { name: 'popup-travel-pill-dialog', path: `/trip/${TRIP}`, act: (page) => page.getByTestId('travel-pill').first().click(), scope: '[data-testid="travel-pill-dialog"]', proof: 'travel-dialog-close' },
  { name: 'popup-trip-sheet', path: `/trips?selected=${TRIP}&sheet=chat`, viewports: ['desktop'], scope: '[data-testid="trip-sheet"]', proof: 'trip-sheet-tab-chat' },
  { name: 'popup-error-banner', path: '/account/sessions', stub: stubSessionRevokeFails, act: (page) => page.getByTestId('sessions-revoke-iphone').click(), scope: '[data-testid="sessions-error"]', proofText: '登出此裝置失敗', noTargets: true },
  { name: 'popup-server-status-banner', path: '/favorites', act: goOffline, scope: '[data-testid="server-status-banner"]', proofText: '連線中斷', noTargets: true },
  { name: 'popup-toast-error', path: '/explore', stub: stubSearchFails, act: searchFails, scope: '.tp-toast', proofText: '搜尋失敗', noTargets: true },
  { name: 'popup-toast-online', path: `/trips?selected=${TRIP}`, act: goOfflineThenOnline, scope: '.tp-toast', proofText: '已恢復連線', noTargets: true },
  // ── #1566：加入行程表單（direct／favorite 兩種模式的獨立畫面）與錨定選單、下拉面板 ──
  { name: 'add-to-trip', path: DIRECT_ADD_PATH, act: pickTripOnly, proof: 'favorites-add-to-trip-submit', proofText: '首里城' },
  { name: 'favorite-add-to-trip', path: '/favorites/8001/add-to-trip', stub: stubFavoriteList, act: pickTripOnly, proof: 'favorites-add-to-trip-submit', proofText: '首里城' },
  // 收藏頁有資料的樣子（既有 favorites 場景只拍到空狀態）。
  { name: 'favorites-list', path: '/favorites', stub: stubFavoriteList, proof: 'favorites-add-to-trip-8001', proofText: '首里城' },
  { name: 'popup-trip-card-menu', path: '/trips', act: openTripCardMenu, scope: `[data-testid="trip-card-menu-${TRIP}"]`, proof: `trip-card-menu-edit-${TRIP}` },
  { name: 'popup-trip-actions-menu', path: `/trip/${TRIP}`, act: openTripActionsMenu, scope: `[data-testid="trip-embedded-menu-${TRIP}"]`, proof: `trip-embedded-menu-edit-${TRIP}` },
  { name: 'popup-rail-row-menu', path: `/trip/${TRIP}`, act: openRailRowMenu, scope: '[role="menu"].tp-rail-menu:popover-open', proofText: '重新排序' },
  { name: 'popup-trip-select', path: '/trips', act: openSortSelect, scope: '.tp-select-list', proofText: '名稱 A→Z' },
  { name: 'popup-trip-date-picker', path: '/trips/new', stub: freezeToday, act: openDatePicker, scope: '.tp-date-picker [role="dialog"]', proofText: /\d{4}/ },
  { name: 'popup-trip-time-picker', path: DIRECT_ADD_PATH, act: openTimePicker, scope: '.tp-time-popover', proofText: '23' },
];

/**
 * 證明畫面是想取證的那一種狀態（兩支 spec 共用）。有 scope 時，彈出層必須可見，
 * proof／proofText 只在彈出層內找。
 * @param {import('@playwright/test').Page} page
 * @param {Scene} scene
 */
async function proveScene(page, scene) {
  const root = scene.scope ? page.locator(scene.scope).first() : page;
  if (scene.scope) await expect(root, `${scene.name} 彈出層沒有開啟`).toBeVisible();
  if (scene.proof) await expect(root.getByTestId(scene.proof)).toBeVisible();
  if (scene.proofText) await expect(root.getByText(scene.proofText).first(), `${scene.name} 沒有出現預期的文字`).toBeVisible();
}

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** 預設 api-mocks 沒涵蓋、但場景頁面會打的端點。沒有它們頁面會落到錯誤態，取證的就不是想看的那一頁。
 * 形狀照 design-review-guard.spec.js 與各 spec 的既有 fixture。 */
async function setupSceneExtras(page) {
  const idle = (docType) => ({ docType, status: 'idle', jobId: null, requestId: null, generation: 0, exclusionCount: 0 });
  await page.route(new RegExp(`/api/trips/${TRIP}/notes/ai-state$`), (r) =>
    r.fulfill(json({ jobs: [idle('tips'), idle('lodging-tips'), idle('emergency')] })));
  await page.route(new RegExp(`/api/trips/${TRIP}/notes$`), (r) =>
    r.fulfill(json({
      flights: [{ id: 1, sortOrder: 0, airline: '中華航空', flightNo: 'CI 120', cabinClass: '', departAirport: 'TPE', arriveAirport: 'OKA', departAt: '2026-07-26T09:35', arriveAt: '2026-07-26T12:00', note: '', version: 0 }],
      lodgings: [], reservations: [], pretripNotes: [],
      emergencyContacts: [{ id: 1, sortOrder: 0, name: '日本警察', relationship: '報案', phone: '110', email: '', kind: 'police', aiGenerated: 0, origin: 'human', managedBy: 'human', semanticKey: null, version: 0 }],
    })));
  await page.route(new RegExp(`/api/trips/${TRIP}/segments$`), (r) =>
    r.fulfill(json([{ id: 1, tripId: TRIP, fromEntryId: 101, toEntryId: 102, mode: 'driving', submode: null, min: 13, distanceM: 6600, source: 'google', computedAt: 1, updatedAt: 1, noTravel: null }])));
  await page.route(new RegExp(`/api/trips/${TRIP}/health-check$`), (r) => r.fulfill(json({ report: null })));
  await page.route('**/api/requests**', (r) => r.fulfill(json({ items: [], hasMore: false })));
  await page.route('**/api/dev/apps', (r) => {
    if (r.request().method() !== 'GET') return r.fallback();
    return r.fulfill(json({ apps: [{ client_id: 'tp_app', app_name: 'Travel App', client_type: 'public', redirect_uris: [], allowed_scopes: ['openid'], status: 'active', created_at: '2026-09-26T00:00:00Z' }] }));
  });
  // 擋外部地圖服務，避免畫面隨外部狀態飄；路線 API 回空。
  await page.route(/maps\.googleapis\.com/, (r) => r.abort());
  await page.route('**/api/route**', (r) => r.fulfill(json({ polyline: [], duration: null, distance: 0, approx: true })));
}

module.exports = { TRIP, SCENES, setupSceneExtras, proveScene, json };
