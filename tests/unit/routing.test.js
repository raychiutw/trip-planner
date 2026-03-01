import { describe, it, expect } from 'vitest';

const { fileToSlug, slugToFile } = require('../../app.js');

/* ===== fileToSlug ===== */
describe('fileToSlug', () => {
  it('extracts slug from data/trips path', () => {
    expect(fileToSlug('data/trips/okinawa-trip-2026-Ray.json')).toBe('okinawa-trip-2026-Ray');
  });

  it('returns null for non-matching path', () => {
    expect(fileToSlug('other/file.txt')).toBeNull();
  });

  it('returns null for root file', () => {
    expect(fileToSlug('app.js')).toBeNull();
  });

  it('handles nested slug name', () => {
    expect(fileToSlug('data/trips/my-trip.json')).toBe('my-trip');
  });

  it('returns null for old data/ path (without trips/)', () => {
    expect(fileToSlug('data/my-trip.json')).toBeNull();
  });
});

/* ===== slugToFile ===== */
describe('slugToFile', () => {
  it('converts slug to data/trips path', () => {
    expect(slugToFile('okinawa-trip-2026-Ray')).toBe('data/trips/okinawa-trip-2026-Ray.json');
  });

  it('works with simple slug', () => {
    expect(slugToFile('test')).toBe('data/trips/test.json');
  });
});
