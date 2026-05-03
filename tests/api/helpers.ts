/**
 * API Test Helpers — 共用 mock 建構工具
 */
import type { Env, AuthData } from '../../functions/api/_types';
import { AppError, errorResponse } from '../../functions/api/_errors';

/**
 * 包裹 handler 呼叫 — 模擬 middleware 的 AppError catch 行為。
 * handler throw AppError → 轉為 Response（跟 production 行為一致）
 */
export async function callHandler(
  handler: (ctx: unknown) => Promise<Response>,
  ctx: unknown,
): Promise<Response> {
  // V2 cutover (migration 0047): trips.owner_user_id / trip_permissions.user_id
  // 必須有對應 users row。Auto-seed auth user before handler runs so callers
  // who only do mockAuth({email}) don't have to remember seedUser.
  const auth = (ctx as { data?: { auth?: AuthData } })?.data?.auth;
  const env = (ctx as { env?: Env })?.env;
  if (auth?.email && auth.userId && env?.DB) {
    await env.DB
      .prepare('INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)')
      .bind(auth.userId, auth.email, auth.email.split('@')[0])
      .run()
      .catch(() => { /* best-effort; tests asserting users insert behavior can override */ });
  }
  try {
    return await handler(ctx);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    throw err;
  }
}

/** 建立 mock Env 物件 */
export function mockEnv(db: D1Database, overrides: Partial<Env> = {}): Env {
  return {
    DB: db,
    ADMIN_EMAIL: 'admin@test.com',
    CF_API_TOKEN: 'test-token',
    CF_ACCOUNT_ID: 'test-account',
    CF_ACCESS_APP_ID: 'test-app',
    CF_ACCESS_POLICY_ID: 'test-policy',
    ASSETS: { fetch: async () => new Response('not found', { status: 404 }) },
    ...overrides,
  } as Env;
}

/** Synthetic userId from email: 'a@b.com' → 'test-user-a-b-com' */
export function userIdFor(email: string): string {
  return `test-user-${email.replace(/[^a-z0-9]/gi, '-')}`;
}

/** Insert users row (idempotent). Tests that create trips/permissions/saved-pois need user FK satisfied. */
export async function seedUser(db: D1Database, email = 'user@test.com'): Promise<string> {
  const id = userIdFor(email);
  await db.prepare(
    'INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)'
  ).bind(id, email, email.split('@')[0]).run();
  return id;
}

/** 建立 mock auth context。V2 cutover：userId 從 email 衍生，呼叫端應先 seedUser(email)。 */
export function mockAuth(overrides: Partial<AuthData> = {}): AuthData {
  const email = overrides.email ?? 'user@test.com';
  return {
    email,
    userId: overrides.userId ?? userIdFor(email),
    isAdmin: false,
    isServiceToken: false,
    ...overrides,
  };
}

/** 建立 mock EventContext（用於直接呼叫 handler） */
export function mockContext(options: {
  request: Request;
  env: Env;
  auth?: AuthData;
  params?: Record<string, string>;
}) {
  const data: Record<string, unknown> = {};
  if (options.auth) {
    data.auth = options.auth;
  }
  const waitUntilPromises: Promise<unknown>[] = [];
  return {
    request: options.request,
    env: options.env,
    params: options.params || {},
    data,
    waitUntil: (p: Promise<unknown>) => { waitUntilPromises.push(p); },
    passThroughOnException: () => {},
    next: () => Promise.resolve(new Response('next')),
    functionPath: '',
    _waitUntilPromises: waitUntilPromises,
  } as unknown as EventContext<Env, string, Record<string, unknown>>;
}

/** 建立帶 JSON body 的 Request */
export function jsonRequest(
  url: string,
  method: string,
  body?: unknown,
  headers?: Record<string, string>,
): Request {
  const opts: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://trip-planner-dby.pages.dev',
      ...headers,
    },
  };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }
  return new Request(url, opts);
}

