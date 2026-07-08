/**
 * /api/account/notifications — user notification preference management.
 */
import { describe, it, expect, vi } from 'vitest';
import { onRequestGet, onRequestPatch } from '../../functions/api/account/notifications';
import { issueSession } from '../../functions/api/_session';

interface MockEnv {
  SESSION_SECRET?: string;
  DB?: { prepare: ReturnType<typeof vi.fn> };
}

function makeStmt(firstResult: unknown = null, runResult: unknown = { meta: { changes: 1 } }) {
  return {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(firstResult),
    run: vi.fn().mockResolvedValue(runResult),
    all: vi.fn().mockResolvedValue({ results: [] }),
  };
}

async function makeAuthedRequest(
  url: string,
  method: 'GET' | 'PATCH',
  body?: unknown,
): Promise<Request> {
  const r = new Response(null);
  await issueSession(
    new Request('https://x.com', { headers: { 'CF-Connecting-IP': '1.1.1.1' } }),
    r,
    'user-1',
    { SESSION_SECRET: 'test-secret-32-chars-long-enough' } as never,
  );
  const setCookie = r.headers.get('Set-Cookie') ?? '';
  const sessionCookie = setCookie.split(';')[0] ?? '';
  return new Request(url, {
    method,
    headers: { Cookie: sessionCookie, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function makeContext<T extends typeof onRequestGet | typeof onRequestPatch>(
  request: Request,
  env: MockEnv,
): Parameters<T>[0] {
  return {
    request,
    env: env as unknown as never,
    params: {} as unknown as never,
    data: {} as unknown as never,
    next: () => Promise.resolve(new Response()),
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
  } as unknown as Parameters<T>[0];
}

describe('GET /api/account/notifications', () => {
  it('401 when no session', async () => {
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: vi.fn() } };
    const req = new Request('https://x.com/api/account/notifications', { method: 'GET' });
    await expect(onRequestGet(makeContext<typeof onRequestGet>(req, env)))
      .rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('returns default enabled preferences when no row exists', async () => {
    const stmt = makeStmt(null);
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: vi.fn().mockReturnValue(stmt) },
    };
    const req = await makeAuthedRequest('https://x.com/api/account/notifications', 'GET');
    const res = await onRequestGet(makeContext<typeof onRequestGet>(req, env));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      preferences: {
        tripUpdates: true,
        invitations: true,
        system: true,
        updatedAt: null,
      },
    });
    expect(stmt.bind).toHaveBeenCalledWith('user-1');
  });

  it('maps stored integer flags to booleans', async () => {
    const stmt = makeStmt({
      trip_updates: 0,
      invitations: 1,
      system: 0,
      updated_at: '2026-07-09T00:00:00Z',
    });
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: vi.fn().mockReturnValue(stmt) },
    };
    const req = await makeAuthedRequest('https://x.com/api/account/notifications', 'GET');
    const res = await onRequestGet(makeContext<typeof onRequestGet>(req, env));
    expect(await res.json()).toEqual({
      preferences: {
        tripUpdates: false,
        invitations: true,
        system: false,
        updatedAt: '2026-07-09T00:00:00Z',
      },
    });
  });
});

describe('PATCH /api/account/notifications', () => {
  it('rejects non-boolean preference values', async () => {
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: vi.fn() } };
    const req = await makeAuthedRequest('https://x.com/api/account/notifications', 'PATCH', {
      tripUpdates: 'yes',
    });
    await expect(onRequestPatch(makeContext<typeof onRequestPatch>(req, env)))
      .rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });

  it('rejects null bodies as validation errors', async () => {
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: vi.fn() } };
    const req = await makeAuthedRequest('https://x.com/api/account/notifications', 'PATCH', null);
    await expect(onRequestPatch(makeContext<typeof onRequestPatch>(req, env)))
      .rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });

  it('returns a stable database error when the preferences table is not ready', async () => {
    const selectStmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockRejectedValue(new Error('D1_ERROR: no such table: account_notification_preferences')),
      run: vi.fn(),
      all: vi.fn(),
    };
    const upsertStmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn().mockRejectedValue(new Error('D1_ERROR: no such table: account_notification_preferences')),
      all: vi.fn(),
    };
    const prepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT trip_updates')) return selectStmt;
      if (sql.includes('INSERT INTO account_notification_preferences')) return upsertStmt;
      return makeStmt();
    });
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare },
    };
    const req = await makeAuthedRequest('https://x.com/api/account/notifications', 'PATCH', {
      system: false,
    });
    await expect(onRequestPatch(makeContext<typeof onRequestPatch>(req, env)))
      .rejects.toMatchObject({ code: 'SYS_DB_ERROR' });
  });

  it('merges with stored preferences and upserts a full row', async () => {
    const selectStmt = makeStmt({
      trip_updates: 1,
      invitations: 1,
      system: 0,
      updated_at: '2026-07-08T00:00:00Z',
    });
    const upsertStmt = makeStmt(null);
    const prepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT trip_updates')) return selectStmt;
      if (sql.includes('INSERT INTO account_notification_preferences')) return upsertStmt;
      return makeStmt();
    });
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare },
    };
    const req = await makeAuthedRequest('https://x.com/api/account/notifications', 'PATCH', {
      invitations: false,
    });
    const res = await onRequestPatch(makeContext<typeof onRequestPatch>(req, env));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      preferences: {
        tripUpdates: true,
        invitations: false,
        system: false,
      },
    });
    expect(upsertStmt.bind).toHaveBeenCalledWith(
      'user-1',
      1,
      0,
      0,
      expect.any(String),
    );
  });
});
