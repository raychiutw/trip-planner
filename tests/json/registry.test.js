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

  it('each entry has slug, name, dates, and owner', () => {
    trips.forEach((entry) => {
      expect(entry.slug, 'missing slug').toBeTruthy();
      expect(entry.name, 'missing name').toBeTruthy();
      expect(typeof entry.dates, 'dates must be string').toBe('string');
      expect(entry.owner, 'missing owner').toBeTruthy();
    });
  });

  it('each slug points to an existing dist directory with meta.json', () => {
    trips.forEach((entry) => {
      const metaPath = resolve(ROOT, 'data/dist', entry.slug, 'meta.json');
      expect(existsSync(metaPath), `meta.json not found for slug: ${entry.slug}`).toBe(true);
    });
  });

  it('each dist directory meta.json is valid JSON', () => {
    trips.forEach((entry) => {
      const metaPath = resolve(ROOT, 'data/dist', entry.slug, 'meta.json');
      const raw = readFileSync(metaPath, 'utf8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  });
});
