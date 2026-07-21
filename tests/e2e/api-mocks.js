// @ts-check
/**
 * Shared API mock data and route setup for Playwright E2E tests.
 *
 * The mock data mirrors the REAL D1 API response format:
 * - trips.ts      → GET /api/trips       → array of trip rows
 * - trips/[id].ts → GET /api/trips/:id   → single trip row (footer parsed to object)
 * - days.ts       → GET /api/trips/:id/days → array of { id, dayNum, date, dayOfWeek, label }
 * - days/[num].ts → GET /api/trips/:id/days/:num → full day with hotel, timeline, stopPois, shopping
 * - docs/[type].ts → GET /api/trips/:id/docs/:type → { docType, content (JSON string), updatedAt }
 */

/* ===== /api/trips (trip list) ===== */
const MOCK_TRIPS_LIST = [
  // 2026-05-02 (migration 0045): selfDrive/autoScroll/footer cols DROP'd → 改用 lang/dataSource
  // v2.31.36 (migration 0068): defaultTravelMode + 5 self_drive_* DROP'd — dead columns。
  {
    tripId: 'okinawa-trip-2026-Ray',
    name: '沖繩自駕五日遊',
    owner: 'Ray',
    title: '2026 沖繩自駕五日遊',
    countries: '["JP"]',
    published: 1,
    lang: 'zh-TW',
    dataSource: 'manual',
  },
  {
    tripId: 'busan-trip-2026-CeliaDemyKathy',
    name: '釜山三日遊',
    owner: 'CeliaDemyKathy',
    title: '2026 釜山三日遊',
    countries: '["KR"]',
    published: 1,
    lang: 'zh-TW',
    dataSource: 'manual',
  },
];

const MOCK_USER = {
  id: 'user-ray',
  email: 'lean.lean@gmail.com',
  emailVerified: true,
  displayName: 'Ray',
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
};

// v2.23.0 google-maps-migration: osm_id (number) → place_id (Google ChIJ string)
const MOCK_POI_SEARCH_RESULTS = [
  {
    place_id: 'ChIJPZ5hUjH65DQR_p_dD3CmCOo',
    name: '沖繩美麗海水族館',
    address: '沖繩縣國頭郡本部町石川424',
    lat: 26.6944,
    lng: 127.8781,
    category: 'sight',
    country: 'JP',
    country_name: '日本',
  },
];

function initialSavedPois() {
  return [];
}

/**
 * v2.31.43 mock helper — duplicate of src/lib/poiCategory.ts mapNominatimCategory()。
 * 重複實作是因 e2e api-mocks.js 是 plain .js，不能 import .ts module。
 * 邏輯必須跟 src 同步；white list ∈ pois.type CHECK constraint。
 */
function mockMapCategory(category) {
  if (!category) return 'attraction';
  const c = String(category).toLowerCase();
  if (c.includes('hotel') || c.includes('lodging') || c.includes('tourism')) return 'hotel';
  if (c.includes('restaurant') || c.includes('food') || c.includes('amenity')) return 'restaurant';
  if (c.includes('shop') || c.includes('mall') || c.includes('retail')) return 'shopping';
  if (c.includes('parking')) return 'parking';
  if (c.includes('transport') || c.includes('railway') || c.includes('airport')) return 'transport';
  if (c.includes('activity') || c.includes('leisure')) return 'activity';
  return 'attraction';
}

// initialTripIdeas() retired in V2 cutover (migration 0046) — 備案概念合一進「我的收藏」。
// v2.22.0 (migration 0050) saved_pois → poi_favorites。v2.29.1 (migration 0063) DROP TABLE saved_pois。
// fixtures 繼承到 initialSavedPois() 名稱保留（routes mock /api/poi-favorites）。

/* ===== /api/trips/okinawa-trip-2026-Ray (single trip meta) =====
 * 2026-05-02 (migration 0045): ogDescription / selfDrive / autoScroll / footer cols DROP'd → 改 lang / dataSource + destinations[] join。
 * v2.31.36 (migration 0068): defaultTravelMode + 5 self_drive_* DROP'd — dead columns。 */
const MOCK_TRIP_META_OKINAWA = {
  id: 'okinawa-trip-2026-Ray',
  tripId: 'okinawa-trip-2026-Ray',
  name: '沖繩自駕五日遊',
  owner: 'Ray',
  title: '2026 沖繩自駕五日遊',
  description: '五天四夜沖繩自駕行程',
  countries: '["JP"]',
  published: 1,
  lang: 'zh-TW',
  dataSource: 'manual',
  destinations: [],
};

