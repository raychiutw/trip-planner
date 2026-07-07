/**
 * Integration test — POST /api/pois/:id/enrich
 *
 * v2.33.106 T-1: 涵蓋 auth gate / validation / place_id 缺失 / Google API
 * failure / business_status 三條 branch (OPERATIONAL / CLOSED_PERMANENTLY /
 * 404 missing) + non-admin tripId gate。
 *
 * 真正打 Google Place Details 需要 vi.mock — 用 mock 回傳 fixture 驗每條 branch。
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, jsonRequest, seedPoi, seedTrip, callHandler } from './helpers';

const mockGetPlaceDetails = vi.fn();
vi.mock('../../src/server/maps/google-client', () => ({
  getPlaceDetails: (...args: unknown[]) => mockGetPlaceDetails(...args),
}));

const { onRequestPost } = await import('../../functions/api/pois/[id]/enrich');

let db: D1Database;
let ownerUserId: string;

beforeAll(async () => {
  db = await createTestDb();
  const seeded = await seedTrip(db, { id: 'trip-enrich', owner: 'owner@test.com' });
  ownerUserId = seeded.ownerUserId;
});

afterAll(disposeMiniflare);

beforeEach(() => {
  mockGetPlaceDetails.mockReset();
});

async function seedPoiWithPlaceId(name: string, placeId: string | null): Promise<number> {
  const id = await seedPoi(db, { name });
  await db.prepare('UPDATE pois SET place_id = ? WHERE id = ?').bind(placeId, id).run();
  // link 進 trip-enrich（透過 trip_entry_pois 經 trip_days/trip_entries）
  const day = await db.prepare('SELECT id FROM trip_days WHERE trip_id = ? ORDER BY day_num LIMIT 1')
    .bind('trip-enrich').first<{ id: number }>();
  if (day) {
    const entry = await db.prepare(
      'INSERT INTO trip_entries (day_id, sort_order) VALUES (?, ?) RETURNING id'
    ).bind(day.id, 1000 + id).first<{ id: number }>();
    if (entry) {
      await db.prepare(
        'INSERT INTO trip_entry_pois (entry_id, poi_id, sort_order) VALUES (?, ?, 1)'
      ).bind(entry.id, id).run();
    }
  }
  return id;
}

describe('POST /api/pois/:id/enrich (T-1)', () => {
  it('未認證 → 401', async () => {
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = 'test-key';
    const poiId = await seedPoiWithPlaceId('A', 'ChIJ_A');
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}/enrich?tripId=trip-enrich`, 'POST'),
      env,
      params: { id: String(poiId) },
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(401);
  });

  it('id 非正整數 → 400', async () => {
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = 'test-key';
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/pois/abc/enrich?tripId=trip-enrich', 'POST'),
      env,
      auth: mockAuth({ email: 'owner@test.com', userId: ownerUserId }),
      params: { id: 'abc' },
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(400);
  });

  it('non-admin 缺 tripId → 400', async () => {
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = 'test-key';
    const poiId = await seedPoiWithPlaceId('B', 'ChIJ_B');
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}/enrich`, 'POST'),
      env,
      auth: mockAuth({ email: 'user@test.com', userId: 'user-1' }),
      params: { id: String(poiId) },
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(400);
  });

  it('non-admin 無寫權限該 trip → 403', async () => {
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = 'test-key';
    const poiId = await seedPoiWithPlaceId('C', 'ChIJ_C');
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}/enrich?tripId=trip-enrich`, 'POST'),
      env,
      auth: mockAuth({ email: 'stranger@test.com', userId: 'stranger-1' }),
      params: { id: String(poiId) },
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(403);
  });

  it('POI 不存在 → 404', async () => {
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = 'test-key';
    const ctx = mockContext({
      request: jsonRequest('https://test.com/api/pois/999999/enrich', 'POST'),
      env,
      auth: mockAuth({ email: 'service:poi-cli', userId: null, isServiceToken: true, scopes: ['ops:poi'], clientId: 'poi-cli' }),
      params: { id: '999999' },
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(404);
  });

  it('POI 缺 place_id → 400', async () => {
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = 'test-key';
    const poiId = await seedPoiWithPlaceId('NoPlace', null);
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}/enrich`, 'POST'),
      env,
      auth: mockAuth({ email: 'service:poi-cli', userId: null, isServiceToken: true, scopes: ['ops:poi'], clientId: 'poi-cli' }),
      params: { id: String(poiId) },
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(400);
  });

  it('GOOGLE_MAPS_API_KEY 缺 → 502', async () => {
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = '';
    const poiId = await seedPoiWithPlaceId('D', 'ChIJ_D');
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}/enrich`, 'POST'),
      env,
      auth: mockAuth({ email: 'service:poi-cli', userId: null, isServiceToken: true, scopes: ['ops:poi'], clientId: 'poi-cli' }),
      params: { id: String(poiId) },
    });
    expect((await callHandler(onRequestPost, ctx)).status).toBe(502);
  });

  it('happy path OPERATIONAL → status=active + rating 寫入', async () => {
    mockGetPlaceDetails.mockResolvedValue({
      rating: 4.5,
      lat: 25.0,
      lng: 121.5,
      address: 'Taipei',
      phone: null,
      weekday_descriptions: ['星期一: 09:00-18:00', '星期二: 09:00-18:00'],
      business_status: 'OPERATIONAL',
    });
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = 'test-key';
    const poiId = await seedPoiWithPlaceId('Happy', 'ChIJ_Happy');
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}/enrich`, 'POST'),
      env,
      auth: mockAuth({ email: 'service:poi-cli', userId: null, isServiceToken: true, scopes: ['ops:poi'], clientId: 'poi-cli' }),
      params: { id: String(poiId) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Record<string, unknown>;
    expect(data.status).toBe('active');
    expect(data.rating).toBe(4.5);

    // 確認 D1 row 寫入
    const row = await db.prepare('SELECT rating, status, address, hours FROM pois WHERE id = ?')
      .bind(poiId).first<{ rating: number; status: string; address: string; hours: string }>();
    expect(row?.rating).toBe(4.5);
    expect(row?.status).toBe('active');
    expect(row?.address).toBe('Taipei');
    expect(row?.hours).toContain('星期一');
  });

  it('CLOSED_PERMANENTLY → status=closed + reason=永久歇業', async () => {
    mockGetPlaceDetails.mockResolvedValue({
      rating: 3.0,
      lat: 25.0,
      lng: 121.5,
      address: 'Old Address',
      phone: null,
      weekday_descriptions: [],
      business_status: 'CLOSED_PERMANENTLY',
    });
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = 'test-key';
    const poiId = await seedPoiWithPlaceId('Closed', 'ChIJ_Closed');
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}/enrich`, 'POST'),
      env,
      auth: mockAuth({ email: 'service:poi-cli', userId: null, isServiceToken: true, scopes: ['ops:poi'], clientId: 'poi-cli' }),
      params: { id: String(poiId) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Record<string, unknown>;
    expect(data.status).toBe('closed');
    expect(data.statusReason).toBe('永久歇業');
  });

  it('CLOSED_TEMPORARILY → status=active（暫時不警告）', async () => {
    mockGetPlaceDetails.mockResolvedValue({
      rating: 4.0,
      lat: 25.0,
      lng: 121.5,
      address: 'Tmp Closed',
      phone: null,
      weekday_descriptions: [],
      business_status: 'CLOSED_TEMPORARILY',
    });
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = 'test-key';
    const poiId = await seedPoiWithPlaceId('TmpClosed', 'ChIJ_TmpClosed');
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}/enrich`, 'POST'),
      env,
      auth: mockAuth({ email: 'service:poi-cli', userId: null, isServiceToken: true, scopes: ['ops:poi'], clientId: 'poi-cli' }),
      params: { id: String(poiId) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Record<string, unknown>;
    expect(data.status).toBe('active');
    expect(data.statusReason).toBeNull();
  });

  it('Google 404 → status=missing + reason=Google Maps 查無資料', async () => {
    mockGetPlaceDetails.mockResolvedValue(null);
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = 'test-key';
    const poiId = await seedPoiWithPlaceId('Missing', 'ChIJ_Missing');
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}/enrich`, 'POST'),
      env,
      auth: mockAuth({ email: 'service:poi-cli', userId: null, isServiceToken: true, scopes: ['ops:poi'], clientId: 'poi-cli' }),
      params: { id: String(poiId) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Record<string, unknown>;
    expect(data.status).toBe('missing');
    expect(data.statusReason).toBe('Google Maps 查無資料');
  });

  it('owner with trip write permission → 200', async () => {
    mockGetPlaceDetails.mockResolvedValue({
      rating: 4.2,
      lat: 25.0,
      lng: 121.5,
      address: 'Owner Test',
      phone: null,
      weekday_descriptions: [],
      business_status: 'OPERATIONAL',
    });
    const env = mockEnv(db);
    env.GOOGLE_MAPS_API_KEY = 'test-key';
    const poiId = await seedPoiWithPlaceId('OwnerPath', 'ChIJ_OwnerPath');
    const ctx = mockContext({
      request: jsonRequest(`https://test.com/api/pois/${poiId}/enrich?tripId=trip-enrich`, 'POST'),
      env,
      auth: mockAuth({ email: 'owner@test.com', userId: ownerUserId }),
      params: { id: String(poiId) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(200);
  });
});
