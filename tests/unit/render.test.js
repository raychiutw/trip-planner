import { describe, it, expect } from 'vitest';

const { escHtml } = require('../../js/shared.js');
const {
  renderMapLinks,
  renderNavLinks,
  renderRestaurant,
  renderShop,
  renderInfoBox,
  renderTimelineEvent,
  renderTimeline,
  renderHotel,
  renderBudget,
  renderFlights,
  renderChecklist,
  renderBackup,
  renderEmergency,
  renderSuggestions,
  calcDrivingStats,
  renderDrivingStats,
  calcTripDrivingStats,
  renderTripDrivingStats,
  formatMinutes,
  renderCountdown,
  renderTripStatsCard,
  renderSuggestionSummaryCard,
  TRANSPORT_TYPES,
  safeColor,
  APPLE_SVG,
} = require('../../js/app.js');

/* ===== renderMapLinks ===== */
describe('renderMapLinks', () => {
  it('renders Google + Apple links with name fallback', () => {
    const html = renderMapLinks({ name: '首里城' });
    expect(html).toContain('maps.google.com');
    expect(html).toContain('maps.apple.com');
    expect(html).toContain(encodeURIComponent('首里城'));
  });

  it('renders mapcode when provided', () => {
    const html = renderMapLinks({ name: 'Test', mapcode: '33 161 526*53' });
    expect(html).toContain('33 161 526*53');
    expect(html).toContain('mapcode');
  });

  it('uses inline class when inline=true', () => {
    const html = renderMapLinks({ name: 'Test' }, true);
    expect(html).toContain('map-link-inline');
  });

  it('uses googleQuery when provided', () => {
    const html = renderMapLinks({ name: 'Test', googleQuery: 'https://maps.google.com/custom' });
    expect(html).toContain('https://maps.google.com/custom');
  });

  it('uses appleQuery when provided', () => {
    const html = renderMapLinks({ name: 'Test', appleQuery: 'https://maps.apple.com/custom' });
    expect(html).toContain('https://maps.apple.com/custom');
  });

  it('falls back to name-based URL when googleQuery is invalid', () => {
    const html = renderMapLinks({ name: 'Test', googleQuery: 'javascript:alert(1)' });
    expect(html).toContain('maps.google.com');
    expect(html).not.toContain('javascript:');
  });
});

/* ===== renderNavLinks ===== */
describe('renderNavLinks', () => {
  it('returns empty string for empty locations', () => {
    expect(renderNavLinks([])).toBe('');
  });

  it('returns empty string for null', () => {
    expect(renderNavLinks(null)).toBe('');
  });

  it('renders single location with label', () => {
    const html = renderNavLinks([{ label: '集合點', name: '那霸機場' }]);
    expect(html).toContain('nav-links');
    expect(html).toContain('<strong>');
    expect(html).toContain('集合點');
    expect(html).toContain('maps.google.com');
  });

  it('renders multiple locations in order', () => {
    const html = renderNavLinks([
      { label: 'A', name: '首里城' },
      { label: 'B', name: '國際通' },
    ]);
    expect(html).toContain(encodeURIComponent('首里城'));
    expect(html).toContain(encodeURIComponent('國際通'));
    const idxA = html.indexOf('A：');
    const idxB = html.indexOf('B：');
    expect(idxA).toBeLessThan(idxB);
  });

  it('renders location without label (no <strong>)', () => {
    const html = renderNavLinks([{ name: '美麗海水族館' }]);
    expect(html).toContain('nav-links');
    expect(html).not.toContain('<strong>');
    expect(html).toContain('maps.google.com');
  });
});

