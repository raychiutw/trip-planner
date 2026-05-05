/**
 * Integration test — POST /api/poi-favorites/:id/add-to-trip (poi-favorites-rename §9)
 *
 * 4-field 純時間驅動 form：{ tripId, dayNum, startTime, endTime } — 無 position / anchorEntryId。
 *
 * Cover：
 *   §9.1 4 fields validation：tripId / dayNum / startTime / endTime 必填
 *   §9.2 startTime 或 endTime 缺失 → 400 DATA_VALIDATION
 *   §9.3 body 含 legacy position 或 anchorEntryId → 400「欄位已廢除」
 *   §9.4 startTime '12:00' 加進已有 11:00-12:00 entry 的 day → server 計算 sort_order 排到後面
 *   §9.5 startTime '13:00' 加進已有 12:00-14:00 entry 的 day → 409 CONFLICT + conflictWith
 *   §9.6 V2 user 成功 201 + entry + trip_pois 各 1 row
 *   §9.7 companion case：valid 三 gate + companionRequestId + ownership match → 201 + audit_log companion sentinel
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
import { onRequestPost } from '../../functions/api/poi-favorites/[id]/add-to-trip';
import type { AuthData, Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

const TP_REQUEST_CLIENT_ID = 'tripline-internal-cli';
const SUBMITTER_EMAIL = 'companion-add-submitter@test.com';

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db, { TP_REQUEST_CLIENT_ID });
  await seedUser(db, SUBMITTER_EMAIL);
});

afterAll(disposeMiniflare);

beforeEach(async () => {
  await db.prepare("DELETE FROM companion_request_actions").run();
  await db.prepare("DELETE FROM audit_log WHERE trip_id = 'system:companion'").run();
  await db.prepare("DELETE FROM trip_requests WHERE trip_id LIKE 'companion-add-%'").run();
  await db.prepare("DELETE FROM poi_favorites WHERE user_id LIKE 'test-user-%'").run();
  await db.prepare("DELETE FROM trip_entries WHERE day_id IN (SELECT id FROM trip_days WHERE trip_id LIKE 'add-trip-%')").run();
  await db.prepare("DELETE FROM trip_pois WHERE trip_id LIKE 'add-trip-%'").run();
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

async function seedFavorite(opts: { email: string; poiName?: string }): Promise<{ favId: number; userId: string; poiId: number }> {
  const userId = await seedUser(db, opts.email);
  const poiId = await seedPoi(db, { name: opts.poiName ?? `POI for ${opts.email}` });
  const favRow = await db
    .prepare('INSERT INTO poi_favorites (user_id, poi_id) VALUES (?, ?) RETURNING id')
    .bind(userId, poiId)
    .first<{ id: number }>();
  return { favId: favRow!.id, userId, poiId };
}

async function seedAddTripFixture(opts: { tripId: string; ownerEmail: string }) {
  await seedTrip(db, { id: opts.tripId, owner: opts.ownerEmail, days: 3 });
}

function buildAddToTripRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Request {
  return new Request('https://test.com/api/poi-favorites/1/add-to-trip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

// --- §9.1 4 fields validation ---

describe('POST /api/poi-favorites/:id/add-to-trip — §9.1 4 fields validation', () => {
  it('happy path 4 fields → 201', async () => {
    const tripId = 'add-trip-9-1';
    await seedAddTripFixture({ tripId, ownerEmail: '9-1@test.com' });
    const { favId } = await seedFavorite({ email: '9-1@test.com' });

    const ctx = mockContext({
      request: buildAddToTripRequest({ tripId, dayNum: 1, startTime: '10:00', endTime: '11:00' }),
      env,
      auth: mockAuth({ email: '9-1@test.com' }),
      params: { id: String(favId) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);
  });

  it('缺 tripId → 400', async () => {
    const { favId } = await seedFavorite({ email: '9-1-no-trip@test.com' });
    const ctx = mockContext({
      request: buildAddToTripRequest({ dayNum: 1, startTime: '10:00', endTime: '11:00' }),
      env,
      auth: mockAuth({ email: '9-1-no-trip@test.com' }),
      params: { id: String(favId) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
  });

  it('dayNum < 1 → 400', async () => {
    const tripId = 'add-trip-9-1-day';
    await seedAddTripFixture({ tripId, ownerEmail: '9-1-day@test.com' });
    const { favId } = await seedFavorite({ email: '9-1-day@test.com' });
    const ctx = mockContext({
      request: buildAddToTripRequest({ tripId, dayNum: 0, startTime: '10:00', endTime: '11:00' }),
      env,
      auth: mockAuth({ email: '9-1-day@test.com' }),
      params: { id: String(favId) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
  });
});

// --- §9.2 startTime/endTime 缺失 ---

describe('POST /api/poi-favorites/:id/add-to-trip — §9.2 time fields required', () => {
  it('缺 startTime → 400', async () => {
    const tripId = 'add-trip-9-2-no-start';
    await seedAddTripFixture({ tripId, ownerEmail: '9-2-no-start@test.com' });
    const { favId } = await seedFavorite({ email: '9-2-no-start@test.com' });
    const ctx = mockContext({
      request: buildAddToTripRequest({ tripId, dayNum: 1, endTime: '11:00' }),
      env,
      auth: mockAuth({ email: '9-2-no-start@test.com' }),
      params: { id: String(favId) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
  });

  it('缺 endTime → 400', async () => {
    const tripId = 'add-trip-9-2-no-end';
    await seedAddTripFixture({ tripId, ownerEmail: '9-2-no-end@test.com' });
    const { favId } = await seedFavorite({ email: '9-2-no-end@test.com' });
    const ctx = mockContext({
      request: buildAddToTripRequest({ tripId, dayNum: 1, startTime: '10:00' }),
      env,
      auth: mockAuth({ email: '9-2-no-end@test.com' }),
      params: { id: String(favId) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
  });
});

// --- §9.3 legacy fields rejection ---

describe('POST /api/poi-favorites/:id/add-to-trip — §9.3 legacy fields rejected', () => {
  it('body 含 position → 400「欄位已廢除」', async () => {
    const tripId = 'add-trip-9-3-pos';
    await seedAddTripFixture({ tripId, ownerEmail: '9-3-pos@test.com' });
    const { favId } = await seedFavorite({ email: '9-3-pos@test.com' });
    const ctx = mockContext({
      request: buildAddToTripRequest({
        tripId,
        dayNum: 1,
        startTime: '10:00',
        endTime: '11:00',
        position: 'append',
      }),
      env,
      auth: mockAuth({ email: '9-3-pos@test.com' }),
      params: { id: String(favId) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
    const body = await resp.json() as { error: { detail?: string; message?: string } };
    const text = (body.error.detail ?? body.error.message ?? '').toString();
    expect(text).toMatch(/廢除|deprecated|不支援/);
  });

  it('body 含 anchorEntryId → 400「欄位已廢除」', async () => {
    const tripId = 'add-trip-9-3-anchor';
    await seedAddTripFixture({ tripId, ownerEmail: '9-3-anchor@test.com' });
    const { favId } = await seedFavorite({ email: '9-3-anchor@test.com' });
    const ctx = mockContext({
      request: buildAddToTripRequest({
        tripId,
        dayNum: 1,
        startTime: '10:00',
        endTime: '11:00',
        anchorEntryId: 1,
      }),
      env,
      auth: mockAuth({ email: '9-3-anchor@test.com' }),
      params: { id: String(favId) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(400);
  });
});

// --- §9.4 sort_order 計算 ---

describe('POST /api/poi-favorites/:id/add-to-trip — §9.4 sort_order auto-calc', () => {
  it('startTime 12:00 加進已有 11:00-12:00 entry 的 day → 排到該 entry 之後', async () => {
    const tripId = 'add-trip-9-4-sort';
    await seedAddTripFixture({ tripId, ownerEmail: '9-4-sort@test.com' });
    const { favId } = await seedFavorite({ email: '9-4-sort@test.com', poiName: 'POI 9-4' });

    // 已有 entry 11:00-12:00 sort_order=0
    const day1 = await db
      .prepare('SELECT id FROM trip_days WHERE trip_id = ? AND day_num = 1')
      .bind(tripId)
      .first<{ id: number }>();
    await db
      .prepare(
        `INSERT INTO trip_entries (day_id, sort_order, time, title) VALUES (?, ?, ?, ?)`,
      )
      .bind(day1!.id, 0, '11:00-12:00', 'existing entry')
      .run();

    const ctx = mockContext({
      request: buildAddToTripRequest({ tripId, dayNum: 1, startTime: '12:00', endTime: '13:00' }),
      env,
      auth: mockAuth({ email: '9-4-sort@test.com' }),
      params: { id: String(favId) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);

    const data = await resp.json() as { sortOrder: number };
    expect(data.sortOrder).toBe(1); // 排到 0 之後
  });
});

// --- §9.5 conflict ---

describe('POST /api/poi-favorites/:id/add-to-trip — §9.5 conflict 409', () => {
  it('startTime 13:00 加進已有 12:00-14:00 entry 的 day → 409 + conflictWith', async () => {
    const tripId = 'add-trip-9-5-conflict';
    await seedAddTripFixture({ tripId, ownerEmail: '9-5@test.com' });
    const { favId } = await seedFavorite({ email: '9-5@test.com' });

    const day1 = await db
      .prepare('SELECT id FROM trip_days WHERE trip_id = ? AND day_num = 1')
      .bind(tripId)
      .first<{ id: number }>();
    await db
      .prepare(
        `INSERT INTO trip_entries (day_id, sort_order, time, title) VALUES (?, ?, ?, ?)`,
      )
      .bind(day1!.id, 0, '12:00-14:00', 'lunch')
      .run();

    const ctx = mockContext({
      request: buildAddToTripRequest({ tripId, dayNum: 1, startTime: '13:00', endTime: '14:30' }),
      env,
      auth: mockAuth({ email: '9-5@test.com' }),
      params: { id: String(favId) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(409);
    const data = await resp.json() as { conflictWith?: { time: string; title: string } };
    expect(data.conflictWith).toBeDefined();
    expect(data.conflictWith!.time).toBe('12:00-14:00');
    expect(data.conflictWith!.title).toBe('lunch');
  });
});

// --- §9.6 V2 user 成功 ---

describe('POST /api/poi-favorites/:id/add-to-trip — §9.6 V2 user happy path', () => {
  it('valid V2 user → 201 + entry + trip_pois 各 1 row', async () => {
    const tripId = 'add-trip-9-6';
    await seedAddTripFixture({ tripId, ownerEmail: '9-6@test.com' });
    const { favId, poiId } = await seedFavorite({ email: '9-6@test.com', poiName: 'POI 9-6' });

    const ctx = mockContext({
      request: buildAddToTripRequest({ tripId, dayNum: 2, startTime: '09:00', endTime: '10:30' }),
      env,
      auth: mockAuth({ email: '9-6@test.com' }),
      params: { id: String(favId) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);

    const day2 = await db
      .prepare('SELECT id FROM trip_days WHERE trip_id = ? AND day_num = 2')
      .bind(tripId)
      .first<{ id: number }>();
    const entries = await db
      .prepare('SELECT id, time, title, poi_id FROM trip_entries WHERE day_id = ?')
      .bind(day2!.id)
      .all<{ id: number; time: string; title: string; poi_id: number }>();
    expect(entries.results).toHaveLength(1);
    expect(entries.results[0]!.time).toBe('09:00-10:30');
    expect(entries.results[0]!.poi_id).toBe(poiId);

    const tripPois = await db
      .prepare('SELECT id FROM trip_pois WHERE trip_id = ? AND poi_id = ?')
      .bind(tripId, poiId)
      .all<{ id: number }>();
    expect(tripPois.results).toHaveLength(1);
  });
});

// --- §9.7 companion ---

describe('POST /api/poi-favorites/:id/add-to-trip — §9.7 companion', () => {
  it('valid 三 gate + companionRequestId + ownership match → 201 + audit_log companion sentinel', async () => {
    const tripId = 'add-trip-9-7';
    await seedAddTripFixture({ tripId, ownerEmail: SUBMITTER_EMAIL });
    const submitterUserRow = await db
      .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)')
      .bind(SUBMITTER_EMAIL)
      .first<{ id: string }>();
    const submitterUserId = submitterUserRow!.id;
    const poiId = await seedPoi(db, { name: 'POI 9-7 companion' });
    const favRow = await db
      .prepare('INSERT INTO poi_favorites (user_id, poi_id) VALUES (?, ?) RETURNING id')
      .bind(submitterUserId, poiId)
      .first<{ id: number }>();
    const favId = favRow!.id;

    const requestId = await (async () => {
      const tripIdReq = `companion-add-trip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await seedTrip(db, { id: tripIdReq, owner: SUBMITTER_EMAIL });
      const r = await db
        .prepare(
          'INSERT INTO trip_requests (trip_id, message, submitted_by, status) VALUES (?, ?, ?, ?) RETURNING id',
        )
        .bind(tripIdReq, 'add-to-trip companion', SUBMITTER_EMAIL, 'processing')
        .first<{ id: number }>();
      return r!.id;
    })();

    const ctx = mockContext({
      request: buildAddToTripRequest(
        { tripId, dayNum: 1, startTime: '10:00', endTime: '11:00', companionRequestId: requestId },
        { 'X-Request-Scope': 'companion' },
      ),
      env,
      auth: companionAuth(),
      params: { id: String(favId) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    expect(resp.status).toBe(201);

    // companion_request_actions 1 row（action='add_to_trip'）
    const actions = await db
      .prepare('SELECT action FROM companion_request_actions WHERE request_id = ?')
      .bind(requestId)
      .all<{ action: string }>();
    expect(actions.results).toHaveLength(1);
    expect(actions.results[0]!.action).toBe('add_to_trip');

    // audit_log companion sentinel
    const audit = await db
      .prepare(
        `SELECT changed_by, trip_id FROM audit_log
         WHERE table_name = 'trip_entries' AND request_id = ? ORDER BY id DESC LIMIT 1`,
      )
      .bind(requestId)
      .first<{ changed_by: string; trip_id: string }>();
    expect(audit).not.toBeNull();
    expect(audit!.changed_by).toBe(`companion:${requestId}`);
    expect(audit!.trip_id).toBe('system:companion');
  });

  it('CSO finding fix: companion 送 tripId X，submitter 沒 write to X → 403（防 prompt-injected cross-trip）', async () => {
    // Setup：submitter own 一個 trip A（用來建 trip_request）；建另一個 trip B
    // 由 admin own，submitter 無權限。Companion 嘗試把收藏加進 B → 應 403。
    const ownTripId = `companion-own-${Date.now()}`;
    await seedAddTripFixture({ tripId: ownTripId, ownerEmail: SUBMITTER_EMAIL });

    const foreignTripId = `companion-foreign-${Date.now()}`;
    await seedAddTripFixture({ tripId: foreignTripId, ownerEmail: 'foreign-owner@test.com' });

    const submitterUserRow = await db
      .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)')
      .bind(SUBMITTER_EMAIL)
      .first<{ id: string }>();
    const submitterUserId = submitterUserRow!.id;
    const poiId = await seedPoi(db, { name: 'POI cross-trip guard' });
    const favRow = await db
      .prepare('INSERT INTO poi_favorites (user_id, poi_id) VALUES (?, ?) RETURNING id')
      .bind(submitterUserId, poiId)
      .first<{ id: number }>();
    const favId = favRow!.id;

    // trip_request 對應 ownTripId（合法 context）
    const r = await db
      .prepare(
        'INSERT INTO trip_requests (trip_id, message, submitted_by, status) VALUES (?, ?, ?, ?) RETURNING id',
      )
      .bind(ownTripId, 'cross-trip attempt', SUBMITTER_EMAIL, 'processing')
      .first<{ id: number }>();
    const requestId = r!.id;

    // 攻擊：body.tripId 改成 foreignTripId（submitter 沒 write 權限）
    const ctx = mockContext({
      request: buildAddToTripRequest(
        { tripId: foreignTripId, dayNum: 1, startTime: '10:00', endTime: '11:00', companionRequestId: requestId },
        { 'X-Request-Scope': 'companion' },
      ),
      env,
      auth: companionAuth(),
      params: { id: String(favId) },
    });
    const resp = await callHandler(onRequestPost, ctx);
    // 預期 403 PERM_DENIED（hasWritePermission 對 submitter 對 foreignTripId returns false）
    expect(resp.status).toBe(403);
  });
});
