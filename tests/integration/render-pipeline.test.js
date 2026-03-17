import { describe, it, expect } from 'vitest';

/**
 * Integration tests: Full render pipeline
 * API response (snake_case, JSON strings) → mapApiDay → render functions → HTML output
 *
 * Uses the same mock data patterns as tests/e2e/api-mocks.js.
 */

const {
  mapApiDay,
  mapApiMeta,
  renderDayContent,
  renderHotel,
  renderTimeline,
  renderTimelineEvent,
  renderRestaurant,
  renderShop,
  renderInfoBox,
  renderFlights,
  renderChecklist,
  renderBackup,
  renderEmergency,
  renderSuggestions,
  calcDrivingStats,
  renderDrivingStats,
} = require('../../js/app.js');

/* ===== Shared helper: unwrap doc content (mirrors loadTrip logic in app.js) ===== */
function unwrapDocContent(rawContent) {
  var content = rawContent;
  if (typeof content === 'string') {
    try { content = JSON.parse(content); } catch (e) {}
  }
  if (content && content.content) {
    var docTitle = content.title;
    content = content.content;
    content._title = docTitle;
  }
  return content;
}

/* ===== Mock API data ===== */

const MOCK_DAY1 = {
  id: 1,
  day_num: 1,
  date: '2026-07-01',
  day_of_week: '三',
  label: '那霸市區',
  weather_json: '{"locations":[{"name":"那霸","lat":26.3344,"lon":127.7457}]}',
  hotel: {
    id: 1,
    day_id: 1,
    name: 'Hilton 沖繩那霸首里城',
    checkout: '11:00',
    details: '禁菸雙人房, 含早餐, 免費 Wi-Fi',
    breakfast: '{"included":true,"note":"7:00-9:30 一樓餐廳"}',
    parking_json: '{"price":"1000 日圓/晚","maps":"Hilton 那霸停車場","note":"先到先停"}',
    shopping: [
      {
        id: 1,
        name: '那霸國際通購物',
        category: '購物',
        maps: '國際通商店街',
        rating: 4.2,
        hours: '10:00-22:00',
        must_buy: '紅芋塔, 金楚糕, 黑糖',
      },
    ],
  },
  timeline: [
    {
      id: 101,
      time: '09:00-10:30',
      title: '首里城',
      body: '世界遺產，琉球王朝的象徵',
      maps: '首里城公園',
      mapcode: '33 161 526*71',
      rating: 4.5,
      note: '建議早上前往避開人潮',
      location_json: null,
      travel: { type: 'car', desc: '從飯店開車 15 分鐘', min: 15 },
      restaurants: [
        {
          id: 201,
          name: '首里そば',
          category: '午餐',
          maps: '首里そば',
          rating: 4.3,
          hours: '11:30-14:00',
          price: '¥800-1200',
          reservation: '不需預約',
          reservation_url: null,
        },
        {
          id: 202,
          name: '花笠食堂',
          category: '午餐',
          maps: '花笠食堂',
          rating: 4.1,
          hours: '11:00-21:00',
          price: '¥600-1000',
        },
      ],
      shopping: [],
    },
    {
      id: 102,
      time: '11:00-12:30',
      title: '波上宮',
      body: '沖繩最古老的神社',
      maps: null,
      rating: 4.0,
      location_json: '[{"name":"波上宮","googleQuery":"https://www.google.com/maps/search/%E6%B3%A2%E4%B8%8A%E5%AE%AE","appleQuery":"https://maps.apple.com/?q=%E6%B3%A2%E4%B8%8A%E5%AE%AE"}]',
      travel: { type: 'car', desc: '開車 20 分鐘', min: 20 },
      restaurants: [],
      shopping: [
        {
          id: 301,
          name: '波上宮御守',
          category: '紀念品',
          maps: '波上宮',
          must_buy: '御守, 繪馬',
        },
      ],
    },
    {
      id: 103,
      time: '14:00-16:00',
      title: '國際通散步',
      body: '沖繩最熱鬧的商店街',
      maps: '國際通',
      location_json: null,
      travel: { type: 'walking', desc: '步行 10 分鐘', min: 10 },
      restaurants: [],
      shopping: [],
    },
  ],
};

const MOCK_DOC_FLIGHTS = {
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
};

