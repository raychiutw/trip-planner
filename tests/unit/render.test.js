import { describe, it, expect } from 'vitest';

const {
  renderMapLinks,
  renderNavLinks,
  renderRestaurant,
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
  safeColor,
  escHtml,
  APPLE_SVG,
} = require('../../app.js');

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
      emoji: '🍜',
      desc: '手工麵條',
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
    expect(html).toContain('🅿️');
    expect(html).toContain('第一停車場');
    expect(html).toContain('¥500/日');
  });

  it('renders souvenir type', () => {
    const html = renderInfoBox({
      type: 'souvenir',
      title: '伴手禮推薦',
      items: [
        { name: '紅芋塔', emoji: '🍠', note: '必買' },
      ],
    });
    expect(html).toContain('info-box souvenir');
    expect(html).toContain('紅芋塔');
    expect(html).toContain('🍠');
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
    expect(html).toContain('2選一');
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
    expect(html).toContain('clickable');
  });

  it('renders event without body as non-clickable', () => {
    const html = renderTimelineEvent({ time: '10:00', title: '路過' });
    expect(html).not.toContain('clickable');
    expect(html).not.toContain('tl-body');
  });

  it('renders transit info', () => {
    const html = renderTimelineEvent({
      time: '10:00',
      title: 'A',
      transit: { text: '車程 30 分', emoji: '🚗' },
    });
    expect(html).toContain('tl-transit');
    expect(html).toContain('車程 30 分');
  });

  it('renders transit as plain string', () => {
    const html = renderTimelineEvent({
      time: '10:00',
      title: 'A',
      transit: '步行 5 分',
    });
    expect(html).toContain('步行 5 分');
  });

  it('renders emoji prefix', () => {
    const html = renderTimelineEvent({ time: '10:00', title: 'Test', emoji: '🏯' });
    expect(html).toContain('🏯');
  });

  it('renders note field', () => {
    const html = renderTimelineEvent({ time: '10:00', title: 'Test', note: '小提醒' });
    expect(html).toContain('小提醒');
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
    expect(html).toContain('🏨');
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

  it('renders subs with location', () => {
    const html = renderHotel({
      name: 'Hotel',
      subs: [
        { label: '停車場', text: '免費', location: { name: '飯店停車場' } },
      ],
    });
    expect(html).toContain('hotel-sub');
    expect(html).toContain('停車場');
    expect(html).toContain('maps.google.com');
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
    expect(html).toContain('💰');
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

  it('uses safeColor for card background', () => {
    const html = renderChecklist({
      cards: [{ title: 'T', items: ['A'], color: 'red;} body{display:none' }],
    });
    expect(html).toContain('var(--blue-light)');
    expect(html).not.toContain('display:none');
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
    expect(html).toContain('📍');
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
    expect(html).toContain('suggestion-card high');
    expect(html).toContain('suggestion-card medium');
    expect(html).toContain('suggestion-card low');
    expect(html).toContain('高優先');
    expect(html).toContain('建議 1');
  });

  it('renders card without priority', () => {
    const html = renderSuggestions({
      cards: [{ title: 'General', items: ['Item'] }],
    });
    expect(html).toContain('suggestion-card');
    expect(html).not.toContain('suggestion-card high');
    expect(html).not.toContain('suggestion-card medium');
    expect(html).not.toContain('suggestion-card low');
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

  it('blocks priority class injection', () => {
    const html = renderSuggestions({
      cards: [{ title: 'Hack', priority: 'high onclick=alert(1)', items: ['test'] }],
    });
    expect(html).toContain('class="suggestion-card"');
    expect(html).not.toContain('onclick');
  });

  it('falls back color to default for CSS injection in checklist', () => {
    const html = renderChecklist({
      cards: [{ title: 'T', items: ['A'], color: 'red;} body{display:none' }],
    });
    expect(html).toContain('var(--blue-light)');
  });
});
