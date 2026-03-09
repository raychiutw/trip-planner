import { describe, it, expect } from 'vitest';

const { fileToTripId, tripIdToFile } = require('../../js/app.js');

/* ===== fileToTripId ===== */
describe('fileToTripId', () => {
  it('extracts tripId from data/dist path', () => {
    expect(fileToTripId('data/dist/okinawa-trip-2026-Ray/')).toBe('okinawa-trip-2026-Ray');
  });

  it('returns null for non-matching path', () => {
    expect(fileToTripId('other/file.txt')).toBeNull();
  });

  it('returns null for root file', () => {
    expect(fileToTripId('app.js')).toBeNull();
  });

  it('returns null for old data/trips path', () => {
    expect(fileToTripId('data/trips/my-trip.json')).toBeNull();
  });

  it('returns null for data/ path without dist/', () => {
    expect(fileToTripId('data/my-trip.json')).toBeNull();
  });
});

/* ===== tripIdToFile ===== */
describe('tripIdToFile', () => {
  it('converts tripId to data/dist path', () => {
    expect(tripIdToFile('okinawa-trip-2026-Ray')).toBe('data/dist/okinawa-trip-2026-Ray/');
  });

  it('works with simple tripId', () => {
    expect(tripIdToFile('test')).toBe('data/dist/test/');
  });
});