const MOCK_DOC_CHECKLIST = {
  doc_type: 'checklist',
  content: JSON.stringify({
    title: '出發前確認',
    content: {
      cards: [
        { title: '證件', items: ['護照（效期6個月以上）', '台胞證', '國際駕照'] },
        { title: '交通', items: ['租車預約確認', 'ETC 卡'] },
      ],
    },
  }),
};

const MOCK_DOC_BACKUP = {
  doc_type: 'backup',
  content: JSON.stringify({
    title: '備案行程',
    content: {
      cards: [
        { title: '雨天備案', description: '若遇大雨', weatherItems: ['美麗海水族館（室內）'], items: ['DFS 免稅店'] },
        { title: '颱風備案', description: '若遇颱風', items: ['待在飯店休息'] },
      ],
    },
  }),
};

const MOCK_DOC_EMERGENCY = {
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
};

const MOCK_DOC_SUGGESTIONS = {
  doc_type: 'suggestions',
  content: JSON.stringify({
    title: '行程建議',
    content: {
      cards: [
        { title: '美食推薦', priority: 'high', items: ['必吃沖繩豬肉蛋飯糰', '塔可飯推薦 King Tacos'] },
        { title: '購物建議', priority: 'medium', items: ['紅芋塔建議在國際通購買'] },
      ],
    },
  }),
};

const MOCK_TRIP_META = {
  id: 'okinawa-trip-2026-Ray',
  name: '沖繩自駕五日遊',
  title: '2026 沖繩自駕五日遊',
  og_description: '沖繩自駕五日遊行程規劃',
  self_drive: 1,
  countries: '["JP"]',
  auto_scroll: '["2026-07-01","2026-07-02","2026-07-03","2026-07-04","2026-07-05"]',
  footer_json: '{"title":"沖繩自駕五日遊","dates":"2026/07/01 — 07/05","tagline":"享受沖繩的陽光與海風","budget":"預算：每人 NT$35,000"}',
};

/* ===== Test 1: Full day render pipeline ===== */
describe('Full day render pipeline', () => {
  it('maps API day and renders full day content with hotel and timeline', () => {
    const mapped = mapApiDay(MOCK_DAY1);
    const html = renderDayContent(mapped.content);

    // Hotel name
    expect(html).toContain('Hilton 沖繩那霸首里城');
    // Breakfast
    expect(html).toContain('含早餐');
    expect(html).toContain('7:00-9:30 一樓餐廳');
    // Parking
    expect(html).toContain('1000 日圓/晚');
    // Shopping in hotel
    expect(html).toContain('那霸國際通購物');
    // Timeline events
    expect(html).toContain('首里城');
    expect(html).toContain('波上宮');
    expect(html).toContain('國際通散步');
    // Restaurant names in infobox
    expect(html).toContain('首里そば');
    expect(html).toContain('花笠食堂');
    // Map links (Google/Apple)
    expect(html).toContain('google.com/maps');
    expect(html).toContain('maps.apple.com');
    // Rating stars
    expect(html).toContain('★ 4.5');
    expect(html).toContain('★ 4.3');
  });
});

/* ===== Test 2: Hotel render pipeline ===== */
describe('Hotel render pipeline', () => {
  it('renders hotel name, checkout details, breakfast, parking infobox, shopping infobox', () => {
    const mapped = mapApiDay(MOCK_DAY1);
    const html = renderHotel(mapped.content.hotel);

    // Hotel name
    expect(html).toContain('Hilton 沖繩那霸首里城');
    // Details (split from comma-separated)
    expect(html).toContain('禁菸雙人房');
    expect(html).toContain('含早餐');
    expect(html).toContain('免費 Wi-Fi');
    // Breakfast note
    expect(html).toContain('7:00-9:30 一樓餐廳');
    // Parking infobox
    expect(html).toContain('1000 日圓/晚');
    // Shopping infobox — shop name
    expect(html).toContain('那霸國際通購物');
    // Must buy items
    expect(html).toContain('紅芋塔');
    expect(html).toContain('金楚糕');
    expect(html).toContain('黑糖');
  });

  it('hotel with no parking and no shopping has no parking/shopping infoboxes', () => {
    const apiDay = {
      day_num: 1,
      hotel: { name: 'Simple Hotel', breakfast: '{"included":false}', parking_json: null, shopping: [] },
      timeline: [],
    };
    const mapped = mapApiDay(apiDay);
    const html = renderHotel(mapped.content.hotel);

    expect(html).toContain('Simple Hotel');
    expect(html).toContain('不含早餐');
    expect(html).not.toContain('停車');
    // No shopping infobox class
    expect(html).not.toContain('info-box shopping');
  });
});

