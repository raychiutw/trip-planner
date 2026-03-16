import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');

describe('dist/trips.json registry', () => {
  let trips;

  it('parses as valid JSON', () => {
    const raw = readFileSync(resolve(ROOT, 'data/dist/trips.json'), 'utf8');
    trips = JSON.parse(raw);
    expect(trips).toBeDefined();
  });

  it('is a non-empty array', () => {
    expect(Array.isArray(trips)).toBe(true);
    expect(trips.length).toBeGreaterThan(0);
  });

  it('each entry has tripId, name, dates, owner, and published', () => {
    trips.forEach((entry) => {
      expect(entry.tripId, 'missing tripId').toBeTruthy();
      expect(entry.name, 'missing name').toBeTruthy();
      expect(typeof entry.dates, 'dates must be string').toBe('string');
      expect(entry.owner, 'missing owner').toBeTruthy();
      expect(typeof entry.published, 'published must be boolean').toBe('boolean');
    });
  });

  it('each tripId points to an existing dist directory with meta.json', () => {
    trips.forEach((entry) => {
      const metaPath = resolve(ROOT, 'data/dist', entry.tripId, 'meta.json');
      expect(existsSync(metaPath), `meta.json not found for tripId: ${entry.tripId}`).toBe(true);
    });
  });

  it('each dist directory meta.json is valid JSON', () => {
    trips.forEach((entry) => {
      const metaPath = resolve(ROOT, 'data/dist', entry.tripId, 'meta.json');
      const raw = readFileSync(metaPath, 'utf8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  });
});