/* ===== /api/trips/busan-trip-2026-CeliaDemyKathy (single trip meta) ===== */
const MOCK_TRIP_META_BUSAN = {
  id: 'busan-trip-2026-CeliaDemyKathy',
  tripId: 'busan-trip-2026-CeliaDemyKathy',
  name: '釜山三日遊',
  owner: 'CeliaDemyKathy',
  title: '2026 釜山三日遊',
  description: '三天兩夜釜山美食行程',
  countries: '["KR"]',
  published: 1,
  lang: 'zh-TW',
  dataSource: 'manual',
  destinations: [],
};

/* ===== /api/trips/:id/days (days summary) =====
 * 真 API (functions/api/trips/[id]/days.ts) 經 _utils.json() deepCamel 後回 camelCase。
 * v2.21.0 P2 fix: EntryActionPage / AddStopPage 已改讀 camelCase，mock 拿掉 dual-key
 * snake_case 殘留，避免「正式正確 / 測試也正確但兩邊 schema 不一致」錯覺。 */
const MOCK_DAYS_OKINAWA = [
  { id: 1, dayNum: 1, date: '2026-07-01', dayOfWeek: '三', label: '那霸市區' },
  { id: 2, dayNum: 2, date: '2026-07-02', dayOfWeek: '四', label: '美國村' },
  { id: 3, dayNum: 3, date: '2026-07-03', dayOfWeek: '五', label: '海洋博公園' },
  { id: 4, dayNum: 4, date: '2026-07-04', dayOfWeek: '六', label: '北谷・恩納' },
  { id: 5, dayNum: 5, date: '2026-07-05', dayOfWeek: '日', label: '回程' },
];

const MOCK_DAYS_BUSAN = [
  { id: 1, dayNum: 1, date: '2026-08-10', dayOfWeek: '一', label: '海雲臺' },
  { id: 2, dayNum: 2, date: '2026-08-11', dayOfWeek: '二', label: '南浦洞' },
  { id: 3, dayNum: 3, date: '2026-08-12', dayOfWeek: '三', label: '回程' },
];

