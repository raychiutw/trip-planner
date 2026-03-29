/**
 * API Test Helpers — 共用 mock 建構工具
 */
import type { Env, AuthData } from '../../functions/api/_types';

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

/** 建立 mock auth context */
export function mockAuth(overrides: Partial<AuthData> = {}): AuthData {
  return {
    email: 'user@test.com',
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

/** 插入測試行程 + 天 + 權限 */
export async function seedTrip(db: D1Database, opts: {
  id?: string;
  owner?: string;
  days?: number;
  published?: number;
} = {}) {
  const id = opts.id || 'test-trip';
  const owner = opts.owner || 'user@test.com';
  const days = opts.days || 3;
  const published = opts.published ?? 1;

  await db.prepare(
    'INSERT OR IGNORE INTO trips (id, name, owner, title, self_drive, countries, published) VALUES (?, ?, ?, ?, 0, ?, ?)'
  ).bind(id, id, owner, `Test Trip ${id}`, 'JP', published).run();

  for (let i = 1; i <= days; i++) {
    await db.prepare(
      'INSERT OR IGNORE INTO trip_days (trip_id, day_num, date, day_of_week, label) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, i, `2026-04-0${i}`, '月', `Day ${i}`).run();
  }

  await db.prepare(
    'INSERT OR IGNORE INTO trip_permissions (email, trip_id, role) VALUES (?, ?, ?)'
  ).bind(owner, id, 'admin').run();

  return { id, owner };
}

/** 插入測試 entry */
export async function seedEntry(db: D1Database, dayId: number, opts: {
  sortOrder?: number;
  title?: string;
} = {}) {
  const result = await db.prepare(
    'INSERT INTO trip_entries (day_id, sort_order, time, title) VALUES (?, ?, ?, ?) RETURNING id'
  ).bind(dayId, opts.sortOrder || 1, '10:00', opts.title || 'Test Entry').first<{ id: number }>();
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
