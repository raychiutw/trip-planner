// @ts-check
/**
 * HIG 場景的共用資料：場景清單與 API mock。hig-scenes.spec.js（截圖與觸控目標）與
 * hig-a11y-collect.spec.js（axe、重排、鍵盤焦點的收集）共用，避免兩邊的場景清單各自過期。
 */
const { MOCK_TRIPS_LIST } = require('./api-mocks');

const TRIP = MOCK_TRIPS_LIST[0].tripId;

/**
 * @typedef {{ name: string, path: string, loggedIn?: boolean, proof?: string }} Scene
 * proof：頁面渲染完成時一定存在的 data-testid；沒有時退而求其次檢查沒有錯誤頁。
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
];

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

module.exports = { TRIP, SCENES, setupSceneExtras, json };
