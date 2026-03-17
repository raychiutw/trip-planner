// @ts-check
/**
 * Shared API mock data and route setup for Playwright E2E tests.
 *
 * The mock data mirrors the REAL D1 API response format:
 * - trips.ts      → GET /api/trips       → array of trip rows
 * - trips/[id].ts → GET /api/trips/:id   → single trip row (footer_json parsed to object)
 * - days.ts       → GET /api/trips/:id/days → array of { id, day_num, date, day_of_week, label }
 * - days/[num].ts → GET /api/trips/:id/days/:num → full day with hotel, timeline, restaurants, shopping
 * - docs/[type].ts → GET /api/trips/:id/docs/:type → { doc_type, content (JSON string), updated_at }
 */

/* ===== /api/trips (trip list) ===== */
const MOCK_TRIPS_LIST = [
  {
    tripId: 'okinawa-trip-2026-Ray',
    name: '沖繩自駕五日遊',
    owner: 'Ray',
    title: '2026 沖繩自駕五日遊',
    self_drive: 1,
    countries: '["JP"]',
    published: 1,
    auto_scroll: '["2026-07-01","2026-07-02","2026-07-03","2026-07-04","2026-07-05"]',
    footer_json: '{"title":"沖繩自駕五日遊","dates":"2026/07/01 — 07/05","tagline":"享受沖繩的陽光與海風","budget":"預算：每人 NT$35,000","exchangeNote":"匯率：1 JPY ≈ 0.22 TWD"}',
  },
  {
    tripId: 'busan-trip-2026-CeliaDemyKathy',
    name: '釜山三日遊',
    owner: 'CeliaDemyKathy',
    title: '2026 釜山三日遊',
    self_drive: 0,
    countries: '["KR"]',
    published: 1,
    auto_scroll: '["2026-08-10","2026-08-11","2026-08-12"]',
    footer_json: '{"title":"釜山三日遊","dates":"2026/08/10 — 08/12","tagline":"韓國美食之旅","budget":"預算：每人 NT$25,000"}',
  },
];

/* ===== /api/trips/okinawa-trip-2026-Ray (single trip meta) ===== */
const MOCK_TRIP_META_OKINAWA = {
  id: 'okinawa-trip-2026-Ray',
  tripId: 'okinawa-trip-2026-Ray',
  name: '沖繩自駕五日遊',
  owner: 'Ray',
  title: '2026 沖繩自駕五日遊',
  description: '五天四夜沖繩自駕行程',
  og_description: '沖繩自駕五日遊行程規劃',
  self_drive: 1,
  countries: '["JP"]',
  published: 1,
  auto_scroll: '["2026-07-01","2026-07-02","2026-07-03","2026-07-04","2026-07-05"]',
  // footer_json is parsed to object by the API handler
  footer_json: {
    title: '沖繩自駕五日遊',
    dates: '2026/07/01 — 07/05',
    tagline: '享受沖繩的陽光與海風',
    budget: '預算：每人 NT$35,000',
    exchangeNote: '匯率：1 JPY ≈ 0.22 TWD',
  },
};

/* ===== /api/trips/busan-trip-2026-CeliaDemyKathy (single trip meta) ===== */
const MOCK_TRIP_META_BUSAN = {
  id: 'busan-trip-2026-CeliaDemyKathy',
  tripId: 'busan-trip-2026-CeliaDemyKathy',
  name: '釜山三日遊',
  owner: 'CeliaDemyKathy',
  title: '2026 釜山三日遊',
  description: '三天兩夜釜山美食行程',
  og_description: '釜山三日遊行程規劃',
  self_drive: 0,
  countries: '["KR"]',
  published: 1,
  auto_scroll: '["2026-08-10","2026-08-11","2026-08-12"]',
  footer_json: {
    title: '釜山三日遊',
    dates: '2026/08/10 — 08/12',
    tagline: '韓國美食之旅',
    budget: '預算：每人 NT$25,000',
  },
};

/* ===== /api/trips/:id/days (days summary) ===== */
const MOCK_DAYS_OKINAWA = [
  { id: 1, day_num: 1, date: '2026-07-01', day_of_week: '三', label: '那霸市區' },
  { id: 2, day_num: 2, date: '2026-07-02', day_of_week: '四', label: '美國村' },
  { id: 3, day_num: 3, date: '2026-07-03', day_of_week: '五', label: '海洋博公園' },
  { id: 4, day_num: 4, date: '2026-07-04', day_of_week: '六', label: '北谷・恩納' },
  { id: 5, day_num: 5, date: '2026-07-05', day_of_week: '日', label: '回程' },
];

const MOCK_DAYS_BUSAN = [
  { id: 1, day_num: 1, date: '2026-08-10', day_of_week: '一', label: '海雲臺' },
  { id: 2, day_num: 2, date: '2026-08-11', day_of_week: '二', label: '南浦洞' },
  { id: 3, day_num: 3, date: '2026-08-12', day_of_week: '三', label: '回程' },
];

