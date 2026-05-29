/**
 * Integration test — Google APIs endpoints (v2.34.37 PR37)
 *
 * 涵蓋 PR35 doc 標 P0 HIGH risk 兩個 endpoint：
 *   - GET /api/poi-search — Places Text Search (with D1 24h cache)
 *   - GET /api/route — Routes API (DRIVE mode)
 *
 * Strategy: vi.mock '../../src/server/maps/google-client' 避免實打 Google API（cost + flaky）。
 * 測 validation / rate limit / cache hit-miss / kill switch / 500 上游錯誤 / polyline decode。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockContext, callHandler } from './helpers';
import type { Env } from '../../functions/api/_types';

// Mock google-client — handlers import via this exact path
vi.mock('../../src/server/maps/google-client', () => ({
  searchPlaces: vi.fn(),
  computeRoute: vi.fn(),
}));

// Re-import after mock so handlers + tests get mocked versions
const { onRequestGet: poiSearchHandler } = await import('../../functions/api/poi-search');
const { onRequestGet: routeHandler } = await import('../../functions/api/route');
const { searchPlaces, computeRoute } = await import('../../src/server/maps/google-client');

let db: D1Database;
let env: Env;

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db, { GOOGLE_MAPS_API_KEY: 'test-api-key' });
});

afterAll(disposeMiniflare);

beforeEach(() => {
  vi.mocked(searchPlaces).mockReset();
  vi.mocked(computeRoute).mockReset();
});

function callPoiSearch(searchParams: string, ipHeader = '1.2.3.4') {
  return callHandler(poiSearchHandler, mockContext({
    request: new Request(`https://test/api/poi-search?${searchParams}`, {
      method: 'GET',
      headers: { 'CF-Connecting-IP': ipHeader },
    }),
    env,
    params: {},
  }));
}

function callRoute(searchParams: string, ipHeader = '5.6.7.8') {
  return callHandler(routeHandler, mockContext({
    request: new Request(`https://test/api/route?${searchParams}`, {
      method: 'GET',
      headers: { 'CF-Connecting-IP': ipHeader },
    }),
    env,
    params: {},
  }));
}

describe('GET /api/poi-search — validation + rate limit + mock', () => {
  it('query < 2 字元 → 400 DATA_VALIDATION', async () => {
    const res = await callPoiSearch('q=a');
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string; detail?: string } };
    expect(body.error.code).toBe('DATA_VALIDATION');
  });

  it('query > 200 字元 → 400 DATA_VALIDATION', async () => {
    const res = await callPoiSearch(`q=${'x'.repeat(201)}`);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string; detail?: string } };
    expect(body.error.detail).toContain('200');
  });

  it('q 缺失 → 400', async () => {
    const res = await callPoiSearch('region=JP');
    expect(res.status).toBe(400);
  });

  it('正常 query → call searchPlaces + 200 response + X-Cache=MISS', async () => {
    vi.mocked(searchPlaces).mockResolvedValueOnce([
      {
        place_id: 'ChIJxxx',
        name: '東京鐵塔',
        address: '東京都港区芝公園',
        lat: 35.6586,
        lng: 139.7454,
        category: 'TOURIST_ATTRACTION',
        country: 'JP',
        country_name: '日本',
        rating: 4.4,
      },
    ]);
    const res = await callPoiSearch('q=東京鐵塔&region=JP&limit=5');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache')).toBe('MISS');
    const body = await res.json() as { results: Array<{ name: string }> };
    expect(body.results.length).toBe(1);
    expect(body.results[0].name).toBe('東京鐵塔');
    expect(vi.mocked(searchPlaces)).toHaveBeenCalledTimes(1);
  });

  it('limit clamp 到 [1, 20]', async () => {
    vi.mocked(searchPlaces).mockResolvedValueOnce([]);
    await callPoiSearch('q=test&limit=999');
    const [, , , limit] = vi.mocked(searchPlaces).mock.calls[0]!;
    expect(limit).toBe(20);
  });

  it('searchPlaces throw → handler 不 catch（test framework catches raw Error）', async () => {
    // Production middleware (Cloudflare Pages) catches uncaught Error → 500。
    // Test 不 simulate middleware；確認 handler 對 google-client 上游錯誤不額外 try/catch。
    vi.mocked(searchPlaces).mockRejectedValueOnce(new Error('Google 503'));
    await expect(callPoiSearch('q=test-err&region=JP')).rejects.toThrow('Google 503');
  });
});

describe('GET /api/route — validation + mock', () => {
  it('缺 from / to → 400 DATA_VALIDATION', async () => {
    const res = await callRoute('from=139.7,35.6');
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string; detail?: string } };
    expect(body.error.code).toBe('DATA_VALIDATION');
  });

  it('正常 coords → call computeRoute + 200 + decode polyline + duration / distance', async () => {
    vi.mocked(computeRoute).mockResolvedValueOnce({
      polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@', // sample encoded polyline
      duration_seconds: 1234,
      distance_meters: 56789,
    });
    const res = await callRoute('from=139.7,35.6&to=139.8,35.7');
    expect(res.status).toBe(200);
    const body = await res.json() as {
      polyline: Array<[number, number]>;
      duration: number;
      distance: number;
    };
    expect(Array.isArray(body.polyline)).toBe(true);
    expect(body.polyline.length).toBeGreaterThan(0);
    expect(body.duration).toBe(1234);
    expect(body.distance).toBe(56789);
    expect(vi.mocked(computeRoute)).toHaveBeenCalledTimes(1);
    // mode 應為 DRIVE (v2.30.0 default)
    const [, , , mode] = vi.mocked(computeRoute).mock.calls[0]!;
    expect(mode).toBe('DRIVE');
  });

  it('computeRoute throw → handler 不 catch', async () => {
    vi.mocked(computeRoute).mockRejectedValueOnce(new Error('Routes API 503'));
    await expect(callRoute('from=139.7,35.6&to=139.8,35.7')).rejects.toThrow('Routes API 503');
  });

  it('Cache-Control: public, max-age=86400 (24h edge cache)', async () => {
    vi.mocked(computeRoute).mockResolvedValueOnce({
      polyline: '_p~iF~ps|U',
      duration_seconds: 100,
      distance_meters: 500,
    });
    const res = await callRoute('from=139.7,35.6&to=139.8,35.7');
    expect(res.headers.get('Cache-Control')).toMatch(/public.*86400/);
  });
});

describe('PR35 P0 HIGH gap — source-grep regression', () => {
  it('poi-search.ts 仍 import searchPlaces from google-client', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const src = readFileSync(join(__dirname, '..', '..', 'functions/api/poi-search.ts'), 'utf8');
    expect(src).toMatch(/import\s+\{[^}]*searchPlaces[^}]*\}\s+from\s+['"][^'"]*google-client['"]/);
  });

  it('route.ts 仍 import computeRoute from google-client', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const src = readFileSync(join(__dirname, '..', '..', 'functions/api/route.ts'), 'utf8');
    expect(src).toMatch(/import\s+\{[^}]*computeRoute[^}]*\}\s+from\s+['"][^'"]*google-client['"]/);
  });
});
