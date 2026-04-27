/**
 * GET /api/invitations?tripId=xxx (list pending) + POST /api/invitations/revoke
 * — V2 共編 CollabSheet pending UI 後端 endpoints
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet as rawOnRequestGet } from '../../functions/api/invitations';
import { onRequestPost as rawOnRevoke } from '../../functions/api/invitations/revoke';
import { AppError, errorResponse } from '../../functions/api/_errors';

async function onRequestGet(ctx: Parameters<typeof rawOnRequestGet>[0]): Promise<Response> {
  try {
    return await rawOnRequestGet(ctx);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    throw err;
  }
}

async function onRevoke(ctx: Parameters<typeof rawOnRevoke>[0]): Promise<Response> {
  try {
    return await rawOnRevoke(ctx);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    throw err;
  }
}

interface MockEnv {
  DB?: { prepare: ReturnType<typeof vi.fn> };
}

function makeStmt(firstResult: unknown = null, allResults: unknown[] = []) {
  return {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(firstResult),
    all: vi.fn().mockResolvedValue({ results: allResults }),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  };
}

function makeListContext(
  query: string,
  env: MockEnv,
  auth: { email: string; isAdmin: boolean } | null = { email: 'owner@x.com', isAdmin: false },
): Parameters<typeof onRequestGet>[0] {
  return {
    request: new Request(`https://x.com/api/invitations?${query}`, { method: 'GET' }),
    env: env as unknown as never,
    params: {} as unknown as never,
    data: (auth ? { auth } : {}) as unknown as never,
    next: () => Promise.resolve(new Response()),
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
  } as unknown as Parameters<typeof onRequestGet>[0];
}

function makeRevokeContext(
  body: unknown,
  env: MockEnv,
  auth: { email: string; isAdmin: boolean } | null = { email: 'owner@x.com', isAdmin: false },
): Parameters<typeof onRevoke>[0] {
  return {
    request: new Request('https://x.com/api/invitations/revoke', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: env as unknown as never,
    params: {} as unknown as never,
    data: (auth ? { auth } : {}) as unknown as never,
    next: () => Promise.resolve(new Response()),
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
  } as unknown as Parameters<typeof onRevoke>[0];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-27T10:00:00Z'));
});

describe('GET /api/invitations?tripId=xxx (list pending)', () => {
  it('401 AUTH_REQUIRED when no auth', async () => {
    const env: MockEnv = { DB: { prepare: vi.fn() } };
    const res = await onRequestGet(makeListContext('tripId=trip-1', env, null));
    expect(res.status).toBe(401);
  });

  it('403 PERM_ADMIN_ONLY when not owner / not admin', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT owner FROM trips')) return makeStmt({ owner: 'someone-else@x.com' });
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestGet(
      makeListContext('tripId=trip-1', env, { email: 'random@x.com', isAdmin: false }),
    );
    expect(res.status).toBe(403);
  });

  it('200 returns pending invitations with id (token_hash) + daysRemaining', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT owner FROM trips')) return makeStmt({ owner: 'owner@x.com' });
      if (sql.includes('FROM trip_invitations') && sql.includes('accepted_at IS NULL')) {
        return makeStmt(null, [
          {
            token_hash: 'hash-1',
            invited_email: 'a@x.com',
            created_at: '2026-04-26T10:00:00Z',
            expires_at: '2026-05-03T10:00:00Z', // 6 days remaining (from 2026-04-27)
          },
          {
            token_hash: 'hash-2',
            invited_email: 'b@x.com',
            created_at: '2026-04-25T10:00:00Z',
            expires_at: '2026-04-26T10:00:00Z', // already expired
          },
        ]);
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestGet(makeListContext('tripId=trip-1', env));
    expect(res.status).toBe(200);
    const json = await res.json() as {
      items: Array<{
        id: string;
        invitedEmail: string;
        daysRemaining: number;
        isExpired: boolean;
      }>;
    };
    expect(json.items).toHaveLength(2);
    expect(json.items[0]!.id).toBe('hash-1');
    expect(json.items[0]!.invitedEmail).toBe('a@x.com');
    expect(json.items[0]!.daysRemaining).toBe(6);
    expect(json.items[0]!.isExpired).toBe(false);
    expect(json.items[1]!.isExpired).toBe(true);
    expect(json.items[1]!.daysRemaining).toBe(0);
  });

  it('SQL filters accepted_at IS NULL (only pending, not historical)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT owner FROM trips')) return makeStmt({ owner: 'owner@x.com' });
      if (sql.includes('FROM trip_invitations')) return makeStmt(null, []);
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    await onRequestGet(makeListContext('tripId=trip-1', env));
    const inviteCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('FROM trip_invitations'),
    );
    expect(inviteCall).toBeTruthy();
    expect(inviteCall![0] as string).toContain('accepted_at IS NULL');
  });

  it('既有 ?token=xxx 路徑仍正常運作（regression check）', async () => {
    const env: MockEnv = { DB: { prepare: vi.fn().mockReturnValue(makeStmt(null)) } };
    const res = await onRequestGet(makeListContext('token=fake', { ...env, SESSION_SECRET: 's' } as MockEnv & { SESSION_SECRET: string }, null));
    // No ?tripId branch → falls into ?token branch → 410 INVITATION_INVALID (token not found)
    expect(res.status).toBe(410);
  });
});

describe('POST /api/invitations/revoke', () => {
  it('401 AUTH_REQUIRED when no auth', async () => {
    const env: MockEnv = { DB: { prepare: vi.fn() } };
    const res = await onRevoke(makeRevokeContext({ tripId: 't', email: 'e@x.com' }, env, null));
    expect(res.status).toBe(401);
  });

  it('400 INVITATION_REVOKE_VALIDATION when missing tripId or email', async () => {
    const env: MockEnv = { DB: { prepare: vi.fn() } };
    const res = await onRevoke(makeRevokeContext({ tripId: 't' }, env));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('INVITATION_REVOKE_VALIDATION');
  });

  it('403 PERM_ADMIN_ONLY when not owner / not admin', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT owner FROM trips')) return makeStmt({ owner: 'someone-else@x.com' });
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRevoke(
      makeRevokeContext({ tripId: 'trip-1', email: 'inv@x.com' }, env, { email: 'random@x.com', isAdmin: false }),
    );
    expect(res.status).toBe(403);
  });

  it('404 INVITATION_NOT_FOUND when no pending invitation matches', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT owner FROM trips')) return makeStmt({ owner: 'owner@x.com' });
      if (sql.includes('DELETE FROM trip_invitations')) {
        const stmt = makeStmt();
        stmt.run = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
        return stmt;
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRevoke(
      makeRevokeContext({ tripId: 'trip-1', email: 'inv@x.com' }, env),
    );
    expect(res.status).toBe(404);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('INVITATION_NOT_FOUND');
  });

  it('200 + DELETE row when pending invitation exists', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT owner FROM trips')) return makeStmt({ owner: 'owner@x.com' });
      if (sql.includes('DELETE FROM trip_invitations')) {
        const stmt = makeStmt();
        stmt.run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
        return stmt;
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRevoke(
      makeRevokeContext({ tripId: 'trip-1', email: 'inv@x.com' }, env),
    );
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; revoked: number };
    expect(json.ok).toBe(true);
    expect(json.revoked).toBe(1);
  });

  it('email lowercased before DELETE', async () => {
    const deleteStmt = makeStmt();
    deleteStmt.run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT owner FROM trips')) return makeStmt({ owner: 'owner@x.com' });
      if (sql.includes('DELETE FROM trip_invitations')) return deleteStmt;
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    await onRevoke(
      makeRevokeContext({ tripId: 'trip-1', email: 'Mixed@X.com' }, env),
    );
    expect(deleteStmt.bind).toHaveBeenCalledWith('trip-1', 'mixed@x.com');
  });

  it('SQL filters accepted_at IS NULL (only pending, not already-accepted)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT owner FROM trips')) return makeStmt({ owner: 'owner@x.com' });
      if (sql.includes('DELETE FROM trip_invitations')) {
        const stmt = makeStmt();
        stmt.run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
        return stmt;
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    await onRevoke(
      makeRevokeContext({ tripId: 'trip-1', email: 'inv@x.com' }, env),
    );
    const deleteCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('DELETE FROM trip_invitations'),
    );
    expect(deleteCall![0] as string).toContain('accepted_at IS NULL');
  });
});
