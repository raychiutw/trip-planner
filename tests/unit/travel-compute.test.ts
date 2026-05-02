/**
 * travel/compute unit tests — Haversine math + ORS-vs-fallback decision.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeTravel, haversineEstimate } from '../../src/server/travel/compute';

describe('haversineEstimate', () => {
  it('Tokyo Station → Shinjuku Station ≈ 6 km × 1.3 road factor', () => {
    const result = haversineEstimate({
      mode: 'driving',
      origin: { lat: 35.6812, lng: 139.7671 }, // Tokyo Station
      dest: { lat: 35.6896, lng: 139.7006 },   // Shinjuku Station
    });
    // Straight-line ≈ 6.1 km; × 1.3 ≈ 7.9 km
    expect(result.distance_m).toBeGreaterThan(7000);
    expect(result.distance_m).toBeLessThan(9000);
    expect(result.source).toBe('haversine');
  });

  it('walking mode uses lower nominal speed (5 km/h)', () => {
    const driving = haversineEstimate({
      mode: 'driving',
      origin: { lat: 35.0, lng: 139.0 },
      dest: { lat: 35.01, lng: 139.01 },
    });
    const walking = haversineEstimate({
      mode: 'walking',
      origin: { lat: 35.0, lng: 139.0 },
      dest: { lat: 35.01, lng: 139.01 },
    });
    // Same distance, walking takes ~10x longer (50 / 5)
    expect(walking.duration_s).toBeGreaterThan(driving.duration_s * 5);
    expect(walking.distance_m).toBe(driving.distance_m);
  });

  it('transit mode uses 30 km/h nominal', () => {
    const driving = haversineEstimate({
      mode: 'driving',
      origin: { lat: 35.0, lng: 139.0 },
      dest: { lat: 35.05, lng: 139.05 },
    });
    const transit = haversineEstimate({
      mode: 'transit',
      origin: { lat: 35.0, lng: 139.0 },
      dest: { lat: 35.05, lng: 139.05 },
    });
    // Transit is ~5/3 slower than driving (50 vs 30)
    expect(transit.duration_s).toBeGreaterThan(driving.duration_s);
    expect(transit.duration_s).toBeLessThan(driving.duration_s * 2);
  });

  it('zero distance for identical points', () => {
    const result = haversineEstimate({
      mode: 'driving',
      origin: { lat: 35.0, lng: 139.0 },
      dest: { lat: 35.0, lng: 139.0 },
    });
    expect(result.distance_m).toBe(0);
    expect(result.duration_s).toBe(0);
  });
});

describe('computeTravel', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const PARIS = { lat: 48.8566, lng: 2.3522 };
  const LONDON = { lat: 51.5074, lng: -0.1278 };

  it('uses ORS when key provided + ORS responds OK', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        routes: [{ summary: { distance: 459123.4, duration: 17280.5 } }],
      }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.fetch = fetchMock as any;

    const result = await computeTravel({
      orsApiKey: 'test-key',
      mode: 'driving',
      origin: PARIS,
      dest: LONDON,
    });

    expect(result.source).toBe('ors');
    expect(result.distance_m).toBe(459123);   // rounded
    expect(result.duration_s).toBe(17281);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('falls back to Haversine when ORS apiKey missing', async () => {
    const fetchMock = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.fetch = fetchMock as any;

    const result = await computeTravel({
      mode: 'driving',
      origin: PARIS,
      dest: LONDON,
    });

    expect(result.source).toBe('haversine');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.distance_m).toBeGreaterThan(300_000);  // ~344km × 1.3
  });

  it('falls back to Haversine when ORS fetch throws', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as any;

    const result = await computeTravel({
      orsApiKey: 'test-key',
      mode: 'driving',
      origin: PARIS,
      dest: LONDON,
    });

    expect(result.source).toBe('haversine');
  });

  it('falls back to Haversine on ORS 404 (no route)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    }) as any;

    const result = await computeTravel({
      orsApiKey: 'test-key',
      mode: 'driving',
      origin: PARIS,
      dest: LONDON,
    });

    expect(result.source).toBe('haversine');
  });

  it('transit mode skips ORS (free tier no transit) → Haversine 30 km/h', async () => {
    const fetchMock = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.fetch = fetchMock as any;

    const result = await computeTravel({
      orsApiKey: 'test-key',
      mode: 'transit',
      origin: PARIS,
      dest: LONDON,
    });

    expect(result.source).toBe('haversine');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns zeroed result when origin missing valid coords', async () => {
    const result = await computeTravel({
      orsApiKey: 'test-key',
      mode: 'driving',
      origin: { lat: NaN, lng: NaN },
      dest: LONDON,
    });
    expect(result.distance_m).toBe(0);
    expect(result.duration_s).toBe(0);
  });

  it('correct ORS request body shape (lng/lat order)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        routes: [{ summary: { distance: 100, duration: 30 } }],
      }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.fetch = fetchMock as any;

    await computeTravel({
      orsApiKey: 'k',
      mode: 'driving',
      origin: { lat: 35.0, lng: 139.0 },
      dest: { lat: 35.1, lng: 139.1 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [url, init] = fetchMock.mock.calls[0] as [string, any];
    expect(url).toBe('https://api.openrouteservice.org/v2/directions/driving-car');
    const body = JSON.parse(init.body);
    // ORS expects [lng, lat] order
    expect(body.coordinates).toEqual([[139.0, 35.0], [139.1, 35.1]]);
    expect(init.headers.Authorization).toBe('k');
  });
});
