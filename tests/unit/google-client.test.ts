/**
 * google-client unit tests — verify request shape + response parsing for
 * each Places / Routes endpoint.
 *
 * Mocks global fetch; no real Google API calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  searchPlaces,
  searchPlacesPage,
  getPlaceDetails,
  computeRoute,
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


/*
 * 2026-07-29 —— 探索頁「捲到底載更多」。
 *
 * 現況：searchPlaces 回 PlacesSearchTextResult[]，maxResultCount 硬 cap 20，
 * 且完全沒把 Google 的 nextPageToken 接出來 —— 前端 limit=20、後端也 cap 20，
 * 第 21 筆之後前後端都沒有路可以拿到。
 *
 * 決策（owner）：接 pageToken，上限 3 頁 60 筆。使用者不捲就不多打 —— Text Search
 * 是 Enterprise tier、每月免費額度僅 1K，每多一頁就是多一次計費請求。
 */
describe('searchPlaces —— 分頁（nextPageToken）', () => {
  it('回傳 nextPageToken 讓呼叫端能拿下一頁', async () => {
    fetchOk({
      places: [{
        id: 'p1', displayName: { text: 'A' }, formattedAddress: 'addr',
        location: { latitude: 1, longitude: 2 }, primaryType: 'restaurant',
      }],
      nextPageToken: 'TOKEN_ABC',
    });
    const page = await searchPlacesPage('k', 'q');
    expect(page.results).toHaveLength(1);
    expect(page.nextPageToken).toBe('TOKEN_ABC');
  });

  it('沒有更多結果時 nextPageToken 為 null', async () => {
    fetchOk({ places: [{ id: 'p1', displayName: { text: 'A' }, location: { latitude: 1, longitude: 2 } }] });
    const page = await searchPlacesPage('k', 'q');
    expect(page.nextPageToken).toBeNull();
  });

  it('帶 pageToken 時原樣送進 request body', async () => {
    fetchOk({ places: [] });
    await searchPlacesPage('k', 'q', undefined, 10, undefined, 'TOKEN_ABC');
    const [, init] = mockFetch.mock.calls[0]!;
    expect(JSON.parse(init.body).pageToken).toBe('TOKEN_ABC');
  });

  it('不帶 pageToken 時 body 裡不出現該欄位（避免送 undefined 給 Google）', async () => {
    fetchOk({ places: [] });
    await searchPlacesPage('k', 'q');
    const [, init] = mockFetch.mock.calls[0]!;
    expect(Object.keys(JSON.parse(init.body))).not.toContain('pageToken');
  });

  it('searchPlaces 舊介面仍可用（只回陣列，既有呼叫端不受影響）', async () => {
    fetchOk({ places: [{ id: 'p1', displayName: { text: 'A' }, location: { latitude: 1, longitude: 2 } }], nextPageToken: 'X' });
    const results = await searchPlaces('k', 'q');
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(1);
  });
});

describe('searchText field mask', () => {
  it('必須包含 nextPageToken —— Places API (New) 只回 mask 列出的欄位', async () => {
    fetchOk({ places: [] });
    await searchPlacesPage('k', 'q');
    const [, init] = mockFetch.mock.calls[0]!;
    expect(init.headers['X-Goog-FieldMask'].split(',')).toContain('nextPageToken');
  });
});