/* ===== /api/trips/okinawa-trip-2026-Ray/days/1 (full day) ===== */
const MOCK_DAY1_OKINAWA = {
  id: 1,
  dayNum: 1,
  date: '2026-07-01',
  dayOfWeek: '三',
  label: '那霸市區',
  hotel: {
    id: 1,
    dayId: 1,
    name: 'Hilton 沖繩那霸首里城',
    checkout: '11:00',
    address: '沖繩縣那霸市首里山川町 1-132-1',
    maps: 'Hilton 沖繩那霸首里城',
    description: '禁菸雙人房, 含早餐, 免費 Wi-Fi',
    note: null,
    breakfast: '{"included":true,"note":"7:00-9:30 一樓餐廳"}',
    parking: '{"price":"1000 日圓/晚","maps":"Hilton 那霸停車場","note":"先到先停"}',
    shopping: [
      {
        id: 1,
        parentType: 'hotel',
        parentId: 1,
        name: '那霸國際通購物',
        category: '購物',
        maps: '國際通商店街',
        googleRating: 4.2,
        hours: '10:00-22:00',
        mustBuy: '紅芋塔, 金楚糕, 黑糖',
        note: '附近步行 10 分鐘',
      },
    ],
  },
  timeline: [
    {
      id: 101,
      dayId: 1,
      sortOrder: 0,
      time: '09:00-10:30',
      title: '首里城',
      description: '世界遺產，琉球王朝的象徵',
      maps: '首里城公園',
      googleRating: 4.5,
      note: '建議早上前往避開人潮',
      travelType: 'car',
      travelDesc: '從飯店開車 15 分鐘',
      travelMin: 15,
      location: null,
      travel: { type: 'car', desc: '從飯店開車 15 分鐘', min: 15 },
      master: {
        poiId: 101,
        sortOrder: 1,
        name: '首里城',
        type: 'attraction',
        maps: '首里城公園',
        rating: 4.5,
      },
      stopPois: [
        {
          poiId: 101,
          sortOrder: 1,
          name: '首里城',
          type: 'attraction',
          maps: '首里城公園',
          rating: 4.5,
        },
        {
          poiId: 201,
          sortOrder: 2,
          name: '首里そば',
          type: 'restaurant',
          category: '午餐',
          address: '沖繩縣那霸市首里赤田町 1-7',
          maps: '首里そば',
          rating: 4.3,
          hours: '11:30-14:00',
          price: '¥800-1200',
          description: '沖繩傳統麵食',
          reservation: '不需預約',
          reservationUrl: null,
          note: null,
        },
        {
          poiId: 202,
          sortOrder: 3,
          name: '花笠食堂',
          type: 'restaurant',
          category: '午餐',
          address: '沖繩縣那霸市牧志 3-2-48',
          maps: '花笠食堂',
          rating: 4.1,
          hours: '11:00-21:00',
          price: '¥600-1000',
          description: '家庭料理定食',
          reservation: null,
          reservationUrl: null,
          note: null,
        },
      ],
      shopping: [],
    },
    {
      id: 102,
      dayId: 1,
      sortOrder: 1,
      time: '11:00-12:30',
      title: '波上宮',
      description: '沖繩最古老的神社',
      maps: null,
      googleRating: 4.0,
      note: null,
      travelType: 'car',
      travelDesc: '開車 20 分鐘',
      travelMin: 20,
      location: '[{"name":"波上宮","googleQuery":"https://www.google.com/maps/search/波上宮","appleQuery":"https://maps.apple.com/?q=波上宮"}]',
      travel: { type: 'car', desc: '開車 20 分鐘', min: 20 },
      master: {
        poiId: 102,
        sortOrder: 1,
        name: '波上宮',
        type: 'attraction',
        maps: 'https://www.google.com/maps/search/波上宮',
        rating: 4.0,
      },
      stopPois: [{
        poiId: 102,
        sortOrder: 1,
        name: '波上宮',
        type: 'attraction',
        maps: 'https://www.google.com/maps/search/波上宮',
        rating: 4.0,
      }],
      shopping: [
        {
          id: 301,
          parentType: 'entry',
          parentId: 102,
          name: '波上宮御守',
          category: '紀念品',
          maps: '波上宮',
          googleRating: null,
          hours: '09:00-17:00',
          mustBuy: '御守, 繪馬',
          note: '境內販售',
        },
      ],
    },
    {
      id: 103,
      dayId: 1,
      sortOrder: 2,
      time: '14:00-16:00',
      title: '國際通散步',
      description: '沖繩最熱鬧的商店街',
      maps: '國際通',
      googleRating: null,
      note: '適合下午閒逛購物',
      travelType: 'walking',
      travelDesc: '步行 10 分鐘',
      travelMin: 10,
      location: null,
      travel: { type: 'walking', desc: '步行 10 分鐘', min: 10 },
      master: {
        poiId: 103,
        sortOrder: 1,
        name: '國際通',
        type: 'attraction',
        maps: '國際通',
      },
      stopPois: [{
        poiId: 103,
        sortOrder: 1,
        name: '國際通',
        type: 'attraction',
        maps: '國際通',
      }],
      shopping: [],
    },
    {
      id: 104,
      dayId: 1,
      sortOrder: 3,
      time: '17:00-18:30',
      title: '牧志公設市場',
      description: '當地人的廚房，品嚐新鮮海產',
      maps: '牧志公設市場',
      googleRating: 4.2,
      note: null,
      travelType: 'walking',
      travelDesc: '步行 5 分鐘',
      travelMin: 5,
      location: '{"name":"牧志公設市場","googleQuery":"https://www.google.com/maps/search/牧志公設市場","appleQuery":"https://maps.apple.com/?q=牧志公設市場"}',
      travel: { type: 'walking', desc: '步行 5 分鐘', min: 5 },
      master: {
        poiId: 104,
        sortOrder: 1,
        name: '牧志公設市場',
        type: 'attraction',
        maps: '牧志公設市場',
        rating: 4.2,
      },
      stopPois: [
        {
          poiId: 104,
          sortOrder: 1,
          name: '牧志公設市場',
          type: 'attraction',
          maps: '牧志公設市場',
          rating: 4.2,
        },
        {
          poiId: 203,
          sortOrder: 2,
          name: '市場二樓食堂',
          type: 'restaurant',
          category: '晚餐',
          address: '沖繩縣那霸市松尾 2-10-1',
          maps: '牧志公設市場二樓',
          rating: 4.4,
          hours: '11:00-20:00',
          price: '¥1500-3000',
          description: '一樓買海鮮二樓代煮',
          reservation: '不需預約',
          reservationUrl: null,
          note: null,
        },
      ],
      shopping: [],
    },
  ],
};

