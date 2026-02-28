import { describe, it, expect } from 'vitest';

const { validateDay, renderWarnings } = require('../../app.js');

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
