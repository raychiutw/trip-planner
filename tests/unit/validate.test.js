import { describe, it, expect } from 'vitest';

const { validateDay, renderWarnings, validateTripData } = require('../../app.js');

/* ===== helper: minimal valid trip data ===== */
function validTrip(overrides) {
  const base = {
    meta: { title: '測試行程' },
    days: [{ id: 1, date: '2026-07-29' }],
    weather: [{ id: 'day1', date: '2026-07-29', locations: [{ lat: 26.21, lon: 127.68, start: '09:00', end: '18:00' }] }],
    autoScrollDates: ['2026-07-29'],
    footer: { title: '行程表', dates: '7/29' },
  };
  return Object.assign({}, base, overrides);
}

/* ===== validateTripData — error paths ===== */
describe('validateTripData — errors', () => {
  it('rejects null data', () => {
    const r = validateTripData(null);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('rejects missing meta', () => {
    const r = validateTripData(validTrip({ meta: undefined }));
    expect(r.errors).toContain('缺少 meta');
  });

  it('rejects meta without title', () => {
    const r = validateTripData(validTrip({ meta: {} }));
    expect(r.errors).toContain('meta 缺少 title');
  });

  it('rejects missing days', () => {
    const r = validateTripData(validTrip({ days: undefined }));
    expect(r.errors).toContain('缺少 days');
  });

  it('rejects days not array', () => {
    const r = validateTripData(validTrip({ days: 'oops' }));
    expect(r.errors).toContain('days 必須是陣列');
  });

  it('rejects empty days array', () => {
    const r = validateTripData(validTrip({ days: [] }));
    expect(r.errors).toContain('days 不得為空陣列');
  });

  it('rejects day without id', () => {
    const r = validateTripData(validTrip({ days: [{ date: '2026-07-29' }] }));
    expect(r.errors.some(e => e.includes('缺少 id'))).toBe(true);
  });

  it('rejects day without date', () => {
    const r = validateTripData(validTrip({ days: [{ id: 1 }] }));
    expect(r.errors.some(e => e.includes('缺少 date'))).toBe(true);
  });

  it('rejects missing/empty weather', () => {
    const r = validateTripData(validTrip({ weather: [] }));
    expect(r.errors.some(e => e.includes('weather'))).toBe(true);
  });

  it('rejects missing/empty autoScrollDates', () => {
    const r = validateTripData(validTrip({ autoScrollDates: [] }));
    expect(r.errors.some(e => e.includes('autoScrollDates'))).toBe(true);
  });

  it('rejects days not starting from Day 1', () => {
    const r = validateTripData(validTrip({ days: [{ id: 3, date: '2026-07-31' }] }));
    expect(r.errors.some(e => e.includes('Day 1'))).toBe(true);
  });

  it('rejects missing footer', () => {
    const r = validateTripData(validTrip({ footer: undefined }));
    expect(r.errors).toContain('缺少 footer');
  });

  it('rejects footer without title', () => {
    const r = validateTripData(validTrip({ footer: { dates: '7/29' } }));
    expect(r.errors).toContain('footer 缺少 title');
  });

  it('rejects footer without dates', () => {
    const r = validateTripData(validTrip({ footer: { title: 'X' } }));
    expect(r.errors).toContain('footer 缺少 dates');
  });
});

/* ===== validateTripData — valid path ===== */
describe('validateTripData — valid', () => {
  it('returns zero errors and zero warnings for valid data', () => {
    const r = validateTripData(validTrip());
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});

/* ===== validateTripData — warning paths ===== */
describe('validateTripData — warnings', () => {
  it('warns on unsafe URL (javascript:)', () => {
    const d = validTrip();
    d.days[0].content = { timeline: [{ titleUrl: 'javascript:alert(1)' }] };
    const r = validateTripData(d);
    expect(r.errors).toEqual([]);
    expect(r.warnings.some(w => w.includes('不安全的 URL'))).toBe(true);
  });

  it('warns on googleQuery with wrong prefix', () => {
    const d = validTrip();
    d.days[0].content = { timeline: [{ googleQuery: 'https://evil.com/maps' }] };
    const r = validateTripData(d);
    expect(r.warnings.some(w => w.includes('Google Maps URL'))).toBe(true);
  });

  it('warns on appleQuery with wrong prefix', () => {
    const d = validTrip();
    d.days[0].content = { timeline: [{ appleQuery: 'https://evil.com/maps' }] };
    const r = validateTripData(d);
    expect(r.warnings.some(w => w.includes('Apple Maps URL'))).toBe(true);
  });

  it('allows tel: URLs without warning', () => {
    const d = validTrip();
    d.days[0].content = { timeline: [{ url: 'tel:+81-98-123-4567' }] };
    const r = validateTripData(d);
    expect(r.warnings.filter(w => w.includes('不安全的 URL'))).toEqual([]);
  });

  it('warns on invalid mapcode format', () => {
    const d = validTrip();
    d.days[0].content = { timeline: [{ mapcode: 'ABCD' }] };
    const r = validateTripData(d);
    expect(r.warnings.some(w => w.includes('mapcode') && w.includes('格式不符'))).toBe(true);
  });

  it('accepts valid mapcode (2-digit prefix)', () => {
    const d = validTrip();
    d.days[0].content = { timeline: [{ mapcode: '33 530 406*00' }] };
    const r = validateTripData(d);
    expect(r.warnings.filter(w => w.includes('mapcode'))).toEqual([]);
  });

  it('accepts valid mapcode (4-digit prefix)', () => {
    const d = validTrip();
    d.days[0].content = { timeline: [{ mapcode: '1234 530 406*00' }] };
    const r = validateTripData(d);
    expect(r.warnings.filter(w => w.includes('mapcode'))).toEqual([]);
  });

  it('warns on non-number weather lat', () => {
    const d = validTrip({ weather: [{ id: 'day1', date: '2026-07-29', locations: [{ lat: '26.21', lon: 127.68, start: '09:00', end: '18:00' }] }] });
    const r = validateTripData(d);
    expect(r.warnings.some(w => w.includes('lat') && w.includes('number'))).toBe(true);
  });

  it('warns on invalid suggestions priority', () => {
    const d = validTrip();
    d.suggestions = { content: { cards: [{ priority: 'critical', title: 'X', items: [] }] } };
    const r = validateTripData(d);
    expect(r.warnings.some(w => w.includes('priority') && w.includes('high/medium/low'))).toBe(true);
  });

  it('escapes HTML in warning val (XSS prevention)', () => {
    const d = validTrip();
    d.days[0].content = { timeline: [{ titleUrl: '<script>alert(1)</script>' }] };
    const r = validateTripData(d);
    const urlWarning = r.warnings.find(w => w.includes('不安全的 URL'));
    expect(urlWarning).toBeDefined();
    expect(urlWarning).toContain('&lt;script&gt;');
    expect(urlWarning).not.toContain('<script>');
  });

  it('warns on unsafe blogUrl', () => {
    const d = validTrip();
    d.days[0].content = { timeline: [{ blogUrl: 'ftp://evil.com/blog' }] };
    const r = validateTripData(d);
    expect(r.warnings.some(w => w.includes('不安全的 URL') && w.includes('blogUrl'))).toBe(true);
  });

  it('warns on unsafe reservationUrl', () => {
    const d = validTrip();
    d.days[0].content = { timeline: [{ reservationUrl: 'data:text/html,<h1>xss</h1>' }] };
    const r = validateTripData(d);
    expect(r.warnings.some(w => w.includes('不安全的 URL') && w.includes('reservationUrl'))).toBe(true);
  });

  it('warns on non-number weather lon', () => {
    const d = validTrip({ weather: [{ id: 'day1', date: '2026-07-29', locations: [{ lat: 26.21, lon: '127.68', start: '09:00', end: '18:00' }] }] });
    const r = validateTripData(d);
    expect(r.warnings.some(w => w.includes('lon') && w.includes('number'))).toBe(true);
  });

  it('traverses deeply nested restaurant.location.googleQuery', () => {
    const d = validTrip();
    d.days[0].content = {
      timeline: [{
        infoBoxes: [{
          type: 'restaurants',
          restaurants: [{
            name: 'Test',
            location: { googleQuery: 'https://evil.com/maps' }
          }]
        }]
      }]
    };
    const r = validateTripData(d);
    expect(r.warnings.some(w => w.includes('Google Maps URL'))).toBe(true);
  });
});

/* ===== validateDay ===== */
describe('validateDay', () => {
  it('returns empty array for null day', () => {
    expect(validateDay(null)).toEqual([]);
  });

  it('returns empty array for day without timeline', () => {
    expect(validateDay({ content: {} })).toEqual([]);
  });

  it('returns empty when no time conflict', () => {
    const day = {
      content: {
        timeline: [
          {
            time: '12:00–13:30',
            title: '午餐',
            infoBoxes: [
              {
                type: 'restaurants',
                restaurants: [{ name: 'A', hours: '11:00–21:00' }],
              },
            ],
          },
        ],
      },
    };
    expect(validateDay(day)).toEqual([]);
  });

  it('detects restaurant opening later than event time', () => {
    const day = {
      content: {
        timeline: [
          {
            time: '09:00-10:30',
            title: '早餐',
            infoBoxes: [
              {
                type: 'restaurants',
                restaurants: [{ name: '午餐店', hours: '11:00–21:00' }],
              },
            ],
          },
        ],
      },
    };
    const warnings = validateDay(day);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('早餐');
    expect(warnings[0]).toContain('午餐店');
  });

  it('detects infoBox hours conflict', () => {
    const day = {
      content: {
        timeline: [
          {
            time: '08:00-09:00',
            title: '景點',
            infoBoxes: [
              { type: 'note', hours: '10:00–18:00' },
            ],
          },
        ],
      },
    };
    const warnings = validateDay(day);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('returns empty for events without infoBoxes', () => {
    const day = {
      content: {
        timeline: [
          { time: '09:00', title: 'Test' },
        ],
      },
    };
    expect(validateDay(day)).toEqual([]);
  });
});

/* ===== renderWarnings ===== */
describe('renderWarnings', () => {
  it('returns empty string for empty array', () => {
    expect(renderWarnings([])).toBe('');
  });

  it('returns empty string for null', () => {
    expect(renderWarnings(null)).toBe('');
  });

  it('renders warning items', () => {
    const html = renderWarnings(['警告 1', '警告 2']);
    expect(html).toContain('trip-warnings');
    expect(html).toContain('⚠️');
    expect(html).toContain('警告 1');
    expect(html).toContain('警告 2');
    expect(html).toContain('<li>');
  });
});