/* ===== Test 3: Timeline entry render pipeline ===== */
describe('Timeline entry render pipeline', () => {
  it('renders timeline with time, title, rating, description, map links, restaurants, travel', () => {
    const mapped = mapApiDay(MOCK_DAY1);
    const html = renderTimeline(mapped.content.timeline);

    // Time labels
    expect(html).toContain('09:00');
    expect(html).toContain('10:30');
    // Titles
    expect(html).toContain('首里城');
    expect(html).toContain('波上宮');
    expect(html).toContain('國際通散步');
    // Rating stars
    expect(html).toContain('★ 4.5');
    expect(html).toContain('★ 4.0');
    // Description (body → description)
    expect(html).toContain('世界遺產，琉球王朝的象徵');
    // Map link present (renderNavLinks generates www.google.com/maps URLs)
    expect(html).toContain('google.com/maps');
    // Restaurant infobox
    expect(html).toContain('首里そば');
    // Shopping infobox
    expect(html).toContain('波上宮御守');
    // Travel info
    expect(html).toContain('從飯店開車 15 分鐘');
    expect(html).toContain('開車 20 分鐘');
  });

  it('renderTimelineEvent renders a single entry with all fields', () => {
    const mapped = mapApiDay(MOCK_DAY1);
    const entry = mapped.content.timeline[0]; // 首里城
    const html = renderTimelineEvent(entry, 1, false);

    expect(html).toContain('首里城');
    expect(html).toContain('09:00');
    expect(html).toContain('★ 4.5');
    expect(html).toContain('世界遺產，琉球王朝的象徵');
    expect(html).toContain('建議早上前往避開人潮'); // note
    expect(html).toContain('首里そば');
    expect(html).toContain('從飯店開車 15 分鐘');
  });
});

/* ===== Test 4: Restaurant render pipeline ===== */
describe('Restaurant render pipeline', () => {
  it('maps restaurant fields and renders name, category, rating, price, maps, hours, reservation', () => {
    const apiDay = {
      day_num: 1,
      hotel: null,
      timeline: [{
        title: '晚餐',
        restaurants: [{
          name: '海鮮食堂',
          category: '晚餐',
          maps: '那霸海鮮食堂',
          mapcode: '33 157 382*24',
          rating: 4.6,
          hours: '17:00-22:00',
          price: '¥2000-4000',
          description: '新鮮海産料理',
          reservation: '需要預約',
          reservation_url: 'https://reserve.example.com/seafood',
        }],
        shopping: [],
        location_json: null,
        travel: null,
      }],
    };
    const mapped = mapApiDay(apiDay);
    const restaurant = mapped.content.timeline[0].restaurants[0];
    const html = renderRestaurant(restaurant);

    // Name and category
    expect(html).toContain('海鮮食堂');
    expect(html).toContain('晚餐');
    // Rating
    expect(html).toContain('★ 4.6');
    // Price
    expect(html).toContain('¥2000-4000');
    // Description
    expect(html).toContain('新鮮海産料理');
    // Maps links (Google + Apple)
    expect(html).toContain('google.com/maps');
    expect(html).toContain('maps.apple.com');
    // Mapcode in URL
    expect(html).toContain('33 157 382*24');
    // Reservation
    expect(html).toContain('需要預約');
    expect(html).toContain('https://reserve.example.com/seafood');
    // Hours
    expect(html).toContain('17:00-22:00');
  });
});

