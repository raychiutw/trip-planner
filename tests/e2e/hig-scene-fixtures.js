// @ts-check
/**
 * HIG 場景的共用資料：場景清單與 API mock。hig-scenes.spec.js（截圖與觸控目標）與
 * hig-a11y-collect.spec.js（axe、重排、鍵盤焦點的收集）共用，避免兩邊的場景清單各自過期。
 */
const { expect } = require('@playwright/test');
const { MOCK_TRIPS_LIST, MOCK_TRIP_META_OKINAWA, MOCK_DAY1_OKINAWA } = require('./api-mocks');

const TRIP = MOCK_TRIPS_LIST[0].tripId;

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
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
// #1567：公開分享頁讀 GET /api/share/:token，回 { meta, days, notes }（loadSharePrintData）；資料取自既有行程 mock。
const SHARE_NOTES = { flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [] };
const stubShareRead = (page) =>
  page.route(/\/api\/share\/demo-share$/, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta: { ...MOCK_TRIP_META_OKINAWA, sharedBy: 'Ray' }, days: [MOCK_DAY1_OKINAWA], notes: SHARE_NOTES }) }));
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
// #1600：ChatPage 送出前會查「這個行程的擁有者」是否已授權（旅伴才會被攔）；場景以擁有者身分、已授權呈現。
const stubTripAiAuthorization = (page) =>
  page.route(/\/api\/trips\/[^/]+\/ai-authorization$/, (r) => r.fulfill(json({ ownerAuthorized: true, isOwner: true })));
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

// ── 認證與帳號類（#1565）：這幾頁要新 api 認證旗標，走另一份建置（埠 3001，見 playwright.config.js）──
const NEWAPI_ORIGIN = 'http://localhost:3001';
/** 場景的完整網址：newApi 場景改走旗標開啟的那份建置。 */
const sceneUrl = (scene) => (scene.newApi ? NEWAPI_ORIGIN : '') + scene.path;

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
 * 把登入憑證種進 IndexedDB（結構照 src/lib/auth/storage.ts：db tripline-auth、store kv）。
 * 先開一頁空白文件（只為了取得同源的 IndexedDB，不載入 app，避免 app 搶先讀寫），種完再由場景自己 goto。
 * pending 有值時另存一筆 Google 登入暫存（/auth/callback 場景用）。
 */