/* ===== /api/trips/okinawa-trip-2026-Ray/days/1 (full day) ===== */
const MOCK_DAY1_OKINAWA = {
  id: 1,
  day_num: 1,
  date: '2026-07-01',
  day_of_week: '三',
  label: '那霸市區',
  weather_json: { locations: [{ name: '那霸', lat: 26.3344, lon: 127.7457 }] },
  hotel: {
    id: 1,
    day_id: 1,
    name: 'Hilton 沖繩那霸首里城',
    checkout: '11:00',
    address: '沖繩縣那霸市首里山川町 1-132-1',
    maps: 'Hilton 沖繩那霸首里城',
    details: '禁菸雙人房, 含早餐, 免費 Wi-Fi',
    note: null,
    breakfast: '{"included":true,"note":"7:00-9:30 一樓餐廳"}',
    parking_json: '{"price":"1000 日圓/晚","maps":"Hilton 那霸停車場","note":"先到先停"}',
    shopping: [
      {
        id: 1,
        parent_type: 'hotel',
        parent_id: 1,
        name: '那霸國際通購物',
        category: '購物',
        maps: '國際通商店街',
        rating: 4.2,
        hours: '10:00-22:00',
        must_buy: '紅芋塔, 金楚糕, 黑糖',
        note: '附近步行 10 分鐘',
      },
    ],
  },
  timeline: [
    {
      id: 101,
      day_id: 1,
      sort_order: 0,
      time: '09:00-10:30',
      title: '首里城',
      body: '世界遺產，琉球王朝的象徵',
      maps: '首里城公園',
      mapcode: '33 161 526*71',
      rating: 4.5,
      note: '建議早上前往避開人潮',
      travel_type: 'car',
      travel_desc: '從飯店開車 15 分鐘',
      travel_min: 15,
      // No location_json — tests fallback to maps+mapcode
      location_json: null,
      travel: { type: 'car', desc: '從飯店開車 15 分鐘', min: 15 },
      restaurants: [
        {
          id: 201,
          entry_id: 101,
          name: '首里そば',
          category: '午餐',
          address: '沖繩縣那霸市首里赤田町 1-7',
          maps: '首里そば',
          rating: 4.3,
          hours: '11:30-14:00',
          price: '¥800-1200',
          description: '沖繩傳統麵食',
          reservation: '不需預約',
          reservation_url: null,
          note: null,
        },
        {
          id: 202,
          entry_id: 101,
          name: '花笠食堂',
          category: '午餐',
          address: '沖繩縣那霸市牧志 3-2-48',
          maps: '花笠食堂',
          rating: 4.1,
          hours: '11:00-21:00',
          price: '¥600-1000',
          description: '家庭料理定食',
          reservation: null,
          reservation_url: null,
          note: null,
        },
      ],
      shopping: [],
    },
    {
      id: 102,
      day_id: 1,
      sort_order: 1,
      time: '11:00-12:30',
      title: '波上宮',
      body: '沖繩最古老的神社',
      maps: null,
      mapcode: null,
      rating: 4.0,
      note: null,
      travel_type: 'car',
      travel_desc: '開車 20 分鐘',
      travel_min: 20,
      location_json: '[{"name":"波上宮","googleQuery":"https://www.google.com/maps/search/波上宮","appleQuery":"https://maps.apple.com/?q=波上宮"}]',
      travel: { type: 'car', desc: '開車 20 分鐘', min: 20 },
      restaurants: [],
      shopping: [
        {
          id: 301,
          parent_type: 'entry',
          parent_id: 102,
          name: '波上宮御守',
          category: '紀念品',
          maps: '波上宮',
          rating: null,
          hours: '09:00-17:00',
          must_buy: '御守, 繪馬',
          note: '境內販售',
        },
      ],
    },
    {
      id: 103,
      day_id: 1,
      sort_order: 2,
      time: '14:00-16:00',
      title: '國際通散步',
      body: '沖繩最熱鬧的商店街',
      maps: '國際通',
      mapcode: null,
      rating: null,
      note: '適合下午閒逛購物',
      travel_type: 'walking',
      travel_desc: '步行 10 分鐘',
      travel_min: 10,
      location_json: null,
      travel: { type: 'walking', desc: '步行 10 分鐘', min: 10 },
      restaurants: [],
      shopping: [],
    },
    {
      id: 104,
      day_id: 1,
      sort_order: 3,
      time: '17:00-18:30',
      title: '牧志公設市場',
      body: '當地人的廚房，品嚐新鮮海產',
      maps: '牧志公設市場',
      mapcode: null,
      rating: 4.2,
      note: null,
      travel_type: 'walking',
      travel_desc: '步行 5 分鐘',
      travel_min: 5,
      location_json: '{"name":"牧志公設市場","googleQuery":"https://www.google.com/maps/search/牧志公設市場","appleQuery":"https://maps.apple.com/?q=牧志公設市場"}',
      travel: { type: 'walking', desc: '步行 5 分鐘', min: 5 },
      restaurants: [
        {
          id: 203,
          entry_id: 104,
          name: '市場二樓食堂',
          category: '晚餐',
          address: '沖繩縣那霸市松尾 2-10-1',
          maps: '牧志公設市場二樓',
          rating: 4.4,
          hours: '11:00-20:00',
          price: '¥1500-3000',
          description: '一樓買海鮮二樓代煮',
          reservation: '不需預約',
          reservation_url: null,
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
    day_num: dayNum,
    date: date,
    day_of_week: dayOfWeek,
    label: label,
    weather_json: { locations: [{ name: '沖繩', lat: 26.33, lon: 127.74 }] },
    hotel: {
      id: dayNum * 10,
      day_id: dayNum,
      name: 'Day ' + dayNum + ' Hotel',
      checkout: '11:00',
      address: '沖繩',
      maps: null,
      details: null,
      note: null,
      breakfast: '{"included":true}',
      parking_json: null,
      shopping: [],
    },
    timeline: [
      {
        id: dayNum * 100 + 1,
        day_id: dayNum,
        sort_order: 0,
        time: '09:00-12:00',
        title: label + '景點',
        body: '第' + dayNum + '天行程',
        maps: label,
        mapcode: null,
        rating: null,
        note: null,
        travel_type: 'car',
        travel_desc: '開車 30 分鐘',
        travel_min: 30,
        location_json: null,
        travel: { type: 'car', desc: '開車 30 分鐘', min: 30 },
        restaurants: [],
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
  day_num: 1,
  date: '2026-08-10',
  day_of_week: '一',
  label: '海雲臺',
  weather_json: { locations: [{ name: '釜山', lat: 35.1796, lon: 129.0756 }] },
  hotel: {
    id: 50,
    day_id: 1,
    name: 'Park Hyatt Busan',
    checkout: '12:00',
    address: '釜山廣域市海雲臺區',
    maps: 'Park Hyatt Busan',
    details: '海景雙人房',
    note: null,
    breakfast: '{"included":true,"note":"自助餐 6:30-10:00"}',
    parking_json: null,
    shopping: [],
  },
  timeline: [
    {
      id: 501,
      day_id: 1,
      sort_order: 0,
      time: '10:00-12:00',
      title: '海雲臺海水浴場',
      body: '釜山最著名的海灘',
      maps: null,
      mapcode: null,
      rating: 4.5,
      note: null,
      travel_type: 'train',
      travel_desc: '地鐵 20 分鐘',
      travel_min: 20,
      location_json: '{"name":"海雲臺海水浴場","googleQuery":"https://www.google.com/maps/search/해운대해수욕장","appleQuery":"https://maps.apple.com/?q=해운대해수욕장","naverQuery":"https://map.naver.com/v5/search/해운대해수욕장"}',
      travel: { type: 'train', desc: '地鐵 20 分鐘', min: 20 },
      restaurants: [],
      shopping: [],
    },
  ],
};

const MOCK_DAY2_BUSAN = buildMinimalDay(2, '2026-08-11', '二', '南浦洞');
const MOCK_DAY3_BUSAN = buildMinimalDay(3, '2026-08-12', '三', '回程');

/* ===== /api/trips/:id/docs/:type ===== */
const MOCK_DOC_FLIGHTS_OKINAWA = {
  doc_type: 'flights',
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
  updated_at: '2026-01-15T10:00:00Z',
};

const MOCK_DOC_CHECKLIST_OKINAWA = {
  doc_type: 'checklist',
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
  updated_at: '2026-01-15T10:00:00Z',
};

const MOCK_DOC_BACKUP_OKINAWA = {
  doc_type: 'backup',
  content: JSON.stringify({
    title: '備案行程',
    content: {
      cards: [
        { title: '雨天備案', description: '若遇大雨', weatherItems: ['美麗海水族館（室內）', 'AEON MALL 購物'], items: ['DFS 免稅店', '首里城地下停車場'] },
        { title: '颱風備案', description: '若遇颱風', items: ['待在飯店休息', '確認航班狀態'] },
      ],
    },
  }),
  updated_at: '2026-01-15T10:00:00Z',
};

const MOCK_DOC_EMERGENCY_OKINAWA = {
  doc_type: 'emergency',
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
  updated_at: '2026-01-15T10:00:00Z',
};

const MOCK_DOC_SUGGESTIONS_OKINAWA = {
  doc_type: 'suggestions',
  content: JSON.stringify({
    title: '行程建議',
    content: {
      cards: [
        { title: '美食推薦', priority: 'high', items: ['必吃沖繩豬肉蛋飯糰', '塔可飯推薦 King Tacos'] },
        { title: '購物建議', priority: 'medium', items: ['紅芋塔建議在國際通購買', '藥妝店推薦松本清'] },
      ],
    },
  }),
  updated_at: '2026-01-15T10:00:00Z',
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

/* ===== Setup function ===== */

/**
 * Intercept all API routes with mock data using a single route handler.
 * Uses URL parsing to dispatch to the correct mock data.
 * @param {import('@playwright/test').Page} page
 */
async function setupApiMocks(page) {
  await page.route(/\/api\/trips/, (route) => {
    const url = route.request().url();
    const path = new URL(url).pathname;

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
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tripDays.list) });
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