/* ===== Test 5: Shopping render pipeline ===== */
describe('Shopping render pipeline', () => {
  it('maps shopping fields and renders name, mustBuy items, map links, rating', () => {
    const apiDay = {
      day_num: 1,
      hotel: null,
      timeline: [{
        title: '購物',
        restaurants: [],
        shopping: [{
          name: 'MaxValu',
          category: '超市',
          maps: 'MaxValu 那霸',
          rating: 3.9,
          hours: '09:00-24:00',
          must_buy: '泡盛, 黑糖, 海鹽',
        }],
        location_json: null,
        travel: null,
      }],
    };
    const mapped = mapApiDay(apiDay);
    const shop = mapped.content.timeline[0].shopping[0];
    const html = renderShop(shop);

    // Name and category
    expect(html).toContain('MaxValu');
    expect(html).toContain('超市');
    // Rating
    expect(html).toContain('★ 3.9');
    // Must buy items
    expect(html).toContain('泡盛');
    expect(html).toContain('黑糖');
    expect(html).toContain('海鹽');
    // Map links
    expect(html).toContain('google.com/maps');
    expect(html).toContain('maps.apple.com');
    // Hours
    expect(html).toContain('09:00-24:00');
  });
});

/* ===== Test 6: InfoBox render pipeline ===== */
describe('InfoBox render pipeline', () => {
  it('renders restaurants infoBox with restaurant cards', () => {
    const mapped = mapApiDay(MOCK_DAY1);
    const entry = mapped.content.timeline[0]; // 首里城 with restaurants
    const rBox = entry.infoBoxes.find(b => b.type === 'restaurants');
    const html = renderInfoBox(rBox);

    expect(html).toContain('info-box restaurants');
    expect(html).toContain('首里そば');
    expect(html).toContain('花笠食堂');
    expect(html).toContain('午餐');
    // Grid class present (2 restaurants → grid-even)
    expect(html).toContain('grid-even');
  });

  it('renders shopping infoBox with shop cards', () => {
    const mapped = mapApiDay(MOCK_DAY1);
    const entry = mapped.content.timeline[1]; // 波上宮 with shopping
    const sBox = entry.infoBoxes.find(b => b.type === 'shopping');
    const html = renderInfoBox(sBox);

    expect(html).toContain('info-box shopping');
    expect(html).toContain('波上宮御守');
    expect(html).toContain('御守');
    expect(html).toContain('繪馬');
  });

  it('renders parking infoBox with price and map links', () => {
    const mapped = mapApiDay(MOCK_DAY1);
    const hotel = mapped.content.hotel;
    const pBox = hotel.infoBoxes.find(b => b.type === 'parking');
    const html = renderInfoBox(pBox);

    expect(html).toContain('info-box parking');
    expect(html).toContain('1000 日圓/晚');
    // Map links for parking location
    expect(html).toContain('google.com/maps');
    expect(html).toContain('maps.apple.com');
  });
});

/* ===== Test 7: Docs render pipeline ===== */
describe('Flights render pipeline', () => {
  it('parses and renders flight segments with labels, routes, airline', () => {
    const data = unwrapDocContent(MOCK_DOC_FLIGHTS.content);
    const html = renderFlights(data);

    // Segment labels
    expect(html).toContain('去程');
    expect(html).toContain('回程');
    // Flight numbers and routes
    expect(html).toContain('CI 120');
    expect(html).toContain('桃園 TPE → 那霸 OKA');
    expect(html).toContain('CI 121');
    expect(html).toContain('那霸 OKA → 桃園 TPE');
    // Times
    expect(html).toContain('08:30 - 11:00');
    expect(html).toContain('12:00 - 13:30');
    // Airline info
    expect(html).toContain('中華航空');
    expect(html).toContain('託運行李 30kg');
  });
});

describe('Checklist render pipeline', () => {
  it('parses and renders checklist cards with titles and items', () => {
    const data = unwrapDocContent(MOCK_DOC_CHECKLIST.content);
    const html = renderChecklist(data);

    // Card titles
    expect(html).toContain('證件');
    expect(html).toContain('交通');
    // Items
    expect(html).toContain('護照（效期6個月以上）');
    expect(html).toContain('台胞證');
    expect(html).toContain('租車預約確認');
    expect(html).toContain('ETC 卡');
    // Grid structure
    expect(html).toContain('ov-grid');
    expect(html).toContain('ov-card');
  });
});

describe('Backup render pipeline', () => {
  it('parses and renders backup plan cards', () => {
    const data = unwrapDocContent(MOCK_DOC_BACKUP.content);
    const html = renderBackup(data);

    // Card titles
    expect(html).toContain('雨天備案');
    expect(html).toContain('颱風備案');
    // Descriptions
    expect(html).toContain('若遇大雨');
    expect(html).toContain('若遇颱風');
    // Items
    expect(html).toContain('美麗海水族館（室內）');
    expect(html).toContain('DFS 免稅店');
    expect(html).toContain('待在飯店休息');
    // Grid structure
    expect(html).toContain('ov-grid-2');
  });
});

