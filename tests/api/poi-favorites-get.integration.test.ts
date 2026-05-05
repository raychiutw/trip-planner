/**
 * Integration test — GET /api/poi-favorites (poi-favorites-rename §7)
 *
 * Cover：
 *   §7.1.a V2 user 200 + 包含 usages 陣列
 *   §7.1.b anonymous 200 + 空陣列（不拋 401）
 *   §7.1.c cross-user data leak 防護：A 不能看到 B 私 trip 中收藏 POI 的 usages
 *   §7.2.a companion 三 gate + ?companionRequestId=N → 回該 submitter 的 favorites pool
 *   §7.2.b companion gate 失敗（缺 OAuth scope）→ 401
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import {
  mockEnv,
  mockAuth,
  mockContext,
  seedPoi,
  seedUser,
  seedTrip,
  callHandler,
} from './helpers';
import { onRequestGet } from '../../functions/api/poi-favorites';
import type { AuthData, Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

const TP_REQUEST_CLIENT_ID = 'tripline-internal-cli';
const SUBMITTER_EMAIL = 'companion-get-submitter@test.com';

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db, { TP_REQUEST_CLIENT_ID });
  await seedUser(db, SUBMITTER_EMAIL);
});

afterAll(disposeMiniflare);

beforeEach(async () => {
  await db.prepare("DELETE FROM companion_request_actions").run();
  await db.prepare("DELETE FROM audit_log WHERE trip_id = 'system:companion'").run();
  await db.prepare("DELETE FROM trip_requests WHERE trip_id LIKE 'companion-get-%'").run();
  await db.prepare("DELETE FROM poi_favorites WHERE user_id LIKE 'test-user-%'").run();
});

function companionAuth(overrides: Partial<AuthData> = {}): AuthData {
  return {
    email: 'service:tripline-internal-cli',
    userId: null,
    isAdmin: true,
    isServiceToken: true,
    scopes: ['admin', 'companion'],
    clientId: TP_REQUEST_CLIENT_ID,
    ...overrides,
  };
}

async function seedTripRequest(): Promise<number> {
  const tripId = `companion-get-trip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await seedTrip(db, { id: tripId, owner: SUBMITTER_EMAIL });
  const row = await db
    .prepare(
      'INSERT INTO trip_requests (trip_id, message, submitted_by, status) VALUES (?, ?, ?, ?) RETURNING id',
    )
    .bind(tripId, 'get test', SUBMITTER_EMAIL, 'processing')
    .first<{ id: number }>();
  return row!.id;
}

// ----- §7.1 V2 user / anonymous -----

describe('GET /api/poi-favorites — §7.1 V2 user / anonymous', () => {
  it('V2 user 200 + 自己的 favorites + usages 陣列', async () => {
    const userId = await seedUser(db, 'v2-get-list@test.com');
    const poiX = await seedPoi(db, { name: 'GET POI X' });
    await db
      .prepare("INSERT INTO poi_favorites (user_id, poi_id, favorited_at, note) VALUES (?, ?, '2026-04-25 10:00:00', ?)")
      .bind(userId, poiX, 'fav note')
      .run();

    const ctx = mockContext({
      request: new Request('https://test.com/api/poi-favorites'),
      env,
      auth: mockAuth({ email: 'v2-get-list@test.com' }),
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Array<{ poiId: number; poiName: string; usages: unknown[] }>;
    expect(data).toHaveLength(1);
    expect(data[0]!.poiId).toBe(poiX);
    expect(data[0]!.poiName).toBe('GET POI X');
    expect(Array.isArray(data[0]!.usages)).toBe(true);
  });

  it('anonymous（無 auth）→ 200 + 空陣列', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/poi-favorites'),
      env,
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as unknown[];
    expect(data).toEqual([]);
  });

  it('service token without userId（無 companion header）→ 200 + 空陣列', async () => {
    // service token without companion path should be treated like anonymous-with-token
    const ctx = mockContext({
      request: new Request('https://test.com/api/poi-favorites'),
      env,
      auth: companionAuth(), // userId null + scopes 含 companion，但無 X-Request-Scope header
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as unknown[];
    expect(data).toEqual([]);
  });

  it('cross-user data leak 防護：A 不能看到 B 私 trip 中收藏 POI 的 usages', async () => {
    const userA = await seedUser(db, 'leak-user-a@test.com');
    const userB = await seedUser(db, 'leak-user-b@test.com');
    const sharedPoi = await seedPoi(db, { name: 'Shared POI' });

    // 兩 user 都收藏同一 POI
    await db.prepare('INSERT INTO poi_favorites (user_id, poi_id) VALUES (?, ?)').bind(userA, sharedPoi).run();
    await db.prepare('INSERT INTO poi_favorites (user_id, poi_id) VALUES (?, ?)').bind(userB, sharedPoi).run();

    // B 在自己私 trip 中放這個 POI
    await seedTrip(db, { id: 'private-trip-of-b', owner: 'leak-user-b@test.com' });
    const dayRow = await db
      .prepare('SELECT id FROM trip_days WHERE trip_id = ? LIMIT 1')
      .bind('private-trip-of-b')
      .first<{ id: number }>();
    await db
      .prepare(
        `INSERT INTO trip_pois (poi_id, trip_id, entry_id, day_id, sort_order, context)
         VALUES (?, ?, NULL, ?, 0, 'timeline')`,
      )
      .bind(sharedPoi, 'private-trip-of-b', dayRow!.id)
      .run();

    // A 查自己收藏 — usages 不該揭露 B 的私 trip
    const ctx = mockContext({
      request: new Request('https://test.com/api/poi-favorites'),
      env,
      auth: mockAuth({ email: 'leak-user-a@test.com' }),
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Array<{ poiId: number; usages: Array<{ tripId: string }> }>;
    const sharedFavorite = data.find((d) => d.poiId === sharedPoi);
    expect(sharedFavorite).toBeDefined();
    // A 不該看到 B 的 trip
    expect(sharedFavorite!.usages.find((u) => u.tripId === 'private-trip-of-b')).toBeUndefined();
  });
});

// ----- §7.2 companion -----

describe('GET /api/poi-favorites — §7.2 companion', () => {
  it('companion 三 gate + ?companionRequestId=N → 回該 submitter 的 favorites pool', async () => {
    const requestId = await seedTripRequest();
    // submitter 自己有收藏
    const submitterUserRow = await db
      .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)')
      .bind(SUBMITTER_EMAIL)
      .first<{ id: string }>();
    const submitterUserId = submitterUserRow!.id;
    const poiSubmitter = await seedPoi(db, { name: 'Submitter favorite' });
    await db
      .prepare('INSERT INTO poi_favorites (user_id, poi_id) VALUES (?, ?)')
      .bind(submitterUserId, poiSubmitter)
      .run();

    const ctx = mockContext({
      request: new Request(`https://test.com/api/poi-favorites?companionRequestId=${requestId}`, {
        headers: { 'X-Request-Scope': 'companion' },
      }),
      env,
      auth: companionAuth(),
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(200);
    const data = await resp.json() as Array<{ poiId: number; userId: string }>;
    const fav = data.find((d) => d.poiId === poiSubmitter);
    expect(fav).toBeDefined();
    expect(fav!.userId).toBe(submitterUserId);
  });

  it('companion gate 失敗（缺 OAuth scope）→ 401', async () => {
    const requestId = await seedTripRequest();
    const ctx = mockContext({
      request: new Request(`https://test.com/api/poi-favorites?companionRequestId=${requestId}`, {
        headers: { 'X-Request-Scope': 'companion' },
      }),
      env,
      auth: companionAuth({ scopes: ['admin'] }), // 缺 companion scope
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(401);
  });

  it('companion 缺 ?companionRequestId 查詢 → 401（resolver 走 invalid_request_id）', async () => {
    const ctx = mockContext({
      request: new Request('https://test.com/api/poi-favorites', {
        headers: { 'X-Request-Scope': 'companion' },
      }),
      env,
      auth: companionAuth(),
    });
    const resp = await callHandler(onRequestGet, ctx);
    expect(resp.status).toBe(401);
  });
});