const seedNewApiAuth = async (page, pending) => {
  await page.route(`${NEWAPI_ORIGIN}/__seed`, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>seed</title>' }));
  await page.goto(`${NEWAPI_ORIGIN}/__seed`);
  await page.evaluate(async (pending) => {
    const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('tripline-auth', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      const store = tx.objectStore('kv');
      if (pending) store.put({ ...pending, keyPair, createdAt: Date.now() }, 'pendingLogin');
      else { store.put('rt-demo', 'refreshToken'); store.put(keyPair, 'keyPair'); }
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, pending ?? null);
};
// refresh 換 token：只要形狀對（DPoP 綁定），proof 由頁面真的簽出來，mock 不驗。
const stubNewApiToken = (page) =>
  page.route(/\/api\/oauth\/token$/, (r) =>
    r.fulfill(json({ access_token: 'at-demo', refresh_token: 'rt-demo-next', token_type: 'DPoP' })));
const stubNewApiSession = async (page) => {
  await stubNewApiToken(page);
  await seedNewApiAuth(page);
};
// 真實契約：GET /api/account 的 hasPassword 決定變更密碼頁能不能進（進不去會被導回帳號頁）。
const stubChangePassword = (reply) => async (page) => {
  await stubNewApiSession(page);
  await page.route(/\/api\/account$/, (r) =>
    r.fulfill(json({ hasPassword: true, reauthProvider: null, reauthenticated: false, tripsOwned: 2, collaboratorsAffected: 1 })));
  if (reply) await page.route(/\/api\/account\/password$/, (r) => (r.request().method() === 'POST' ? r.fulfill(reply) : r.fallback()));
};
const CHANGE_PASSWORD = { path: '/account/password', newApi: true };
const AUTHORIZE = { path: '/oauth/authorize?request_id=hig-demo-request', newApi: true };
const CURRENT_PW = 'old-password-1';
const fillPasswords = async (page, current, next) => {
  await page.getByTestId('change-password-current').fill(current);
  await page.getByTestId('change-password-new').fill(next);
};
const submitPasswordChange = async (page) => {
  await fillPasswords(page, CURRENT_PW, 'new-password-123');
  await Promise.all([page.waitForResponse(/\/api\/account\/password$/), page.getByTestId('change-password-submit').click()]);
};
// 本地規則（過短、與目前相同）要離開新密碼欄位才顯示；把焦點移回目前密碼欄就是離開。
const leaveNewPassword = (page) => page.getByTestId('change-password-current').focus();
const pwError = (code, message, status, headers = {}) => ({ ...json(errBody(code, message), status), headers });
const AUTHORIZE_REQUEST = { client: { app_name: 'Tripline iOS' }, scopes: ['openid', 'profile', 'email', 'offline_access', 'trips:read', 'trips:write'] };
// signedIn=false：沒有任何本機憑證 → 還原不到登入 → 顯示登入表單；請求本身仍要讀得到（頁面先讀請求再看登入狀態是在還原之後）。
const stubAuthorizeRequest = (signedIn) => async (page) => {
  await (signedIn ? stubNewApiSession(page) : stubNewApiToken(page));
  await page.route(/\/api\/oauth\/authorize\/requests\/hig-demo-request$/, (r) => r.fulfill(json(AUTHORIZE_REQUEST)));
};
const stubAuthorizeLoginFails = async (page) => {
  await stubAuthorizeRequest(false)(page);
  await page.route(/\/api\/oauth\/login$/, (r) => r.fulfill(json(errBody('LOGIN_INVALID'), 401)));
};
const submitAuthorizeLogin = async (page) => {
  await page.getByTestId('authz-email').fill('ray@example.com');
  await page.getByTestId('authz-password').fill('wrong-password');
  await Promise.all([page.waitForResponse(/\/api\/oauth\/login$/), page.getByTestId('authz-login-submit').click()]);
};
const stubClientInfo = (page) =>
  page.route(/\/api\/oauth\/client-info\?/, (r) =>
    r.fulfill(json({ app_name: 'Travel Planner Mobile', app_description: null, app_logo_url: null, homepage_url: null })));
const CONSENT_QUERY = 'client_id=tp_app&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb&state=demo&response_type=code&code_challenge=abc&code_challenge_method=S256';
// 回跳頁的暫存要先存在（state 對得上），頁面才會真的去換 token；token 端點刻意不回應，停在「登入中…」。
const stubGoogleCallbackPending = async (page) => {
  await page.route(/\/api\/oauth\/token$/, () => {});
  await seedNewApiAuth(page, { state: 'st-demo', verifier: 'v'.repeat(43), redirectAfterLogin: null });
};

/**
 * @typedef {{ name: string, path: string, loggedIn?: boolean, proof?: string, proofText?: string | RegExp, stub?: (page: any) => Promise<void>, act?: (page: any) => Promise<void>, scope?: string, noTargets?: boolean, viewports?: ('mobile' | 'desktop')[], newApi?: boolean, noIdle?: boolean, intended?: string, proofAbsent?: { selector: string, why: string }, proofPath?: string }} Scene
 * proof：頁面渲染完成時一定存在的 data-testid；proofText 是畫面上一定要出現的文字（錯誤態、空狀態用，
 * 證明拍到的是想取證的那一種狀態，不是任意一種）；沒有時退而求其次檢查沒有錯誤頁。
 * stub：進頁前追加的 API 覆寫（後註冊的 route 優先）；act：進頁後的互動（例如送出表單）。
 * scope（彈出層場景）：彈出層根元素的 CSS selector。必須可見；proof／proofText 只在它裡面找
 *   （「只有彈出層內才會出現」才算數，背景頁面有同樣的字不行）；觸控目標也只量它裡面，
 *   且必須至少量到一個元素（量不到代表量測沒涵蓋彈出層）。
 * noTargets：彈出層本來就沒有可點擊元素（橫幅、Toast），不要求量到元素。
 * viewports：只在這些寬度取證（桌機寬才有的表面，例如 TripSheet 右欄；預設兩種寬度都跑）。
 * newApi：走新 api 認證旗標開啟的那份建置（埠 3001）；憑證由 stub 種進 IndexedDB。
 * noIdle：不等 networkidle（畫面刻意停在一個永遠不回應的請求上，例如 /auth/callback 的「登入中…」）。
 * proofPath：頁面最後所在的 pathname（不含 query）。兩個場景共用同一個 proof testid 時（複製／移動、direct／收藏加入行程是同一元件的不同模式，DOM 幾乎相同），
 *   用它證明各自真的停在自己的路由，沒有被轉址到另一個。
 * proofAbsent：證明「看不到」也是取證結果（已知缺口）：selector 在 proof 之後必須量到 0 個；用一次性的 count，不用會自動重試的 toHaveCount（Toast 會自己消失，重試會誤綠）。
 * intended：這個場景刻意讓某端點回 4xx／5xx（`狀態碼 路徑`），不算「沒有 mock」。
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
  { name: 'chat', path: '/chat', stub: stubTripAiAuthorization },
  { name: 'map', path: '/map' },
  { name: 'account', path: '/account' },
  { name: 'account-appearance', path: '/account/appearance' },
  { name: 'account-notifications', path: '/account/notifications' },
  { name: 'account-sessions', path: '/account/sessions' },
  { name: 'account-connected-apps', path: '/account/connected-apps' },
  { name: 'developer-apps', path: '/developer/apps' },
  { name: 'developer-apps-new', path: '/developer/apps/new' },
  // ── 認證與帳號類補強（#1565）：變更密碼的各狀態、OAuth 授權與同意、Google 回跳 ──
  { name: 'change-password', ...CHANGE_PASSWORD, stub: stubChangePassword(), proof: 'change-password-page' },
  { name: 'change-password-current-invalid', ...CHANGE_PASSWORD, stub: stubChangePassword(pwError('CHANGE_PASSWORD_CURRENT_INVALID', '目前密碼不正確', 403)), act: submitPasswordChange, proofText: '目前密碼不正確', intended: '403 /api/account/password' },
  { name: 'change-password-too-short', ...CHANGE_PASSWORD, stub: stubChangePassword(), act: async (page) => { await fillPasswords(page, CURRENT_PW, 'abc12'); await leaveNewPassword(page); }, proofText: /^新密碼至少 8 字元$/ },
  { name: 'change-password-same', ...CHANGE_PASSWORD, stub: stubChangePassword(), act: async (page) => { await fillPasswords(page, CURRENT_PW, CURRENT_PW); await leaveNewPassword(page); }, proofText: '新密碼不能和目前密碼相同' },
  { name: 'change-password-rate-limited', ...CHANGE_PASSWORD, stub: stubChangePassword(pwError('CHANGE_PASSWORD_RATE_LIMITED', '嘗試次數過多，請稍後再試', 429, { 'Retry-After': '900' })), act: submitPasswordChange, proofText: '嘗試次數過多，請在 15 分鐘後再試', intended: '429 /api/account/password' },
  // 成功後導回帳號頁；頁面程式碼有呼叫 showToast，但 ChangePasswordPage 與 AccountPage 都沒有掛 ToastContainer，
  // 所以使用者看不到任何成功回饋（review 發現 26）。這裡把「看不到」釘成斷言（用一次性的 count，不用會自動重試的 toHaveCount——Toast 3 秒後自己消失，重試會讓斷言誤綠）；修好後請改成取證 Toast 本身。
  { name: 'change-password-success', ...CHANGE_PASSWORD, stub: stubChangePassword(json({ ok: true })), act: async (page) => { await submitPasswordChange(page); await page.getByTestId('account-page').waitFor(); await page.waitForTimeout(500); }, proof: 'account-page', proofText: '密碼已更新，其他裝置已登出' },
  { name: 'oauth-authorize', ...AUTHORIZE, stub: stubAuthorizeRequest(true), proof: 'authz-continue' },
  { name: 'oauth-authorize-scopes', ...AUTHORIZE, stub: stubAuthorizeRequest(true), act: (page) => page.locator('.tp-authz-disc summary').click(), proof: 'authz-scopes' },
  { name: 'oauth-authorize-login', ...AUTHORIZE, stub: stubAuthorizeRequest(false), proof: 'authz-login-form' },
  { name: 'oauth-authorize-login-error', ...AUTHORIZE, stub: stubAuthorizeLoginFails, act: submitAuthorizeLogin, proof: 'authz-login-error', intended: '401 /api/oauth/login' },
  { name: 'oauth-authorize-error', path: '/oauth/authorize?request_id=%21%21', newApi: true, proof: 'authz-error' },
  { name: 'oauth-consent', path: `/oauth/consent?${CONSENT_QUERY}&scope=openid%20profile%20email%20trips%3Aread`, stub: stubClientInfo, proof: 'consent-allow' },
  { name: 'oauth-consent-unknown-scope', path: `/oauth/consent?${CONSENT_QUERY}&scope=openid%20admin%3Aall`, stub: stubClientInfo, proof: 'consent-scope-admin:all' },
  { name: 'oauth-consent-error', path: '/oauth/consent?scope=openid', proof: 'consent-error' },
  { name: 'auth-callback', path: '/auth/callback?code=demo-code&state=st-demo', newApi: true, stub: stubGoogleCallbackPending, noIdle: true, proof: 'auth-callback-page', proofText: '登入中…' },
  { name: 'trip-detail', path: `/trip/${TRIP}` },
  { name: 'trip-map', path: `/trip/${TRIP}/map` },
  { name: 'trip-notes', path: `/trip/${TRIP}/notes` },
  { name: 'trip-print', path: `/trip/${TRIP}/print` },
  { name: 'trip-collab', path: `/trip/${TRIP}/collab` },
  { name: 'trip-health', path: `/trip/${TRIP}/health`, stub: stubTripAiAuthorization },
  { name: 'trip-edit', path: `/trip/${TRIP}/edit` },
  { name: 'trip-add-stop', path: `/trip/${TRIP}/add-stop` },
  { name: 'trip-add-entry', path: `/trip/${TRIP}/add-entry` },
  // ── 認證流程的各狀態、邀請與清單的空／錯誤態（取證補強）──
  { name: 'login-error', path: '/login', loggedIn: false, stub: stubLogin(401, 'LOGIN_INVALID'), act: submitLogin, proofText: '電子郵件或密碼錯誤', intended: '401 /api/oauth/login' },
  { name: 'login-rate-limited', path: '/login', loggedIn: false, stub: stubLogin(429, 'LOGIN_RATE_LIMITED', { 'Retry-After': '900' }), act: submitLogin, proof: 'login-page-locked', intended: '429 /api/oauth/login' },
  { name: 'signup-check-email', path: '/signup/check-email?email=ray%40example.com', loggedIn: false, proofText: /ray@example\.com/ },
  { name: 'reset-password', path: '/auth/password/reset?token=demo-token', loggedIn: false, proofText: '設定新密碼' },
  { name: 'verify-email', path: '/auth/verify-email?token=demo-token', loggedIn: false, proofText: '點此完成驗證' },
  { name: 'invite', path: '/invite?token=demo-invite', loggedIn: false, stub: stubInvite, proofText: '沖繩家族之旅' },
  { name: 'invite-invalid', path: '/invite?token=bad-token', loggedIn: false, stub: stubInviteInvalid, proof: 'invite-error', proofText: '請聯絡邀請者重寄', intended: '410 /api/invitations' },
  { name: 'trips-list-empty', path: '/trips', stub: stubTripsEmpty, proof: 'trips-list-empty' },
  { name: 'trips-list-error', path: '/trips', stub: stubTripsError, proofText: '無法載入你的行程清單', intended: '500 /api/my-trips' },
  // ── #1567：行程詳情與編輯流程的新增場景（entry 讀取沿用 api-mocks 的 /entries/:id）──
  { name: 'trip-share', path: '/s/demo-share', loggedIn: false, stub: stubShareRead, proof: 'share-title' },
  { name: 'trip-stop-copy', path: `/trip/${TRIP}/stop/101/copy`, proof: 'entry-action-confirm', proofText: '複製到哪一天', proofPath: `/trip/${TRIP}/stop/101/copy` },
  { name: 'trip-stop-move', path: `/trip/${TRIP}/stop/101/move`, proof: 'entry-action-confirm', proofText: '移到哪一天', proofPath: `/trip/${TRIP}/stop/101/move` },
  { name: 'trip-stop-change-poi', path: `/trip/${TRIP}/stop/101/change-poi`, proof: 'change-poi-search-input' },
  { name: 'trip-stop-edit', path: `/trip/${TRIP}/stop/101/edit`, proof: 'edit-entry-poi-summary' },
  // add-custom-stop 是手機專用路由（MobileOnlyRoute），桌機寬會轉址到 add-stop，所以只取手機寬。
  { name: 'trip-add-custom-stop', path: `/trip/${TRIP}/add-custom-stop?day=1`, viewports: ['mobile'], proof: 'add-custom-stop-page' },
  // ── 彈出層（Sheet／Modal／Dialog／Banner／Toast）──
  { name: 'popup-account-sheet', path: '/trips', act: openAccountSheet, scope: '[role="dialog"][aria-label="帳號"]', proof: 'account-page' },
  { name: 'popup-ai-consent-sheet', path: '/chat', stub: stubAiConsentFlow, act: sendChat, scope: '[data-testid="ai-consent-sheet"]', proof: 'ai-consent-quoted' },
  { name: 'popup-ai-data-consent-sheet', path: '/chat', stub: stubAiDataConsentFlow, act: sendChat, scope: '[data-testid="ai-data-consent-sheet"]', proof: 'ai-data-consent-accept' },
  { name: 'popup-share-link-modal', path: `/trip/${TRIP}/print`, stub: stubShares, act: (page) => page.getByTestId('trip-print-share').click(), scope: '[data-testid="share-modal"]', proof: 'share-link-row' },
  { name: 'popup-confirm-modal', path: '/account/sessions', act: (page) => page.getByTestId('sessions-revoke-all').click(), scope: '[data-testid="confirm-modal"]', proof: 'confirm-modal-confirm' },
  { name: 'popup-conflict-modal', path: '/favorites/8001/add-to-trip', stub: stubFavoriteConflict, act: submitFavoriteToTrip, scope: '[data-testid="conflict-modal"]', proof: 'conflict-modal-summary', intended: '409 /api/poi-favorites' },
  { name: 'popup-input-modal', path: '/explore', act: openRegionInput, scope: '[data-testid="input-modal"]', proof: 'input-modal-field' },
  { name: 'popup-note-ai-exclusions-dialog', path: `/trip/${TRIP}/notes`, stub: stubExclusions, act: openEmergencyExclusions, scope: '[role="dialog"][aria-labelledby="tp-note-ai-exclusions-title"]', proofText: '日本警察（110）' },
  { name: 'popup-travel-pill-dialog', path: `/trip/${TRIP}`, act: (page) => page.getByTestId('travel-pill').first().click(), scope: '[data-testid="travel-pill-dialog"]', proof: 'travel-dialog-close' },
  { name: 'popup-trip-sheet', path: `/trips?selected=${TRIP}&sheet=chat`, viewports: ['desktop'], scope: '[data-testid="trip-sheet"]', proof: 'trip-sheet-tab-chat' },
  { name: 'popup-error-banner', path: '/account/sessions', stub: stubSessionRevokeFails, act: (page) => page.getByTestId('sessions-revoke-iphone').click(), scope: '[data-testid="sessions-error"]', proofText: '登出此裝置失敗', noTargets: true, intended: '500 /api/account/sessions' },
  { name: 'popup-server-status-banner', path: '/favorites', act: goOffline, scope: '[data-testid="server-status-banner"]', proofText: '連線中斷', noTargets: true },
  { name: 'popup-toast-error', path: '/explore', stub: stubSearchFails, act: searchFails, scope: '.tp-toast', proofText: '搜尋失敗', noTargets: true, intended: '500 /api/poi-search' },
  { name: 'popup-toast-online', path: `/trips?selected=${TRIP}`, act: goOfflineThenOnline, scope: '.tp-toast', proofText: '已恢復連線', noTargets: true },
  // ── #1566：加入行程表單（direct／favorite 兩種模式的獨立畫面）與錨定選單、下拉面板 ──
  { name: 'add-to-trip', path: DIRECT_ADD_PATH, act: pickTripOnly, proof: 'favorites-add-to-trip-submit', proofText: '首里城', proofPath: '/add-to-trip' },
  { name: 'favorite-add-to-trip', path: '/favorites/8001/add-to-trip', stub: stubFavoriteList, act: pickTripOnly, proof: 'favorites-add-to-trip-submit', proofText: '首里城', proofPath: '/favorites/8001/add-to-trip' },
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
  if (scene.proofPath) expect(new URL(page.url()).pathname, `${scene.name} 不在預期的路由`).toBe(scene.proofPath);
  if (scene.proofAbsent) expect(await page.locator(scene.proofAbsent.selector).count(), scene.proofAbsent.why).toBe(0);
}

/**
 * 開啟場景到可以操作的狀態（兩支 spec 共用）：進頁、等閒置、跑 act；彈出層再等進場動畫。
 * 呼叫前由各 spec 自己處理 viewport／色彩模式／api mock 與 scene.stub 之前的事件監聽。
 * @param {import('@playwright/test').Page} page
 * @param {Scene} scene
 */
async function openScene(page, scene) {
  if (scene.stub) await scene.stub(page);
  await page.goto(sceneUrl(scene));
  if (!scene.noIdle) await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  if (scene.act) await scene.act(page);
  // 彈出層有 150～260ms 的進場動畫（淡入、上滑）；不等它跑完會拍到半透明的過場畫面（Toast 只停留 2～3 秒，所以只等一小段）。
  if (scene.scope) await page.waitForTimeout(600);
}

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

module.exports = { TRIP, SCENES, setupSceneExtras, openScene, proveScene, json };