describe('Emergency render pipeline', () => {
  it('parses and renders emergency contacts with tel: links', () => {
    const data = unwrapDocContent(MOCK_DOC_EMERGENCY.content);
    const html = renderEmergency(data);

    // Card titles
    expect(html).toContain('駐日代表處');
    expect(html).toContain('警察・消防');
    // Contact labels
    expect(html).toContain('那霸辦事處');
    expect(html).toContain('急難救助');
    expect(html).toContain('警察');
    expect(html).toContain('消防/救護車');
    // tel: links
    expect(html).toContain('tel:+81-98-862-7008');
    expect(html).toContain('tel:+81-80-6557-8796');
    expect(html).toContain('tel:110');
    expect(html).toContain('tel:119');
    // Notes
    expect(html).toContain('上班時間');
    expect(html).toContain('24 小時');
    // Address
    expect(html).toContain('沖繩縣那霸市久茂地 3-15-9');
  });
});

describe('Suggestions render pipeline', () => {
  it('parses and renders suggestion cards with priority classes', () => {
    const data = unwrapDocContent(MOCK_DOC_SUGGESTIONS.content);
    const html = renderSuggestions(data);

    // Card titles
    expect(html).toContain('美食推薦');
    expect(html).toContain('購物建議');
    // Items
    expect(html).toContain('必吃沖繩豬肉蛋飯糰');
    expect(html).toContain('塔可飯推薦 King Tacos');
    expect(html).toContain('紅芋塔建議在國際通購買');
    // Priority classes
    expect(html).toContain('sg-priority-high');
    expect(html).toContain('sg-priority-medium');
  });
});

/* ===== Test 8: Meta mapping pipeline ===== */
describe('Meta mapping pipeline', () => {
  it('mapApiMeta produces structure expected by loadTrip', () => {
    const result = mapApiMeta(MOCK_TRIP_META);

    // footer parsed
    expect(result.footer).toEqual({
      title: '沖繩自駕五日遊',
      dates: '2026/07/01 — 07/05',
      tagline: '享受沖繩的陽光與海風',
      budget: '預算：每人 NT$35,000',
    });
    // autoScrollDates parsed from JSON array string
    expect(result.autoScrollDates).toEqual([
      '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05',
    ]);
    // meta fields
    expect(result.meta.title).toBe('2026 沖繩自駕五日遊');
    expect(result.meta.selfDrive).toBe(true);
    expect(result.meta.countries).toEqual(['JP']);
    expect(result.meta.ogDescription).toBe('沖繩自駕五日遊行程規劃');
  });
});

/* ===== Test 9: Driving stats pipeline ===== */
describe('Driving stats pipeline', () => {
  it('calcDrivingStats totals minutes and groups by transport type', () => {
    const mapped = mapApiDay(MOCK_DAY1);
    const stats = calcDrivingStats(mapped.content.timeline);

    // car: 15 + 20 = 35 min; walking: 10 min; total: 45 min
    expect(stats).not.toBeNull();
    expect(stats.totalMinutes).toBe(45);
    expect(stats.drivingMinutes).toBe(35);
    expect(stats.byType['car']).toBeDefined();
    expect(stats.byType['car'].totalMinutes).toBe(35);
    expect(stats.byType['walking']).toBeDefined();
    expect(stats.byType['walking'].totalMinutes).toBe(10);
  });

  it('renderDrivingStats produces HTML with total minutes and type breakdown', () => {
    const mapped = mapApiDay(MOCK_DAY1);
    const stats = calcDrivingStats(mapped.content.timeline);
    const html = renderDrivingStats(stats);

    expect(html).toContain('driving-stats');
    expect(html).toContain('當日交通');
    // Total is 45 min
    expect(html).toContain('45 分');
    // Segment texts appear
    expect(html).toContain('從飯店開車 15 分鐘');
    expect(html).toContain('開車 20 分鐘');
    expect(html).toContain('步行 10 分鐘');
  });
});