/* ===== renderRestaurant ===== */
describe('renderRestaurant', () => {
  it('renders restaurant with full data', () => {
    const html = renderRestaurant({
      name: '沖繩そば',
      category: '麵類',
      description: '手工麵條',
      price: '¥800',
      hours: '11:00–21:00',
    });
    expect(html).toContain('restaurant-choice');
    expect(html).toContain('沖繩そば');
    expect(html).toContain('麵類');
    expect(html).toContain('手工麵條');
    expect(html).toContain('¥800');
    expect(html).toContain('11:00–21:00');
  });

  it('renders URL link when provided', () => {
    const html = renderRestaurant({
      name: 'Test',
      url: 'https://example.com',
    });
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
  });

  it('renders reservation link', () => {
    const html = renderRestaurant({
      name: 'Test',
      reservation: '要予約',
      reservationUrl: 'https://reserve.example.com',
    });
    expect(html).toContain('href="https://reserve.example.com"');
    expect(html).toContain('要予約');
  });

  it('escapes XSS in restaurant name', () => {
    const html = renderRestaurant({ name: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders location map links when provided', () => {
    const html = renderRestaurant({
      name: 'Test',
      location: { name: '那霸' },
    });
    expect(html).toContain('maps.google.com');
  });
});

/* ===== renderInfoBox ===== */
describe('renderInfoBox', () => {
  it('renders reservation type', () => {
    const html = renderInfoBox({
      type: 'reservation',
      title: '入場券',
      items: ['大人 ¥2000', '小孩 ¥1000'],
      notes: '需提前預約',
    });
    expect(html).toContain('info-box reservation');
    expect(html).toContain('入場券');
    expect(html).toContain('大人 ¥2000');
    expect(html).toContain('需提前預約');
  });

  it('renders parking type', () => {
    const html = renderInfoBox({
      type: 'parking',
      title: '第一停車場',
      price: '¥500/日',
    });
    expect(html).toContain('info-box parking');
    expect(html).toContain('svg-icon');
    expect(html).toContain('第一停車場');
    expect(html).toContain('¥500/日');
  });

  it('renders souvenir type', () => {
    const html = renderInfoBox({
      type: 'souvenir',
      title: '伴手禮推薦',
      items: [
        { name: '紅芋塔', note: '必買' },
      ],
    });
    expect(html).toContain('info-box souvenir');
    expect(html).toContain('紅芋塔');
    expect(html).toContain('必買');
  });

  it('renders restaurants type', () => {
    const html = renderInfoBox({
      type: 'restaurants',
      restaurants: [
        { name: '拉麵店', hours: '11:00–21:00' },
        { name: '燒肉店', hours: '17:00–23:00' },
      ],
    });
    expect(html).toContain('info-box restaurants');
    expect(html).toContain('選一');
    expect(html).toContain('拉麵店');
    expect(html).toContain('燒肉店');
  });

  it('renders default type with content', () => {
    const html = renderInfoBox({ type: 'note', content: '備註內容' });
    expect(html).toContain('info-box');
    expect(html).toContain('備註內容');
  });

  it('renders parking with location', () => {
    const html = renderInfoBox({
      type: 'parking',
      title: 'P1',
      location: { name: '停車場' },
    });
    expect(html).toContain('maps.google.com');
  });

  it('renders shopping info box', () => {
    const html = renderInfoBox({
      type: 'shopping', title: '附近購物',
      shops: [{ category: '超市', name: 'MaxValu', hours: '08:00-24:00', mustBuy: ['泡盛'], blogUrl: 'https://blog.example.com/maxvalu' }]
    });
    expect(html).toContain('info-box shopping');
    expect(html).toContain('附近購物');
    expect(html).toContain('MaxValu');
    expect(html).toContain('必買');
  });
});

/* ===== renderShop ===== */
describe('renderShop', () => {
  it('renders shop with full data', () => {
    const html = renderShop({
      category: '超市', name: 'San-A',
      hours: '09:00-23:00',
      mustBuy: ['黑糖', '泡盛'],
      blogUrl: 'https://blog.example.com/sana'
    });
    expect(html).toContain('restaurant-choice');
    expect(html).toContain('超市');
    expect(html).toContain('San-A');
    expect(html).toContain('09:00-23:00');
    expect(html).toContain('必買');
    expect(html).toContain('黑糖');
    expect(html).toContain('泡盛');
    expect(html).toContain('href="https://blog.example.com/sana"');
  });
});

/* ===== renderTimelineEvent ===== */
describe('renderTimelineEvent', () => {
  it('renders basic event with time and title', () => {
    const html = renderTimelineEvent({ time: '09:00–10:00', title: '出發' });
    expect(html).toContain('tl-event');
    expect(html).toContain('09:00–10:00');
    expect(html).toContain('出發');
  });

  it('renders event with titleUrl', () => {
    const html = renderTimelineEvent({
      time: '10:00',
      title: '首里城',
      titleUrl: 'https://example.com/shuri',
    });
    expect(html).toContain('href="https://example.com/shuri"');
  });

  it('renders event with description body', () => {
    const html = renderTimelineEvent({
      time: '10:00',
      title: '景點',
      description: '很棒的地方',
    });
    expect(html).toContain('tl-body');
    expect(html).toContain('很棒的地方');
    expect(html).toContain('expanded');
  });

  it('renders event without body', () => {
    const html = renderTimelineEvent({ time: '10:00', title: '路過' });
    expect(html).not.toContain('tl-body');
  });

  it('renders travel info', () => {
    const html = renderTimelineEvent({
      time: '10:00',
      title: 'A',
      travel: { text: '車程 30 分', type: 'car' },
    });
    expect(html).toContain('tl-travel');
    expect(html).toContain('車程 30 分');
  });

  it('renders travel as plain string', () => {
    const html = renderTimelineEvent({
      time: '10:00',
      title: 'A',
      travel: '步行 5 分',
    });
    expect(html).toContain('步行 5 分');
  });

  it('does not render emoji prefix (removed)', () => {
    const html = renderTimelineEvent({ time: '10:00', title: 'Test' });
    expect(html).toContain('tl-title');
    expect(html).toContain('Test');
  });

  it('renders note field', () => {
    const html = renderTimelineEvent({ time: '10:00', title: 'Test', note: '小提醒' });
    expect(html).toContain('小提醒');
  });

  it('renders blogUrl link for attraction', () => {
    const html = renderTimelineEvent({
      time: '10:00', title: '美麗海水族館',
      titleUrl: 'https://churaumi.okinawa/',
      blogUrl: 'https://blog.example.com/churaumi'
    });
    expect(html).toContain('href="https://blog.example.com/churaumi"');
    expect(html).toContain('網誌推薦');
  });
});

/* ===== renderTimeline ===== */
describe('renderTimeline', () => {
  it('returns empty string for empty array', () => {
    expect(renderTimeline([])).toBe('');
  });

  it('returns empty string for null', () => {
    expect(renderTimeline(null)).toBe('');
  });

  it('renders multiple events', () => {
    const html = renderTimeline([
      { time: '09:00', title: 'A' },
      { time: '10:00', title: 'B' },
    ]);
    expect(html).toContain('timeline');
    expect(html).toContain('A');
    expect(html).toContain('B');
  });
});

/* ===== renderHotel ===== */
describe('renderHotel', () => {
  it('renders hotel name', () => {
    const html = renderHotel({ name: '沖繩海景飯店' });
    expect(html).toContain('svg-icon');
    expect(html).toContain('沖繩海景飯店');
  });

  it('renders hotel with URL link', () => {
    const html = renderHotel({
      name: 'Hotel',
      url: 'https://hotel.example.com',
    });
    expect(html).toContain('href="https://hotel.example.com"');
  });

  it('renders details grid', () => {
    const html = renderHotel({
      name: 'Hotel',
      details: ['Check-in 15:00', 'Check-out 11:00'],
    });
    expect(html).toContain('hotel-detail-grid');
    expect(html).toContain('Check-in 15:00');
    expect(html).toContain('Check-out 11:00');
  });

  it('renders infoBoxes with parking', () => {
    const html = renderHotel({
      name: 'Hotel',
      infoBoxes: [
        { type: 'parking', title: '停車場', price: '免費', location: { name: '飯店停車場' } },
      ],
    });
    expect(html).toContain('info-box parking');
    expect(html).toContain('停車場');
    expect(html).toContain('maps.google.com');
  });

  it('renders hotel blogUrl link', () => {
    const html = renderHotel({
      name: '沖繩海景飯店',
      blogUrl: 'https://blog.example.com/hotel'
    });
    expect(html).toContain('href="https://blog.example.com/hotel"');
    expect(html).toContain('網誌推薦');
  });
});

/* ===== renderBudget ===== */
describe('renderBudget', () => {
  it('renders budget items and total', () => {
    const html = renderBudget({
      summary: '¥10,000',
      items: [
        { label: '午餐', amount: '¥2,000' },
        { label: '門票', amount: '¥3,000' },
      ],
      total: { label: '小計', amount: '¥5,000' },
    });
    expect(html).toContain('budget-table');
    expect(html).toContain('午餐');
    expect(html).toContain('¥2,000');
    expect(html).toContain('budget-total');
    expect(html).toContain('¥5,000');
  });

  it('renders notes', () => {
    const html = renderBudget({
      summary: '¥10,000',
      items: [],
      notes: ['匯率以 0.22 計算'],
    });
    expect(html).toContain('notes-list');
    expect(html).toContain('匯率以 0.22 計算');
  });

  it('renders summary in col-row', () => {
    const html = renderBudget({ summary: 'Day 1 費用' });
    expect(html).toContain('svg-icon');
    expect(html).toContain('Day 1 費用');
  });
});

/* ===== renderFlights ===== */
describe('renderFlights', () => {
  it('renders flight segments', () => {
    const html = renderFlights({
      segments: [
        { label: '去程', flightNo: 'BR112', route: 'TPE → OKA', time: '08:00–11:30', icon: '✈️' },
      ],
    });
    expect(html).toContain('flight-row');
    expect(html).toContain('去程');
    expect(html).toContain('BR112');
    expect(html).toContain('TPE → OKA');
    expect(html).toContain('08:00–11:30');
  });

  it('renders airline info', () => {
    const html = renderFlights({
      segments: [],
      airline: { name: '長榮航空', note: '含 30kg 託運', icon: '🏢' },
    });
    expect(html).toContain('長榮航空');
    expect(html).toContain('含 30kg 託運');
  });

  it('handles empty segments', () => {
    const html = renderFlights({});
    expect(html).toBe('');
  });
});

/* ===== renderChecklist ===== */
describe('renderChecklist', () => {
  it('renders cards mode', () => {
    const html = renderChecklist({
      cards: [
        { title: '證件', items: ['護照', '機票'], color: '#e3f2fd' },
      ],
    });
    expect(html).toContain('ov-grid');
    expect(html).toContain('ov-card');
    expect(html).toContain('證件');
    expect(html).toContain('護照');
    expect(html).toContain('機票');
  });

  it('renders flat items mode', () => {
    const html = renderChecklist({
      items: ['護照', '行動電源'],
    });
    expect(html).toContain('notes-list');
    expect(html).toContain('護照');
  });

  it('returns empty for no data', () => {
    expect(renderChecklist({})).toBe('');
  });

  it('renders cards without inline background', () => {
    const html = renderChecklist({
      cards: [{ title: 'T', items: ['A'], color: '#e3f2fd' }],
    });
    expect(html).toContain('ov-card');
    expect(html).not.toContain('style=');
  });
});

/* ===== renderBackup ===== */
describe('renderBackup', () => {
  it('renders cards with weatherItems', () => {
    const html = renderBackup({
      cards: [
        {
          title: '雨天備案',
          desc: '室內景點',
          weatherItems: ['AEON Mall', '美麗海水族館'],
          color: '#e3f2fd',
        },
      ],
    });
    expect(html).toContain('ov-card');
    expect(html).toContain('雨天備案');
    expect(html).toContain('weather-list');
    expect(html).toContain('AEON Mall');
  });

  it('renders flat items fallback', () => {
    const html = renderBackup({
      items: ['方案 A', '方案 B'],
    });
    expect(html).toContain('notes-list');
    expect(html).toContain('方案 A');
  });
});

/* ===== renderEmergency ===== */
describe('renderEmergency', () => {
  it('renders contacts with tel links', () => {
    const html = renderEmergency({
      cards: [
        {
          title: '緊急電話',
          contacts: [
            { label: '警察', phone: '110', note: '24 小時' },
          ],
          color: '#ffebee',
        },
      ],
    });
    expect(html).toContain('ov-card');
    expect(html).toContain('緊急電話');
    expect(html).toContain('tel:110');
    expect(html).toContain('警察');
    expect(html).toContain('24 小時');
  });

  it('renders contacts with custom URL', () => {
    const html = renderEmergency({
      cards: [
        {
          title: '大使館',
          contacts: [
            { label: '台北辦事處', url: 'https://embassy.example.com' },
          ],
        },
      ],
    });
    expect(html).toContain('href="https://embassy.example.com"');
  });

  it('renders address and notes', () => {
    const html = renderEmergency({
      cards: [
        {
          title: '醫院',
          address: '那霸市 1-2-3',
          notes: ['24 小時急診'],
        },
      ],
    });
    expect(html).toContain('svg-icon');
    expect(html).toContain('那霸市 1-2-3');
    expect(html).toContain('24 小時急診');
  });

  it('returns empty for no cards', () => {
    expect(renderEmergency({})).toBe('');
  });
});

/* ===== renderSuggestions ===== */
describe('renderSuggestions', () => {
  it('renders cards with priority classes', () => {
    const html = renderSuggestions({
      cards: [
        { title: '高優先', priority: 'high', items: ['建議 1'] },
        { title: '中優先', priority: 'medium', items: ['建議 2'] },
        { title: '低優先', priority: 'low', items: ['建議 3'] },
      ],
    });
    expect(html).toContain('suggestion-card');
    expect(html).toContain('sg-priority-high');
    expect(html).toContain('sg-priority-medium');
    expect(html).toContain('sg-priority-low');
    expect(html).toContain('高優先');
    expect(html).toContain('建議 1');
  });

  it('returns empty for no cards', () => {
    expect(renderSuggestions({})).toBe('');
  });

  it('returns empty for empty cards array', () => {
    expect(renderSuggestions({ cards: [] })).toBe('');
  });

  it('renders multiple items per card', () => {
    const html = renderSuggestions({
      cards: [{ title: 'Tips', items: ['A', 'B', 'C'] }],
    });
    const matches = html.match(/<p>/g);
    expect(matches).toHaveLength(3);
  });

  it('escapes HTML in items', () => {
    const html = renderSuggestions({
      cards: [{ title: 'XSS', priority: 'high', items: ['<img onerror=alert(1)>'] }],
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('checklist cards have no inline style', () => {
    const html = renderChecklist({
      cards: [{ title: 'T', items: ['A'], color: 'red;} body{display:none' }],
    });
    expect(html).toContain('ov-card');
    expect(html).not.toContain('style=');
  });
});

/* ===== TRANSPORT_TYPES ===== */
describe('TRANSPORT_TYPES', () => {
  it('contains car, train, walk', () => {
    expect(TRANSPORT_TYPES['car']).toEqual({ label: '開車', icon: 'car' });
    expect(TRANSPORT_TYPES['train']).toEqual({ label: '電車', icon: 'train' });
    expect(TRANSPORT_TYPES['walking']).toEqual({ label: '步行', icon: 'walking' });
  });
});

/* ===== formatMinutes ===== */
describe('formatMinutes', () => {
  it('formats minutes only', () => {
    expect(formatMinutes(45)).toBe('45 分鐘');
  });

  it('formats hours only', () => {
    expect(formatMinutes(120)).toBe('2 小時');
  });

  it('formats hours and minutes', () => {
    expect(formatMinutes(90)).toBe('1 小時 30 分鐘');
  });

  it('handles zero', () => {
    expect(formatMinutes(0)).toBe('0 分鐘');
  });
});

/* ===== calcDrivingStats ===== */
describe('calcDrivingStats', () => {
  it('returns null for empty timeline', () => {
    expect(calcDrivingStats(null)).toBeNull();
    expect(calcDrivingStats([])).toBeNull();
  });

  it('parses car travel', () => {
    const result = calcDrivingStats([
      { travel: { type: 'car', text: '約30分鐘' } },
      { travel: { type: 'car', text: '約45分鐘' } },
    ]);
    expect(result.totalMinutes).toBe(75);
    expect(result.drivingMinutes).toBe(75);
    expect(result.byType['car'].totalMinutes).toBe(75);
    expect(result.byType['car'].segments).toHaveLength(2);
  });

  it('parses multiple transport types', () => {
    const result = calcDrivingStats([
      { travel: { type: 'car', text: '約30分鐘' } },
      { travel: { type: 'train', text: '電車約15分鐘' } },
      { travel: { type: 'walking', text: '步行約10分鐘' } },
    ]);
    expect(result.totalMinutes).toBe(55);
    expect(result.drivingMinutes).toBe(30);
    expect(result.byType['car'].totalMinutes).toBe(30);
    expect(result.byType['train'].totalMinutes).toBe(15);
    expect(result.byType['walking'].totalMinutes).toBe(10);
  });

  it('ignores non-transport type', () => {
    const result = calcDrivingStats([
      { travel: { type: 'flight', text: '飛行約120分鐘' } },
    ]);
    expect(result).toBeNull();
  });

  it('ignores events without travel', () => {
    const result = calcDrivingStats([
      { title: '景點', time: '09:00' },
      { travel: { type: 'car', text: '約20分鐘' } },
    ]);
    expect(result.totalMinutes).toBe(20);
  });

  it('provides backward-compat segments (driving only)', () => {
    const result = calcDrivingStats([
      { travel: { type: 'car', text: '約30分鐘' } },
      { travel: { type: 'train', text: '電車約15分鐘' } },
    ]);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].minutes).toBe(30);
  });
});

/* ===== renderDrivingStats ===== */
describe('renderDrivingStats', () => {
  it('returns empty for null', () => {
    expect(renderDrivingStats(null)).toBe('');
  });

  it('renders collapsible structure', () => {
    const stats = calcDrivingStats([
      { travel: { type: 'car', text: '約30分鐘' } },
    ]);
    const html = renderDrivingStats(stats);
    expect(html).toContain('col-row');
    expect(html).toContain('col-detail');
    expect(html).toContain('當日交通');
    expect(html).toContain('30 分鐘');
  });

  it('shows warning badge when driving > 120 min', () => {
    const stats = calcDrivingStats([
      { travel: { type: 'car', text: '約80分鐘' } },
      { travel: { type: 'car', text: '約50分鐘' } },
    ]);
    const html = renderDrivingStats(stats);
    expect(html).toContain('driving-stats-warning');
    expect(html).toContain('超過 2 小時');
  });

  it('renders transport type groups', () => {
    const stats = calcDrivingStats([
      { travel: { type: 'car', text: '約30分鐘' } },
      { travel: { type: 'train', text: '電車約15分鐘' } },
    ]);
    const html = renderDrivingStats(stats);
    expect(html).toContain('transport-type-group');
    expect(html).toContain('開車');
    expect(html).toContain('電車');
  });
});

/* ===== calcTripDrivingStats ===== */
describe('calcTripDrivingStats', () => {
  it('returns null for empty days', () => {
    expect(calcTripDrivingStats(null)).toBeNull();
    expect(calcTripDrivingStats([])).toBeNull();
  });

  it('aggregates across days and types', () => {
    const days = [
      { id: 1, date: '2026-05-01', content: { timeline: [
        { travel: { type: 'car', text: '約30分鐘' } },
        { travel: { type: 'train', text: '電車約15分鐘' } },
      ] } },
      { id: 2, date: '2026-05-02', content: { timeline: [
        { travel: { type: 'car', text: '約60分鐘' } },
      ] } },
    ];
    const result = calcTripDrivingStats(days);
    expect(result.grandTotal).toBe(105);
    expect(result.grandByType['car'].totalMinutes).toBe(90);
    expect(result.grandByType['train'].totalMinutes).toBe(15);
    expect(result.days).toHaveLength(2);
  });

  it('skips days without transport', () => {
    const days = [
      { id: 1, date: '2026-05-01', content: { timeline: [{ title: '景點' }] } },
      { id: 2, date: '2026-05-02', content: { timeline: [
        { travel: { type: 'car', text: '約20分鐘' } },
      ] } },
    ];
    const result = calcTripDrivingStats(days);
    expect(result.days).toHaveLength(1);
    expect(result.grandTotal).toBe(20);
  });
});

/* ===== renderTripDrivingStats ===== */
describe('renderTripDrivingStats', () => {
  it('returns empty for null', () => {
    expect(renderTripDrivingStats(null)).toBe('');
  });

  it('renders nested structure with summary and per-day breakdown', () => {
    const days = [
      { id: 1, date: '2026-05-01', content: { timeline: [
        { travel: { type: 'car', text: '約30分鐘' } },
        { travel: { type: 'train', text: '電車約15分鐘' } },
      ] } },
    ];
    const tripStats = calcTripDrivingStats(days);
    const html = renderTripDrivingStats(tripStats);
    expect(html).toContain('driving-summary');
    expect(html).toContain('全旅程交通統計');
    expect(html).toContain('transport-type-summary');
    expect(html).toContain('driving-summary-day');
    // Per-day breakdown header
    expect(html).toContain('driving-summary-day-header');
  });

  it('shows warning for days with >120 min driving', () => {
    const days = [
      { id: 1, date: '2026-05-01', content: { timeline: [
        { travel: { type: 'car', text: '約150分鐘' } },
      ] } },
    ];
    const tripStats = calcTripDrivingStats(days);
    const html = renderTripDrivingStats(tripStats);
    expect(html).toContain('driving-stats-warning');
    expect(html).toContain('超過 2 小時');
  });
});

/* ===== renderCountdown ===== */
describe('renderCountdown', () => {
  it('returns empty for null/empty dates', () => {
    expect(renderCountdown(null)).toBe('');
    expect(renderCountdown([])).toBe('');
  });

  it('shows days until departure for future trips', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const dateStr = futureDate.toISOString().split('T')[0];
    const html = renderCountdown([dateStr]);
    expect(html).toContain('countdown-card');
    expect(html).toContain('天後出發');
    expect(html).toContain(dateStr);
  });

  it('shows trip ended for past trips', () => {
    const html = renderCountdown(['2020-01-01', '2020-01-05']);
    expect(html).toContain('旅程已結束');
  });

  it('shows traveling status for current trips', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const html = renderCountdown([
      yesterday.toISOString().split('T')[0],
      tomorrow.toISOString().split('T')[0],
    ]);
    expect(html).toContain('旅行進行中');
    expect(html).toContain('Day');
  });
});

/* ===== renderTripStatsCard ===== */
describe('renderTripStatsCard', () => {
  it('renders day count and spot count', () => {
    const data = {
      days: [
        { id: 1, content: { timeline: [{ title: 'A' }, { title: 'B' }] } },
        { id: 2, content: { timeline: [{ title: 'C' }] } },
      ],
    };
    const html = renderTripStatsCard(data);
    expect(html).toContain('stats-card');
    expect(html).toContain('2 天');
    expect(html).toContain('3 個');
  });

  it('renders transport summary', () => {
    const data = {
      days: [
        { id: 1, date: '2026-05-01', content: { timeline: [
          { travel: { type: 'car', text: '約30分鐘' } },
        ] } },
      ],
    };
    const html = renderTripStatsCard(data);
    expect(html).toContain('開車');
    expect(html).toContain('30 分鐘');
  });

  it('renders budget', () => {
    const data = {
      days: [
        { id: 1, content: { timeline: [], budget: { items: [{ label: '午餐', amount: 1500 }], currency: 'JPY' } } },
        { id: 2, content: { timeline: [], budget: { items: [{ label: '晚餐', amount: 3000 }], currency: 'JPY' } } },
      ],
    };
    const html = renderTripStatsCard(data);
    expect(html).toContain('預估預算');
    expect(html).toContain('JPY');
    expect(html).toContain('4,500');
  });

  it('handles days without content', () => {
    const data = { days: [{ id: 1 }, { id: 2 }] };
    const html = renderTripStatsCard(data);
    expect(html).toContain('2 天');
    expect(html).toContain('0 個');
  });
});

/* ===== renderSuggestionSummaryCard ===== */
describe('renderSuggestionSummaryCard', () => {
  it('renders summary card with correct counts', () => {
    const suggestions = {
      content: {
        cards: [
          { priority: 'high', items: ['A', 'B'] },
          { priority: 'medium', items: ['C', 'D', 'E'] },
          { priority: 'low', items: ['F'] },
        ],
      },
    };
    const html = renderSuggestionSummaryCard(suggestions);
    expect(html).toContain('建議摘要');
    expect(html).toContain('高優先：2 項');
    expect(html).toContain('中優先：3 項');
    expect(html).toContain('低優先：1 項');
    expect(html).toContain('sg-priority-high');
    expect(html).toContain('sg-priority-medium');
    expect(html).toContain('sg-priority-low');
  });

  it('shows 0 for empty items array', () => {
    const suggestions = {
      content: {
        cards: [
          { priority: 'high', items: [] },
          { priority: 'medium', items: ['A'] },
          { priority: 'low', items: [] },
        ],
      },
    };
    const html = renderSuggestionSummaryCard(suggestions);
    expect(html).toContain('高優先：0 項');
    expect(html).toContain('中優先：1 項');
    expect(html).toContain('低優先：0 項');
  });

  it('returns empty string when suggestions is null', () => {
    expect(renderSuggestionSummaryCard(null)).toBe('');
  });

  it('returns empty string when suggestions has no content', () => {
    expect(renderSuggestionSummaryCard({})).toBe('');
  });

  it('returns empty string when suggestions.content has no cards', () => {
    expect(renderSuggestionSummaryCard({ content: {} })).toBe('');
  });
});

/* ===== renderCountdown + renderTripStatsCard output (for bottom sheet) ===== */
describe('renderInfoPanel content functions', () => {
  const sampleData = {
    autoScrollDates: ['2099-01-01', '2099-01-05'],
    days: [
      { id: 1, date: '2099-01-01', content: { timeline: [{ time: '10:00', title: 'A', travel: { type: 'car', text: '30 分鐘' } }] } },
      { id: 2, date: '2099-01-02', content: {} },
    ],
    suggestions: null,
  };

  it('renderCountdown returns countdown card HTML', () => {
    const html = renderCountdown(sampleData.autoScrollDates);
    expect(html).toContain('countdown-card');
    expect(html).toContain('天後出發');
  });

  it('renderTripStatsCard returns stats card HTML', () => {
    const html = renderTripStatsCard(sampleData);
    expect(html).toContain('stats-card');
    expect(html).toContain('行程統計');
    expect(html).toContain('2 天');
  });
});
