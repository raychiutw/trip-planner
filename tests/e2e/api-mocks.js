// @ts-check
/**
 * Shared API mock data and route setup for Playwright E2E tests.
 *
 * The mock data mirrors the REAL D1 API response format:
 * - trips.ts      → GET /api/trips       → array of trip rows
 * - trips/[id].ts → GET /api/trips/:id   → single trip row (footer parsed to object)
 * - days.ts       → GET /api/trips/:id/days → array of { id, dayNum, date, dayOfWeek, label }
 * - days/[num].ts → GET /api/trips/:id/days/:num → full day with hotel, timeline, restaurants, shopping
 * - docs/[type].ts → GET /api/trips/:id/docs/:type → { docType, content (JSON string), updatedAt }
 */

/* ===== /api/trips (trip list) ===== */
const MOCK_TRIPS_LIST = [
  {
    tripId: 'okinawa-trip-2026-Ray',
    name: '沖繩自駕五日遊',
    owner: 'Ray',
    title: '2026 沖繩自駕五日遊',
    selfDrive: 1,
    countries: '["JP"]',
    published: 1,
    autoScroll: '["2026-07-01","2026-07-02","2026-07-03","2026-07-04","2026-07-05"]',
    footer: '{"title":"沖繩自駕五日遊","dates":"2026/07/01 — 07/05","tagline":"享受沖繩的陽光與海風","budget":"預算：每人 NT$35,000","exchangeNote":"匯率：1 JPY ≈ 0.22 TWD"}',
  },
  {
    tripId: 'busan-trip-2026-CeliaDemyKathy',
    name: '釜山三日遊',
    owner: 'CeliaDemyKathy',
    title: '2026 釜山三日遊',
    selfDrive: 0,
    countries: '["KR"]',
    published: 1,
    autoScroll: '["2026-08-10","2026-08-11","2026-08-12"]',
    footer: '{"title":"釜山三日遊","dates":"2026/08/10 — 08/12","tagline":"韓國美食之旅","budget":"預算：每人 NT$25,000"}',
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
  ogDescription: '沖繩自駕五日遊行程規劃',
  selfDrive: 1,
  countries: '["JP"]',
  published: 1,
  autoScroll: '["2026-07-01","2026-07-02","2026-07-03","2026-07-04","2026-07-05"]',
  // footer is parsed to object by the API handler
  footer: {
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
  ogDescription: '釜山三日遊行程規劃',
  selfDrive: 0,
  countries: '["KR"]',
  published: 1,
  autoScroll: '["2026-08-10","2026-08-11","2026-08-12"]',
  footer: {
    title: '釜山三日遊',
    dates: '2026/08/10 — 08/12',
    tagline: '韓國美食之旅',
    budget: '預算：每人 NT$25,000',
  },
};

/* ===== /api/trips/:id/days (days summary) ===== */
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
      mapcode: '33 161 526*71',
      googleRating: 4.5,
      note: '建議早上前往避開人潮',
      travelType: 'car',
      travelDesc: '從飯店開車 15 分鐘',
      travelMin: 15,
      // No location — tests fallback to maps+mapcode
      location: null,
      travel: { type: 'car', desc: '從飯店開車 15 分鐘', min: 15 },
      restaurants: [
        {
          id: 201,
          entryId: 101,
          name: '首里そば',
          category: '午餐',
          address: '沖繩縣那霸市首里赤田町 1-7',
          maps: '首里そば',
          googleRating: 4.3,
          hours: '11:30-14:00',
          price: '¥800-1200',
          description: '沖繩傳統麵食',
          reservation: '不需預約',
          reservationUrl: null,
          note: null,
        },
        {
          id: 202,
          entryId: 101,
          name: '花笠食堂',
          category: '午餐',
          address: '沖繩縣那霸市牧志 3-2-48',
          maps: '花笠食堂',
          googleRating: 4.1,
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
      mapcode: null,
      googleRating: 4.0,
      note: null,
      travelType: 'car',
      travelDesc: '開車 20 分鐘',
      travelMin: 20,
      location: '[{"name":"波上宮","googleQuery":"https://www.google.com/maps/search/波上宮","appleQuery":"https://maps.apple.com/?q=波上宮"}]',
      travel: { type: 'car', desc: '開車 20 分鐘', min: 20 },
      restaurants: [],
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
      mapcode: null,
      googleRating: null,
      note: '適合下午閒逛購物',
      travelType: 'walking',
      travelDesc: '步行 10 分鐘',
      travelMin: 10,
      location: null,
      travel: { type: 'walking', desc: '步行 10 分鐘', min: 10 },
      restaurants: [],
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
      mapcode: null,
      googleRating: 4.2,
      note: null,
      travelType: 'walking',
      travelDesc: '步行 5 分鐘',
      travelMin: 5,
      location: '{"name":"牧志公設市場","googleQuery":"https://www.google.com/maps/search/牧志公設市場","appleQuery":"https://maps.apple.com/?q=牧志公設市場"}',
      travel: { type: 'walking', desc: '步行 5 分鐘', min: 5 },
      restaurants: [
        {
          id: 203,
          entryId: 104,
          name: '市場二樓食堂',
          category: '晚餐',
          address: '沖繩縣那霸市松尾 2-10-1',
          maps: '牧志公設市場二樓',
          googleRating: 4.4,
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
        mapcode: null,
        googleRating: null,
        note: null,
        travelType: 'car',
        travelDesc: '開車 30 分鐘',
        travelMin: 30,
        location: null,
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
      mapcode: null,
      googleRating: 4.5,
      note: null,
      travelType: 'train',
      travelDesc: '地鐵 20 分鐘',
      travelMin: 20,
      location: '{"name":"海雲臺海水浴場","googleQuery":"https://www.google.com/maps/search/해운대해수욕장","appleQuery":"https://maps.apple.com/?q=해운대해수욕장","naverQuery":"https://map.naver.com/v5/search/해운대해수욕장"}',
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