/* ===== Test 10: Edge cases ===== */
describe('Edge cases', () => {
  it('entry with maps/mapcode but no location_json still renders map links', () => {
    const apiDay = {
      day_num: 1,
      hotel: null,
      timeline: [{
        title: '首里城',
        maps: '首里城公園',
        mapcode: '33 161 526*71',
        location_json: null,
        restaurants: [],
        shopping: [],
        travel: null,
      }],
    };
    const mapped = mapApiDay(apiDay);
    const html = renderTimeline(mapped.content.timeline);

    expect(html).toContain('google.com/maps');
    expect(html).toContain('maps.apple.com');
    // Location name is URL-encoded in href; mapcode appears as visible text
    expect(html).toContain('33 161 526*71');
    // URL-encoded '首里城公園' in the map link href
    expect(html).toContain(encodeURIComponent('首里城公園'));
  });

  it('hotel with no parking has no parking infobox', () => {
    const apiDay = {
      day_num: 1,
      hotel: { name: 'Hotel A', parking_json: null, shopping: [] },
      timeline: [],
    };
    const mapped = mapApiDay(apiDay);

    expect(mapped.content.hotel.infoBoxes).toBeUndefined();
  });

  it('hotel with no shopping has no shopping infobox', () => {
    const apiDay = {
      day_num: 1,
      hotel: { name: 'Hotel A', parking_json: null, shopping: [] },
      timeline: [],
    };
    const mapped = mapApiDay(apiDay);
    const html = renderHotel(mapped.content.hotel);

    expect(html).not.toContain('info-box shopping');
  });

  it('entry with no restaurants or shopping has no infoboxes', () => {
    const apiDay = {
      day_num: 1,
      hotel: null,
      timeline: [{
        title: '景點',
        restaurants: [],
        shopping: [],
        location_json: null,
        travel: null,
      }],
    };
    const mapped = mapApiDay(apiDay);

    expect(mapped.content.timeline[0].infoBoxes).toBeUndefined();
  });

  it('null/empty fields do not crash renderDayContent', () => {
    const apiDay = {
      day_num: 1,
      hotel: null,
      timeline: [],
    };
    const mapped = mapApiDay(apiDay);

    expect(() => renderDayContent(mapped.content)).not.toThrow();
  });

  it('null hotel in mapApiDay passes through as null', () => {
    const result = mapApiDay({ day_num: 1, hotel: null });
    expect(result.content.hotel).toBeNull();
  });

  it('empty timeline in mapApiDay returns empty array', () => {
    const result = mapApiDay({ day_num: 1 });
    expect(result.content.timeline).toEqual([]);
  });
});

/* ===== Test 11: XSS prevention ===== */
describe('XSS prevention', () => {
  it('escapes <script> tag in entry title', () => {
    const apiDay = {
      day_num: 1,
      hotel: null,
      timeline: [{
        title: '<script>alert(1)</script>惡意標題',
        restaurants: [],
        shopping: [],
        location_json: null,
        travel: null,
      }],
    };
    const mapped = mapApiDay(apiDay);
    const html = renderTimeline(mapped.content.timeline);

    // The raw <script> tag must not appear in the output
    expect(html).not.toContain('<script>alert(1)</script>');
    // The escaped version should be present instead
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes HTML entities in restaurant name', () => {
    const apiDay = {
      day_num: 1,
      hotel: null,
      timeline: [{
        title: '餐廳',
        restaurants: [{
          name: '<img src=x onerror=alert(1)>',
          category: '午餐',
          maps: '測試',
        }],
        shopping: [],
        location_json: null,
        travel: null,
      }],
    };
    const mapped = mapApiDay(apiDay);
    const restaurant = mapped.content.timeline[0].restaurants[0];
    const html = renderRestaurant(restaurant);

    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img');
  });

  it('does not render javascript: URL in maps link', () => {
    const apiDay = {
      day_num: 1,
      hotel: null,
      timeline: [{
        title: '危險景點',
        maps: null,
        location_json: null,
        location_json: JSON.stringify([{
          name: '危險',
          googleQuery: 'javascript:alert(1)',
          appleQuery: 'javascript:alert(1)',
        }]),
        restaurants: [],
        shopping: [],
        travel: null,
      }],
    };
    const mapped = mapApiDay(apiDay);
    const html = renderTimeline(mapped.content.timeline);

    // javascript: URLs should not appear as href values
    expect(html).not.toContain('href="javascript:');
  });
});
