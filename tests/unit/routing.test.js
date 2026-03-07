import { describe, it, expect } from 'vitest';

const { fileToSlug, slugToFile } = require('../../js/app.js');

/* ===== fileToSlug ===== */
describe('fileToSlug', () => {
  it('extracts slug from data/dist path', () => {
    expect(fileToSlug('data/dist/okinawa-trip-2026-Ray/')).toBe('okinawa-trip-2026-Ray');
  });

  it('returns null for non-matching path', () => {
    expect(fileToSlug('other/file.txt')).toBeNull();
  });

  it('returns null for root file', () => {
    expect(fileToSlug('app.js')).toBeNull();
  });

  it('returns null for old data/trips path', () => {
    expect(fileToSlug('data/trips/my-trip.json')).toBeNull();
  });

  it('returns null for data/ path without dist/', () => {
    expect(fileToSlug('data/my-trip.json')).toBeNull();
  });
});

/* ===== slugToFile ===== */
describe('slugToFile', () => {
  it('converts slug to data/dist path', () => {
    expect(slugToFile('okinawa-trip-2026-Ray')).toBe('data/dist/okinawa-trip-2026-Ray/');
  });

  it('works with simple slug', () => {
    expect(slugToFile('test')).toBe('data/dist/test/');
  });
});