/**
 * Build a minimal day response for days 2-5 (enough for nav/skeleton to work).
 */
function buildMinimalDay(dayNum, date, dayOfWeek, label) {
  return {
    id: dayNum,
    dayNum: dayNum,
    date: date,
    dayOfWeek: dayOfWeek,
    label: label,
    hotel: {
      id: dayNum * 10,
      dayId: dayNum,
      name: 'Day ' + dayNum + ' Hotel',
      checkout: '11:00',
      address: '沖繩',
      maps: null,
      description: null,
      note: null,
      breakfast: '{"included":true}',
      parking: null,
      shopping: [],
    },
    timeline: [
      {
        id: dayNum * 100 + 1,
        dayId: dayNum,
        sortOrder: 0,
        time: '09:00-12:00',
        title: label + '景點',
        description: '第' + dayNum + '天行程',
        maps: label,
        googleRating: null,
        note: null,
        travelType: 'car',
        travelDesc: '開車 30 分鐘',
        travelMin: 30,
        location: null,
        master: {
          poiId: dayNum * 100 + 1,
          sortOrder: 1,
          type: 'attraction',
          name: label + '景點',
          maps: label,
          lat: 26.2 + dayNum * 0.01,
          lng: 127.7 + dayNum * 0.01,
          rating: 4.2,
        },
        stopPois: [{
          poiId: dayNum * 100 + 1,
          sortOrder: 1,
          type: 'attraction',
          name: label + '景點',
          maps: label,
          lat: 26.2 + dayNum * 0.01,
          lng: 127.7 + dayNum * 0.01,
          rating: 4.2,
        }],
        travel: { type: 'car', desc: '開車 30 分鐘', min: 30 },
        shopping: [],
      },
    ],
  };
}

const MOCK_DAY2_OKINAWA = buildMinimalDay(2, '2026-07-02', '四', '美國村');
const MOCK_DAY3_OKINAWA = buildMinimalDay(3, '2026-07-03', '五', '海洋博公園');
const MOCK_DAY4_OKINAWA = buildMinimalDay(4, '2026-07-04', '六', '北谷・恩納');
const MOCK_DAY5_OKINAWA = buildMinimalDay(5, '2026-07-05', '日', '回程');

/* ===== Busan Day 1 (with Naver links) ===== */
const MOCK_DAY1_BUSAN = {
  id: 1,
  dayNum: 1,
  date: '2026-08-10',
  dayOfWeek: '一',
  label: '海雲臺',
  hotel: {
    id: 50,
    dayId: 1,
    name: 'Park Hyatt Busan',
    checkout: '12:00',
    address: '釜山廣域市海雲臺區',
    maps: 'Park Hyatt Busan',
    description: '海景雙人房',
    note: null,
    breakfast: '{"included":true,"note":"自助餐 6:30-10:00"}',
    parking: null,
    shopping: [],
  },
  timeline: [
    {
      id: 501,
      dayId: 1,
      sortOrder: 0,
      time: '10:00-12:00',
      title: '海雲臺海水浴場',
      description: '釜山最著名的海灘',
      maps: null,
      googleRating: 4.5,
      note: null,
      travelType: 'train',
      travelDesc: '地鐵 20 分鐘',
      travelMin: 20,
      location: '{"name":"海雲臺海水浴場","googleQuery":"https://www.google.com/maps/search/해운대해수욕장","appleQuery":"https://maps.apple.com/?q=해운대해수욕장","naverQuery":"https://map.naver.com/v5/search/해운대해수욕장"}',
      travel: { type: 'train', desc: '地鐵 20 分鐘', min: 20 },
      master: {
        poiId: 501,
        sortOrder: 1,
        name: '海雲臺海水浴場',
        type: 'attraction',
        maps: 'https://www.google.com/maps/search/해운대해수욕장',
        rating: 4.5,
      },
      stopPois: [{
        poiId: 501,
        sortOrder: 1,
        name: '海雲臺海水浴場',
        type: 'attraction',
        maps: 'https://www.google.com/maps/search/해운대해수욕장',
        rating: 4.5,
      }],
      shopping: [],
    },
  ],
};

