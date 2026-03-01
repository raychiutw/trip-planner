import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const { validateTripData } = require('../../app.js');

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

    it('passes validateTripData with zero errors and zero warnings', () => {
      const result = validateTripData(data);
      expect(result.errors, 'validation errors: ' + result.errors.join('; ')).toEqual([]);
      expect(result.warnings, 'validation warnings: ' + result.warnings.join('; ')).toEqual([]);
    });

    // --- Additional quality checks beyond validateTripData ---

    it('days have sequential IDs', () => {
      data.days.forEach((day, i) => {
        expect(Number(day.id)).toBe(i + 1);
      });
    });

    it('days have non-empty date strings', () => {
      data.days.forEach((day) => {
        expect(day.date).toBeTruthy();
        expect(typeof day.date).toBe('string');
      });
    });

    it('weather dates are ISO format', () => {
      data.weather.forEach((w) => {
        expect(w.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it('autoScrollDates are ISO format', () => {
      data.autoScrollDates.forEach((d) => {
        expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });
});
