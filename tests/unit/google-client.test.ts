/**
 * google-client unit tests — verify request shape + response parsing for
 * each Places / Routes / Geocoding endpoint.
 *
 * Mocks global fetch; no real Google API calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  searchPlaces,
  getPlaceDetails,
  computeRoute,
  reverseGeocode,
} from '../../src/server/maps/google-client';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

function fetchOk(body: unknown): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body,
  });
}

function fetch4xx(status: number, body?: unknown): void {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => body || {},
  });
}

describe('searchPlaces', () => {
  it('POSTs to Places searchText with FieldMask + body', async () => {
    fetchOk({
      places: [{
        id: 'ChIJ_test',
        displayName: { text: '美麗海水族館' },
        formattedAddress: '沖縄県',
        location: { latitude: 26.69, longitude: 127.87 },
        primaryType: 'aquarium',
        rating: 4.5,
        businessStatus: 'OPERATIONAL',
        addressComponents: [
          { shortText: 'JP', longText: '日本', types: ['country'] },
        ],
      }],
    });
    const results = await searchPlaces('test-key', '美麗海水族館', 'jp', 5);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toContain('places.googleapis.com/v1/places:searchText');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Goog-Api-Key']).toBe('test-key');
    expect(init.headers['X-Goog-FieldMask']).toContain('places.id');
    const body = JSON.parse(init.body);
    expect(body.textQuery).toBe('美麗海水族館');
    expect(body.regionCode).toBe('jp');
    expect(body.maxResultCount).toBe(5);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      place_id: 'ChIJ_test',
      name: '美麗海水族館',
      lat: 26.69,
      lng: 127.87,
      country: 'JP',
      country_name: '日本',
      rating: 4.5,
      business_status: 'OPERATIONAL',
    });
  });

  it('empty places array → returns []', async () => {
    fetchOk({ places: [] });
    const results = await searchPlaces('k', 'q');
    expect(results).toEqual([]);
  });

  it('upstream 5xx → throws MAPS_UPSTREAM_FAILED', async () => {
    fetch4xx(503);
    try {
      await searchPlaces('k', 'q');
      throw new Error('should have thrown');
    } catch (err) {
      const e = err as { code: string; detail?: string };
      expect(e.code).toBe('MAPS_UPSTREAM_FAILED');
      expect(e.detail).toContain('Places searchText 503');
    }
  });

  it('maxCount clamped to [1, 20]', async () => {
    fetchOk({ places: [] });
    await searchPlaces('k', 'q', undefined, 999);
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.maxResultCount).toBe(20);
  });
});

describe('getPlaceDetails', () => {
  it('GET to /v1/places/:id with FieldMask', async () => {
    fetchOk({
      id: 'ChIJ_test',
      displayName: { text: '美麗海水族館' },
      formattedAddress: '沖縄県',
      location: { latitude: 26.69, longitude: 127.87 },
      rating: 4.5,
      businessStatus: 'OPERATIONAL',
      regularOpeningHours: { weekdayDescriptions: ['週一: 8:30-18:30'] },
      internationalPhoneNumber: '+81 980-48-3748',
    });
    const result = await getPlaceDetails('test-key', 'ChIJ_test');
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/v1/places/ChIJ_test');
    expect(init.method).toBe('GET');
    expect(init.headers['X-Goog-FieldMask']).toContain('rating');
    expect(result).toMatchObject({
      place_id: 'ChIJ_test',
      name: '美麗海水族館',
      rating: 4.5,
      business_status: 'OPERATIONAL',
      phone: '+81 980-48-3748',
    });
  });

  it('404 NOT_FOUND → returns null (caller marks status=missing)', async () => {
    fetch4xx(404);
    const result = await getPlaceDetails('k', 'ChIJ_dead');
    expect(result).toBeNull();
  });

  it('500 → throws MAPS_UPSTREAM_FAILED', async () => {
    fetch4xx(500);
    try {
      await getPlaceDetails('k', 'p');
      throw new Error('should have thrown');
    } catch (err) {
      const e = err as { code: string; detail?: string };
      expect(e.code).toBe('MAPS_UPSTREAM_FAILED');
      expect(e.detail).toContain('Place details 500');
    }
  });

  it('CLOSED_PERMANENTLY business_status preserved (caller maps to status="closed")', async () => {
    fetchOk({
      id: 'p',
      displayName: { text: 'X' },
      location: { latitude: 1, longitude: 1 },
      businessStatus: 'CLOSED_PERMANENTLY',
    });
    const result = await getPlaceDetails('k', 'p');
    expect(result?.business_status).toBe('CLOSED_PERMANENTLY');
  });
});

describe('computeRoute', () => {
  it('POSTs to Routes computeRoutes with travelMode + polylineQuality', async () => {
    fetchOk({
      routes: [{
        polyline: { encodedPolyline: 'abc123' },
        distanceMeters: 5000,
        duration: '600s',
      }],
    });
    const result = await computeRoute(
      'test-key',
      { lat: 35.68, lng: 139.76 },
      { lat: 35.69, lng: 139.70 },
      'DRIVE',
    );
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toContain('routes.googleapis.com/directions/v2:computeRoutes');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.travelMode).toBe('DRIVE');
    expect(result).toMatchObject({
      polyline: 'abc123',
      distance_meters: 5000,
      duration_seconds: 600,
    });
  });

  it('empty routes → throws MAPS_UPSTREAM_FAILED (no fallback per P11)', async () => {
    fetchOk({ routes: [] });
    try {
      await computeRoute('k', { lat: 0, lng: 0 }, { lat: 1, lng: 1 });
      throw new Error('should have thrown');
    } catch (err) {
      const e = err as { code: string; detail?: string };
      expect(e.code).toBe('MAPS_UPSTREAM_FAILED');
      expect(e.detail).toContain('Routes empty result');
    }
  });

  it('upstream 5xx → throws MAPS_UPSTREAM_FAILED', async () => {
    fetch4xx(502);
    try {
      await computeRoute('k', { lat: 0, lng: 0 }, { lat: 1, lng: 1 });
      throw new Error('should have thrown');
    } catch (err) {
      const e = err as { code: string; detail?: string };
      expect(e.code).toBe('MAPS_UPSTREAM_FAILED');
      expect(e.detail).toContain('Routes 502');
    }
  });
});

describe('reverseGeocode', () => {
  it('GET to maps API geocode with latlng + key', async () => {
    fetchOk({
      status: 'OK',
      results: [{
        formatted_address: '沖縄県那覇市',
        address_components: [
          { short_name: 'JP', long_name: '日本', types: ['country'] },
        ],
      }],
    });
    const result = await reverseGeocode('test-key', 26.21, 127.68);
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('maps.googleapis.com/maps/api/geocode/json');
    expect(url).toContain('latlng=26.21,127.68');
    expect(url).toContain('key=test-key');
    expect(result).toMatchObject({
      formatted_address: '沖縄県那覇市',
      country_code: 'JP',
      country_name: '日本',
    });
  });

  it('ZERO_RESULTS → returns null', async () => {
    fetchOk({ status: 'ZERO_RESULTS', results: [] });
    const result = await reverseGeocode('k', 0, 0);
    expect(result).toBeNull();
  });

  it('non-OK status → throws MAPS_UPSTREAM_FAILED', async () => {
    fetchOk({ status: 'OVER_QUERY_LIMIT', results: [] });
    try {
      await reverseGeocode('k', 0, 0);
      throw new Error('should have thrown');
    } catch (err) {
      const e = err as { code: string; detail?: string };
      expect(e.code).toBe('MAPS_UPSTREAM_FAILED');
      expect(e.detail).toContain('OVER_QUERY_LIMIT');
    }
  });
});