const MOCK_DAY2_BUSAN = buildMinimalDay(2, '2026-08-11', '二', '南浦洞');
const MOCK_DAY3_BUSAN = buildMinimalDay(3, '2026-08-12', '三', '回程');

/* ===== /api/trips/:id/docs/:type ===== */
const MOCK_DOC_FLIGHTS_OKINAWA = {
  docType: 'flights',
  content: JSON.stringify({
    title: '航班資訊',
    content: {
      segments: [
        { label: '去程', flightNo: 'CI 120', route: '桃園 TPE → 那霸 OKA', time: '08:30 - 11:00' },
        { label: '回程', flightNo: 'CI 121', route: '那霸 OKA → 桃園 TPE', time: '12:00 - 13:30' },
      ],
      airline: { name: '中華航空', note: '託運行李 30kg' },
    },
  }),
  updatedAt: '2026-01-15T10:00:00Z',
};

const MOCK_DOC_CHECKLIST_OKINAWA = {
  docType: 'checklist',
  content: JSON.stringify({
    title: '出發前確認',
    content: {
      cards: [
        { title: '證件', items: ['護照（效期6個月以上）', '台胞證', '國際駕照', '日文譯本'] },
        { title: '交通', items: ['租車預約確認', 'ETC 卡', 'Google Map 離線地圖'] },
        { title: '住宿', items: ['飯店預約確認信', '地址列印'] },
      ],
    },
  }),
  updatedAt: '2026-01-15T10:00:00Z',
};

const MOCK_DOC_BACKUP_OKINAWA = {
  docType: 'backup',
  content: JSON.stringify({
    title: '備案行程',
    content: {
      cards: [
        { title: '雨天備案', description: '若遇大雨', weatherItems: ['美麗海水族館（室內）', 'AEON MALL 購物'], items: ['DFS 免稅店', '首里城地下停車場'] },
        { title: '颱風備案', description: '若遇颱風', items: ['待在飯店休息', '確認航班狀態'] },
      ],
    },
  }),
  updatedAt: '2026-01-15T10:00:00Z',
};

const MOCK_DOC_EMERGENCY_OKINAWA = {
  docType: 'emergency',
  content: JSON.stringify({
    title: '緊急聯絡',
    content: {
      cards: [
        {
          title: '駐日代表處',
          contacts: [
            { label: '那霸辦事處', phone: '+81-98-862-7008', url: 'tel:+81-98-862-7008', note: '上班時間' },
            { label: '急難救助', phone: '+81-80-6557-8796', url: 'tel:+81-80-6557-8796', note: '24 小時' },
          ],
          address: '沖繩縣那霸市久茂地 3-15-9',
        },
        {
          title: '警察・消防',
          contacts: [
            { label: '警察', phone: '110', url: 'tel:110' },
            { label: '消防/救護車', phone: '119', url: 'tel:119' },
          ],
        },
      ],
    },
  }),
  updatedAt: '2026-01-15T10:00:00Z',
};

const MOCK_DOC_SUGGESTIONS_OKINAWA = {
  docType: 'suggestions',
  content: JSON.stringify({
    title: '行程建議',
    content: {
      cards: [
        { title: '美食推薦', priority: 'high', items: ['必吃沖繩豬肉蛋飯糰', '塔可飯推薦 King Tacos'] },
        { title: '購物建議', priority: 'medium', items: ['紅芋塔建議在國際通購買', '藥妝店推薦松本清'] },
      ],
    },
  }),
  updatedAt: '2026-01-15T10:00:00Z',
};

/* ===== Route lookup table ===== */

const OKINAWA_DAYS = {
  1: MOCK_DAY1_OKINAWA,
  2: MOCK_DAY2_OKINAWA,
  3: MOCK_DAY3_OKINAWA,
  4: MOCK_DAY4_OKINAWA,
  5: MOCK_DAY5_OKINAWA,
};

const BUSAN_DAYS = {
  1: MOCK_DAY1_BUSAN,
  2: MOCK_DAY2_BUSAN,
  3: MOCK_DAY3_BUSAN,
};

const OKINAWA_DOCS = {
  flights: MOCK_DOC_FLIGHTS_OKINAWA,
  checklist: MOCK_DOC_CHECKLIST_OKINAWA,
  backup: MOCK_DOC_BACKUP_OKINAWA,
  emergency: MOCK_DOC_EMERGENCY_OKINAWA,
  suggestions: MOCK_DOC_SUGGESTIONS_OKINAWA,
};