/** 插入測試行程 + 天 + 權限。
 *  V2 cutover (migration 0047): trips.owner / trip_permissions.email columns dropped。
 *  helper 自動 INSERT users row + 用 user_id-keyed schema。 */
export async function seedTrip(db: D1Database, opts: {
  id?: string;
  owner?: string;
  days?: number;
  published?: number;
} = {}) {
  const id = opts.id || 'test-trip';
  const ownerEmail = opts.owner || 'user@test.com';
  const days = opts.days || 3;
  const published = opts.published ?? 1;
  const ownerUserId = `test-user-${ownerEmail.replace(/[^a-z0-9]/gi, '-')}`;

  await db.prepare(
    'INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)'
  ).bind(ownerUserId, ownerEmail, ownerEmail.split('@')[0]).run();

  await db.prepare(
    'INSERT OR IGNORE INTO trips (id, name, owner_user_id, title, countries, published) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, id, ownerUserId, `Test Trip ${id}`, 'JP', published).run();

  for (let i = 1; i <= days; i++) {
    await db.prepare(
      'INSERT OR IGNORE INTO trip_days (trip_id, day_num, date, day_of_week, label) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, i, `2026-04-0${i}`, '月', `Day ${i}`).run();
  }

  await db.prepare(
    'INSERT OR IGNORE INTO trip_permissions (user_id, trip_id, role) VALUES (?, ?, ?)'
  ).bind(ownerUserId, id, 'owner').run();

  return { id, owner: ownerEmail, ownerUserId };
}

/** 插入測試 entry（Phase 3：不再有 location 欄位；spatial 走 poi_id JOIN pois） */
export async function seedEntry(db: D1Database, dayId: number, opts: {
  sortOrder?: number;
  title?: string;
  travelType?: string | null;
  travelDesc?: string | null;
  travelMin?: number | null;
  poiId?: number | null;
} = {}) {
  const result = await db.prepare(
    `INSERT INTO trip_entries (day_id, sort_order, time, title, travel_type, travel_desc, travel_min, poi_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  ).bind(
    dayId,
    opts.sortOrder ?? 1,
    '10:00',
    opts.title || 'Test Entry',
    opts.travelType ?? null,
    opts.travelDesc ?? null,
    opts.travelMin ?? null,
    opts.poiId ?? null,
  ).first<{ id: number }>();
  return result!.id;
}

/** 插入測試 POI */
export async function seedPoi(db: D1Database, opts: {
  type?: string;
  name?: string;
} = {}) {
  const result = await db.prepare(
    'INSERT INTO pois (type, name) VALUES (?, ?) RETURNING id'
  ).bind(opts.type || 'restaurant', opts.name || 'Test POI').first<{ id: number }>();
  return result!.id;
}

/** 取得 trip_days 的 id */
export async function getDayId(db: D1Database, tripId: string, dayNum: number): Promise<number> {
  const row = await db.prepare(
    'SELECT id FROM trip_days WHERE trip_id = ? AND day_num = ?'
  ).bind(tripId, dayNum).first<{ id: number }>();
  return row!.id;
}

/** 插入測試 trip_pois 關聯。
 * hotel context 的 entry_id 可為 null（attached to day, not entry）。
 */
export async function seedTripPoi(db: D1Database, opts: {
  poiId: number;
  tripId: string;
  entryId: number | null;
  dayId: number;
  context?: 'timeline' | 'hotel' | 'shopping';
  sortOrder?: number;
  must_buy?: string | null;
}) {
  const result = await db.prepare(
    `INSERT INTO trip_pois (poi_id, trip_id, entry_id, day_id, sort_order, context, must_buy)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  ).bind(
    opts.poiId,
    opts.tripId,
    opts.entryId,
    opts.dayId,
    opts.sortOrder ?? 0,
    opts.context ?? 'timeline',
    opts.must_buy ?? null,
  ).first<{ id: number }>();
  return result!.id;
}
