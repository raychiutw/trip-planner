import { describe, it, expect } from 'vitest';

/**
 * Tests for the trip list mapping logic in setting.js.
 *
 * setting.js uses an IIFE and doesn't export functions.
 * We test the mapping logic directly (inline extraction mirrors the code in setting.js ~lines 118-129).
 */

// Mirrors the mapping logic from setting.js init():
//   var mapped = trips.map(function(t) {
//     var footer = t.footer_json; ...
//     return { tripId: t.tripId, name, owner, dates, published }
//   })
function mapApiTrips(trips) {
  return trips.map(function(t) {
    var footer = t.footer_json;
    if (typeof footer === 'string') {
      try { footer = JSON.parse(footer); } catch (e) { footer = null; }
    }
    var dates = (footer && footer.dates) ? footer.dates : (t.title || '');
    return {
      tripId: t.tripId,
      name: t.name,
      owner: t.owner,
      dates: dates,
      published: t.published
    };
  });
}

/* ===== setting.js trip list mapping ===== */
describe('setting.js trip list mapping', () => {
  it('maps tripId field directly', () => {
    const trips = [{ tripId: 'okinawa-trip-2026-Ray', name: '沖繩', owner: 'Ray', published: 1 }];
    const result = mapApiTrips(trips);
    expect(result[0].tripId).toBe('okinawa-trip-2026-Ray');
  });

  it('reads t.tripId from API response', () => {
    const trips = [{ tripId: 'busan-trip-2026', name: '釜山', owner: 'Celia', published: 1 }];
    const result = mapApiTrips(trips);
    expect(result[0].tripId).toBe('busan-trip-2026');
  });

  it('uses t.tripId as canonical trip identifier', () => {
    const trips = [{ tripId: 'my-trip', name: 'Test', owner: 'T', published: 1 }];
    const result = mapApiTrips(trips);
    expect(result[0].tripId).toBe('my-trip');
  });

  it('extracts dates from footer_json.dates (string input)', () => {
    const trips = [{
      tripId: 'test-trip',
      name: 'Test',
      owner: 'Ray',
      footer_json: '{"dates":"2026-05-01 ~ 2026-05-05"}',
      published: 1
    }];
    const result = mapApiTrips(trips);
    expect(result[0].dates).toBe('2026-05-01 ~ 2026-05-05');
  });

  it('extracts dates from footer_json.dates (object input)', () => {
    const trips = [{
      tripId: 'test-trip',
      name: 'Test',
      owner: 'Ray',
      footer_json: { dates: '2026-05-01 ~ 2026-05-05' },
      published: 1
    }];
    const result = mapApiTrips(trips);
    expect(result[0].dates).toBe('2026-05-01 ~ 2026-05-05');
  });

  it('falls back to title when footer_json has no dates', () => {
    const trips = [{
      tripId: 'test-trip',
      name: 'Test',
      owner: 'Ray',
      title: '5/1~5/5',
      footer_json: '{"note":"無日期"}',
      published: 1
    }];
    const result = mapApiTrips(trips);
    expect(result[0].dates).toBe('5/1~5/5');
  });

  it('falls back to title when footer_json is malformed JSON', () => {
    const trips = [{
      tripId: 'test-trip',
      name: 'Test',
      owner: 'Ray',
      title: '5/1~5/5',
      footer_json: '{not valid json}',
      published: 1
    }];
    const result = mapApiTrips(trips);
    expect(result[0].dates).toBe('5/1~5/5');
  });

  it('returns empty string dates when footer_json and title both absent', () => {
    const trips = [{ tripId: 'test-trip', name: 'Test', owner: 'Ray', published: 1 }];
    const result = mapApiTrips(trips);
    expect(result[0].dates).toBe('');
  });

  it('maps name and owner correctly', () => {
    const trips = [{
      tripId: 'kyoto-trip-2026-MimiChu',
      name: '京都行程',
      owner: 'MimiChu',
      published: 1
    }];
    const result = mapApiTrips(trips);
    expect(result[0].name).toBe('京都行程');
    expect(result[0].owner).toBe('MimiChu');
  });

  it('maps published field', () => {
    const trips = [
      { tripId: 'trip-1', name: 'A', owner: 'X', published: 1 },
      { tripId: 'trip-2', name: 'B', owner: 'Y', published: 0 },
    ];
    const result = mapApiTrips(trips);
    expect(result[0].published).toBe(1);
    expect(result[1].published).toBe(0);
  });

  it('filters out unpublished trips correctly', () => {
    const trips = [
      { tripId: 'trip-1', name: 'A', owner: 'X', published: 1 },
      { tripId: 'trip-2', name: 'B', owner: 'Y', published: 0 },
      { tripId: 'trip-3', name: 'C', owner: 'Z', published: 1 },
    ];
    const mapped = mapApiTrips(trips);
    const published = mapped.filter(function(t) { return t.published !== 0; });
    expect(published).toHaveLength(2);
    expect(published.map(function(t) { return t.tripId; })).toEqual(['trip-1', 'trip-3']);
  });

  it('handles empty trips array', () => {
    const result = mapApiTrips([]);
    expect(result).toEqual([]);
  });

  it('handles multiple trips in order', () => {
    const trips = [
      { tripId: 'trip-a', name: 'A', owner: 'X', published: 1 },
      { tripId: 'trip-b', name: 'B', owner: 'Y', published: 1 },
    ];
    const result = mapApiTrips(trips);
    expect(result[0].tripId).toBe('trip-a');
    expect(result[1].tripId).toBe('trip-b');
  });
});