const TRIP_META = {
  'okinawa-trip-2026-Ray': MOCK_TRIP_META_OKINAWA,
  'busan-trip-2026-CeliaDemyKathy': MOCK_TRIP_META_BUSAN,
};

const TRIP_DAYS = {
  'okinawa-trip-2026-Ray': { list: MOCK_DAYS_OKINAWA, byNum: OKINAWA_DAYS },
  'busan-trip-2026-CeliaDemyKathy': { list: MOCK_DAYS_BUSAN, byNum: BUSAN_DAYS },
};

const TRIP_DOCS = {
  'okinawa-trip-2026-Ray': OKINAWA_DOCS,
  'busan-trip-2026-CeliaDemyKathy': null, // no docs
};

const MOCK_SESSIONS = [
  {
    sid: 'current',
    ua_summary: 'Chrome on macOS',
    ip_hash_prefix: 'a1b2',
    created_at: '2026-04-25T10:00:00Z',
    last_seen_at: '2026-04-27T08:00:00Z',
    is_current: true,
  },
  {
    sid: 'iphone',
    ua_summary: 'Mobile Safari on iPhone',
    ip_hash_prefix: 'c3d4',
    created_at: '2026-04-24T09:00:00Z',
    last_seen_at: '2026-04-26T21:00:00Z',
    is_current: false,
  },
];

const MOCK_CONNECTED_APPS = [
  {
    client_id: 'weather-importer',
    app_name: 'Weather Importer',
    app_logo_url: null,
    app_description: 'Imports local weather into Tripline',
    homepage_url: null,
    status: 'active',
    scopes: ['read:trips', 'write:trips'],
    granted_at: Date.now() - 86400000,
  },
];

/* ===== Setup function ===== */

/**
 * Intercept all API routes with mock data using a single route handler.
 * Uses URL parsing to dispatch to the correct mock data.
 * @param {import('@playwright/test').Page} page
 */
