import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const DATA_DIR = resolve(__dirname, '../../data');

const jsonFiles = [
  'okinawa-trip-2026-Ray.json',
  'okinawa-trip-2026-HuiYun.json',
];

jsonFiles.forEach((file) => {
  describe(`JSON schema: ${file}`, () => {
    let data;

    it('parses as valid JSON', () => {
      const raw = readFileSync(resolve(DATA_DIR, file), 'utf8');
      data = JSON.parse(raw);
      expect(data).toBeDefined();
    });

    it('has required top-level keys', () => {
      expect(data).toHaveProperty('meta');
      expect(data).toHaveProperty('footer');
      expect(data).toHaveProperty('days');
      expect(data).toHaveProperty('weather');
      expect(data).toHaveProperty('autoScrollDates');
    });

    it('meta has title', () => {
      expect(data.meta.title).toBeTruthy();
    });

    it('days is non-empty array', () => {
      expect(Array.isArray(data.days)).toBe(true);
      expect(data.days.length).toBeGreaterThan(0);
    });

    it('days have sequential IDs', () => {
      data.days.forEach((day, i) => {
        expect(Number(day.id)).toBe(i + 1);
      });
    });

    it('days have date fields', () => {
      data.days.forEach((day) => {
        expect(day.date).toBeTruthy();
        expect(typeof day.date).toBe('string');
      });
    });

    it('weather is non-empty array', () => {
      expect(Array.isArray(data.weather)).toBe(true);
      expect(data.weather.length).toBeGreaterThan(0);
    });

    it('weather locations have lat/lon/start/end', () => {
      data.weather.forEach((w) => {
        expect(w.id).toBeTruthy();
        expect(w.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Array.isArray(w.locations)).toBe(true);
        w.locations.forEach((loc) => {
          expect(typeof loc.lat).toBe('number');
          expect(typeof loc.lon).toBe('number');
          expect(loc.start).toBeDefined();
          expect(loc.end).toBeDefined();
        });
      });
    });

    it('autoScrollDates is non-empty array of date strings', () => {
      expect(Array.isArray(data.autoScrollDates)).toBe(true);
      expect(data.autoScrollDates.length).toBeGreaterThan(0);
      data.autoScrollDates.forEach((d) => {
        expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it('footer has title and dates', () => {
      expect(data.footer.title).toBeTruthy();
      expect(data.footer.dates).toBeTruthy();
    });

    it('suggestions cards have priority field', () => {
      if (data.suggestions && data.suggestions.content && data.suggestions.content.cards) {
        data.suggestions.content.cards.forEach((card) => {
          expect(['high', 'medium', 'low']).toContain(card.priority);
        });
      }
    });

    it('all URL fields are safe (https/http/tel only)', () => {
      const urlFields = ['titleUrl', 'url', 'googleQuery', 'appleQuery', 'reservationUrl'];

      function checkUrls(obj) {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
          obj.forEach(checkUrls);
          return;
        }
        for (const [key, val] of Object.entries(obj)) {
          if (urlFields.includes(key) && typeof val === 'string' && val.length > 0) {
            expect(val, `${key}: ${val}`).toMatch(/^(https?:|tel:)/i);
          }
          if (typeof val === 'object') checkUrls(val);
        }
      }

      checkUrls(data);
    });
  });
});