async function setupApiMocks(page) {
  const savedPois = initialSavedPois();
  // V2 cutover: tripIdeas removed — concept retired in migration 0046
  const sessions = MOCK_SESSIONS.map((s) => ({ ...s }));
  const connectedApps = MOCK_CONNECTED_APPS.map((a) => ({ ...a }));
  let nextSavedId = 8000;
  let nextPoiId = 8800;
  let nextEntryId = 9000;
  // v2.31.43：對齊 real backend — find-or-create body.type（client 已 mapNominatim
  // 映射過）跟 POST /poi-favorites 經 JOIN 拿到的 pois.type 是同一個 mapped value。
  // 之前 mock 寫死 raw `searchPoi.category`（'sight'）讓 frontend mapped key
  // ('attraction::...') 跟 mock raw key ('sight::...') 對不上。
  const poiTypeByPoiId = new Map();

  await page.route(/\/api\/oauth\/userinfo$/, (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) });
  });

  // Section 2 (terracotta-account-hub-page)：account stats endpoint
  await page.route(/\/api\/account\/stats$/, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tripCount: 5, totalDays: 12, collaboratorCount: 3 }),
    });
  });

  // Logout 走 POST /api/oauth/logout — 不影響 mock fixture，回 200 即可
  await page.route(/\/api\/oauth\/logout$/, (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  // 2026-07-21：回完整資料，不再只回 { tripId }。
  //
  // 舊 mock 模仿的是「/my-trips 只給 id 集合、metadata 另外跟 /api/trips 要」
  // 的用法。前端在 v2.57.3/v2.57.4 改為單抓 /my-trips（/api/trips 只回
  // published 行程，行程改為不公開後 metadata 全空 → 名稱變 tripId），
  // 這個 mock 就成了唯一還在假設舊契約的地方 —— e2e 因此看不到標題。
  //
  // 真實 /api/my-trips 本來就帶 name/title/countries/totalDays/startDate/
  // endDate/memberCount，mock 照實回才不會再與 prod 脫節。
  await page.route(/\/api\/my-trips$/, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_TRIPS_LIST),
    });
  });

  await page.route(/\/api\/account\/sessions(?:\/[^/]+)?$/, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/account/sessions') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessions }),
      });
    }
    if (request.method() === 'DELETE' && path === '/api/account/sessions') {
      const current = sessions.find((s) => s.is_current);
      sessions.splice(0, sessions.length, ...(current ? [current] : []));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
    if (request.method() === 'DELETE') {
      const sid = decodeURIComponent(path.split('/').pop() ?? '');
      const idx = sessions.findIndex((s) => s.sid === sid);
      if (idx >= 0) sessions.splice(idx, 1);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
    return route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ error: 'Method not allowed' }) });
  });

  await page.route(/\/api\/account\/connected-apps(?:\/[^/]+)?$/, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ apps: connectedApps }),
      });
    }
    if (request.method() === 'DELETE') {
      const clientId = decodeURIComponent(path.split('/').pop() ?? '');
      const idx = connectedApps.findIndex((app) => app.client_id === clientId);
      if (idx >= 0) connectedApps.splice(idx, 1);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
    return route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ error: 'Method not allowed' }) });
  });

  await page.route(/\/api\/poi-search/, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: MOCK_POI_SEARCH_RESULTS }),
    });
  });

  await page.route(/\/api\/pois\/find-or-create$/, async (route) => {
    const body = route.request().postDataJSON?.() ?? {};
    const existing = savedPois.find((p) => p.poiName === body.name);
    const id = existing?.poiId ?? ++nextPoiId;
    // Stash 客戶端 mapped type — 對齊 real backend pois.type 儲存 mapped value，
    // 後面 POST /poi-favorites 透過 poiId 拿回此 type 寫進 row.poiType。
    if (body.type) poiTypeByPoiId.set(id, body.type);
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id }) });
  });

  await page.route(/\/api\/poi-favorites(?:\/\d+)?$/, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(savedPois) });
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON?.() ?? {};
      const searchPoi = MOCK_POI_SEARCH_RESULTS[0];
      const poiId = body.poiId ?? nextPoiId++;
      // v2.31.43：對齊 real backend — poiType 來自 pois.type（mapped value
      // from find-or-create body.type），fallback 走 mapping helper 邏輯。
      const mappedType = poiTypeByPoiId.get(poiId) ?? mockMapCategory(searchPoi.category);
      // Round 25 (v2.33.75): align with backend reality
      // - poi_favorites schema (migration 0050): id / user_id / poi_id / favorited_at / note
      // - email column DROP'd in v2.21.0
      // - saved_at renamed to favorited_at (migration 0050) → deepCamel → favoritedAt
      // - poiName/poiAddress/poiLat/poiLng/poiType/poiRating are JOIN'd from pois (GET only;
      //   POST RETURNING * 不含；mock 多餘地塞入是為了下一輪 GET 不必補 fixture，accept this fiction)
      const row = {
        id: ++nextSavedId,
        userId: MOCK_USER.userId ?? MOCK_USER.id ?? 'mock-user-id',
        poiId,
        favoritedAt: new Date().toISOString(),
        note: body.note ?? null,
        poiName: searchPoi.name,
        poiAddress: searchPoi.address,
        poiLat: searchPoi.lat,
        poiLng: searchPoi.lng,
        poiType: mappedType,
      };
      savedPois.unshift(row);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row) });
    }
    if (request.method() === 'DELETE') {
      const id = Number(path.split('/').pop());
      const idx = savedPois.findIndex((p) => p.id === id);
      if (idx >= 0) savedPois.splice(idx, 1);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
    return route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ error: 'Method not allowed' }) });
  });

  // /api/trip-ideas route removed — endpoint retired in V2 cutover (migration 0046)。
  // 任何 e2e 仍 hit 此 path 應該得到 default 404 (Worker handler not found)。

  await page.route(/\/api\/trips/, (route) => {
    const url = route.request().url();
    const path = new URL(url).pathname;
    const method = route.request().method();

    // Pattern: POST /api/trips/:id/days/:num/entries
    const entryCreateMatch = path.match(/^\/api\/trips\/([^/]+)\/days\/(\d+)\/entries$/);
    if (entryCreateMatch && method === 'POST') {
      const [, , dayNum] = entryCreateMatch;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: ++nextEntryId, dayNum: Number(dayNum) }),
      });
    }

    // Pattern: GET/PATCH/DELETE /api/trips/:id/entries/:eid
    // GET 給 EntryActionPage (move/copy) 載 entry day_id; PATCH/DELETE 是修改/刪除。
    // v2.19.13: 真 endpoint 補了 onRequestGet,mock 跟真 API contract 對齊回
    // { id, day_id, title }。
    const entryActionMatch = path.match(/^\/api\/trips\/([^/]+)\/entries\/(\d+)$/);
    if (entryActionMatch) {
      const [, tripId, eid] = entryActionMatch;
      const eidNum = Number(eid);
      if (method === 'GET') {
        const tripDays = TRIP_DAYS[tripId];
        const day = tripDays
          ? Object.values(tripDays.byNum).find((d) => (d.timeline ?? []).some((entry) => entry.id === eidNum))
          : null;
        const entry = day ? (day.timeline ?? []).find((item) => item.id === eidNum) : null;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: eidNum,
            dayId: day?.id ?? 1,
            title: entry?.title ?? `Mock entry ${eid}`,
            master: entry?.master ?? null,
            alternates: (entry?.stopPois ?? []).filter((p) => p.sortOrder > 1),
            stopPois: entry?.stopPois ?? [],
            entryPoisVersion: '1',
          }),
        });
      }
      if (method === 'PATCH' || method === 'DELETE') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: eidNum, ok: true }),
        });
      }
    }

    // Pattern: POST /api/trips/:id/entries/:eid/copy → 複製景點
    const entryCopyMatch = path.match(/^\/api\/trips\/([^/]+)\/entries\/(\d+)\/copy$/);
    if (entryCopyMatch && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: ++nextEntryId, ok: true }),
      });
    }

    // Exact POST /api/trips → 建立新行程，回 { tripId }
    if (path === '/api/trips' && method === 'POST') {
      const body = route.request().postDataJSON?.() ?? {};
      const newTripId = body.id || `mock-trip-${Date.now()}`;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tripId: newTripId }),
      });
    }

    // Pattern: PUT/DELETE /api/trips/:id → 編輯/刪除行程
    const tripActionMatch = path.match(/^\/api\/trips\/([^/]+)$/);
    if (tripActionMatch && (method === 'PUT' || method === 'DELETE')) {
      const [, id] = tripActionMatch;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tripId: id, ok: true }),
      });
    }

    // Exact: /api/trips (trip list)
    if (path === '/api/trips') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TRIPS_LIST) });
    }

    // Pattern: /api/trips/:id/docs/:type
    const docsMatch = path.match(/^\/api\/trips\/([^/]+)\/docs\/([^/]+)$/);
    if (docsMatch) {
      const [, tripId, docType] = docsMatch;
      const docs = TRIP_DOCS[tripId];
      if (docs && docs[docType]) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(docs[docType]) });
      }
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) });
    }

    // Pattern: /api/trips/:id/days/:num
    const dayNumMatch = path.match(/^\/api\/trips\/([^/]+)\/days\/(\d+)$/);
    if (dayNumMatch) {
      const [, tripId, num] = dayNumMatch;
      const tripDays = TRIP_DAYS[tripId];
      if (tripDays && tripDays.byNum[Number(num)]) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tripDays.byNum[Number(num)]) });
      }
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) });
    }

    // Pattern: /api/trips/:id/days
    const daysMatch = path.match(/^\/api\/trips\/([^/]+)\/days$/);
    if (daysMatch) {
      const [, tripId] = daysMatch;
      const tripDays = TRIP_DAYS[tripId];
      if (tripDays) {
        const urlObj = new URL(url);
        const daysPayload = urlObj.searchParams.get('all') === '1'
          ? Object.values(tripDays.byNum)
          : tripDays.list;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(daysPayload) });
      }
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) });
    }

    // Pattern: /api/trips/:id (trip meta)
    const metaMatch = path.match(/^\/api\/trips\/([^/]+)$/);
    if (metaMatch) {
      const [, tripId] = metaMatch;
      if (TRIP_META[tripId]) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TRIP_META[tripId]) });
      }
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) });
    }

    // Fallback: 404
    route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) });
  });
}

module.exports = {
  setupApiMocks,
  MOCK_TRIPS_LIST,
  MOCK_TRIP_META_OKINAWA,
  MOCK_TRIP_META_BUSAN,
  MOCK_DAYS_OKINAWA,
  MOCK_DAYS_BUSAN,
  MOCK_DAY1_OKINAWA,
  MOCK_DAY1_BUSAN,
  MOCK_DOC_FLIGHTS_OKINAWA,
  MOCK_DOC_CHECKLIST_OKINAWA,
  MOCK_DOC_BACKUP_OKINAWA,
  MOCK_DOC_EMERGENCY_OKINAWA,
  MOCK_DOC_SUGGESTIONS_OKINAWA,
};
