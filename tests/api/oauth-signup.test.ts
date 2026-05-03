/* TODO v2.20.1 — V2 cutover (migration 0046+0047) 改 schema：trips.owner / trip_permissions.email / saved_pois.email columns dropped。本檔 pin 舊 schema SQL 字串斷言，需語意級 rewrite。 */
/**
 * POST /api/oauth/signup unit test — V2-P2
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost } from '../../functions/api/oauth/signup';

interface MockEnv {
  SESSION_SECRET?: string;
  DB?: { prepare: ReturnType<typeof vi.fn> };
}

function makeStmt(firstResult: unknown = null, runError?: Error) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(firstResult),
    run: vi.fn().mockImplementation(() => runError ? Promise.reject(runError) : Promise.resolve({ meta: { changes: 1 } })),
  };
  return stmt;
}

function makeContext(body: unknown, env: MockEnv): Parameters<typeof onRequestPost>[0] {
  return {
    request: new Request('https://x.com/api/oauth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: env as unknown as never,
    params: {} as unknown as never,
    data: {} as unknown as never,
    next: () => Promise.resolve(new Response()),
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
  } as unknown as Parameters<typeof onRequestPost>[0];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-25T00:00:00Z'));
});

describe('POST /api/oauth/signup', () => {
  it('400 SIGNUP_INVALID_EMAIL when email missing or invalid', async () => {
    const env: MockEnv = { SESSION_SECRET: 's', DB: { prepare: vi.fn() } };
    const r1 = await onRequestPost(makeContext({ password: 'longenough' }, env));
    expect(r1.status).toBe(400);
    expect((await r1.json() as { error: { code: string } }).error.code).toBe('SIGNUP_INVALID_EMAIL');

    const r2 = await onRequestPost(makeContext({ email: 'not-an-email', password: 'longenough' }, env));
    expect(r2.status).toBe(400);
    expect((await r2.json() as { error: { code: string } }).error.code).toBe('SIGNUP_INVALID_EMAIL');
  });

  it('400 SIGNUP_PASSWORD_TOO_SHORT when password < 8 chars', async () => {
    const env: MockEnv = { SESSION_SECRET: 's', DB: { prepare: vi.fn() } };
    const res = await onRequestPost(makeContext({ email: 'a@b.com', password: 'short' }, env));
    expect(res.status).toBe(400);
    expect((await res.json() as { error: { code: string } }).error.code).toBe('SIGNUP_PASSWORD_TOO_SHORT');
  });

  it('409 SIGNUP_EMAIL_TAKEN when email already in users', async () => {
    const stmt = makeStmt({ id: 'existing-uid' }); // SELECT users WHERE email returns existing
    const env: MockEnv = {
      SESSION_SECRET: 's',
      DB: { prepare: vi.fn().mockReturnValue(stmt) },
    };
    const res = await onRequestPost(makeContext({ email: 'taken@example.com', password: 'longenough' }, env));
    expect(res.status).toBe(409);
    expect((await res.json() as { error: { code: string } }).error.code).toBe('SIGNUP_EMAIL_TAKEN');
  });

  it('happy path: 201 + INSERT users + INSERT auth_identities + Set-Cookie', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT id FROM users')) return makeStmt(null); // not taken
      if (sql.includes('INSERT INTO users')) return makeStmt();
      if (sql.includes('INSERT INTO auth_identities')) return makeStmt();
      return makeStmt();
    });
    const env: MockEnv = {
      SESSION_SECRET: 'session-secret-test-32-chars-long',
      DB: { prepare: dbPrepare },
    };
    const res = await onRequestPost(makeContext({
      email: 'new@example.com',
      password: 'a-secure-password-1234',
      displayName: 'New User',
    }, env));

    expect(res.status).toBe(201);
    const json = await res.json() as { ok: boolean; userId: string; email: string; requiresVerification: boolean };
    expect(json.ok).toBe(true);
    expect(json.email).toBe('new@example.com');
    expect(json.requiresVerification).toBe(true);
    expect(typeof json.userId).toBe('string');

    expect(res.headers.get('Set-Cookie')).toMatch(/tripline_session=/);

    // Verify INSERT calls happened
    const calls = dbPrepare.mock.calls.map((c) => c[0] as string);
    expect(calls.some((s) => s.includes('INSERT INTO users'))).toBe(true);
    expect(calls.some((s) => s.includes('INSERT INTO auth_identities'))).toBe(true);
  }, 30_000); // PBKDF2 600k iter takes time

  it('email lowercased + trimmed before INSERT', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT id FROM users')) return makeStmt(null);
      return makeStmt();
    });
    const env: MockEnv = {
      SESSION_SECRET: 'session-secret-test',
      DB: { prepare: dbPrepare },
    };
    await onRequestPost(makeContext({
      email: '  Mixed.Case@EXAMPLE.com  ',
      password: 'password123',
    }, env));

    // Find the user-lookup stmt by SQL pattern (rate limit calls now precede it)
    const userLookupIdx = dbPrepare.mock.calls.findIndex(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('SELECT id FROM users'),
    );
    expect(userLookupIdx).toBeGreaterThanOrEqual(0);
    const lookupStmt = dbPrepare.mock.results[userLookupIdx].value;
    expect(lookupStmt.bind).toHaveBeenCalledWith('mixed.case@example.com');
  }, 30_000);

  it('UNIQUE constraint race condition → 409 SIGNUP_EMAIL_TAKEN', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT id FROM users')) return makeStmt(null);
      if (sql.includes('INSERT INTO users')) {
        return makeStmt(null, new Error('UNIQUE constraint failed: users.email'));
      }
      return makeStmt();
    });
    const env: MockEnv = {
      SESSION_SECRET: 's',
      DB: { prepare: dbPrepare },
    };
    const res = await onRequestPost(makeContext({
      email: 'race@example.com',
      password: 'longenough',
    }, env));
    expect(res.status).toBe(409);
    expect((await res.json() as { error: { code: string } }).error.code).toBe('SIGNUP_EMAIL_TAKEN');
  }, 30_000);

  it('429 SIGNUP_RATE_LIMITED when IP bucket locked', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM rate_limit_buckets')) {
        return makeStmt({
          bucket_key: 'signup:unknown',
          count: 4,
          window_start: Date.now(),
          locked_until: Date.now() + 60_000,
        });
      }
      return makeStmt();
    });
    const env: MockEnv = { SESSION_SECRET: 's', DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      email: 'a@b.com',
      password: 'longenough',
    }, env));
    expect(res.status).toBe(429);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('SIGNUP_RATE_LIMITED');
    expect(res.headers.get('Retry-After')).toBeTruthy();
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('Bumps signup ipKey bucket on every valid attempt (anti spam)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM rate_limit_buckets')) return makeStmt(null); // not locked
      if (sql.includes('SELECT id FROM users')) return makeStmt({ id: 'existing' }); // dup → 409
      return makeStmt();
    });
    const env: MockEnv = { SESSION_SECRET: 's', DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      email: 'taken@example.com',
      password: 'longenough',
    }, env));
    // dup email → 409, but rate limit bucket should still be bumped
    expect(res.status).toBe(409);
    const inserts = dbPrepare.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT OR REPLACE INTO rate_limit_buckets'),
    );
    expect(inserts.length).toBe(1); // single ipKey bucket (no per-email for signup)
  });
});

/**
 * V2 共編邀請：signup with invitationToken — 註冊成功後自動接受邀請（若 token valid +
 * email match）。失敗（過期 / mismatch）不擋 signup，response 含 invitationError。
 */
describe('POST /api/oauth/signup with invitationToken', () => {
  const TEST_SECRET = 'session-secret-test-32-chars-long';

  it('happy path: 201 + joinedTrip + INSERT trip_permissions + UPDATE invitation accepted', async () => {
    let permissionInsertSeen = false;
    let invitationUpdateSeen = false;

    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM rate_limit_buckets')) return makeStmt(null);
      if (sql.includes('SELECT id FROM users')) return makeStmt(null);
      if (sql.includes('INSERT INTO users')) return makeStmt();
      if (sql.includes('INSERT INTO auth_identities')) return makeStmt();
      if (sql.includes('FROM trip_invitations')) {
        return makeStmt({
          trip_id: 'trip-1',
          invited_email: 'newperson@x.com',
          expires_at: '2026-05-04T00:00:00Z',
          accepted_at: null,
        });
      }
      if (sql.includes('SELECT title FROM trips')) {
        return makeStmt({ title: '沖繩 5 日' });
      }
      if (sql.includes('INSERT OR IGNORE INTO trip_permissions')) {
        permissionInsertSeen = true;
        return makeStmt();
      }
      if (sql.includes('UPDATE trip_invitations')) {
        invitationUpdateSeen = true;
        return makeStmt();
      }
      return makeStmt();
    });
    const dbBatch = vi.fn().mockResolvedValue([{ meta: { changes: 1 } }, { meta: { changes: 1 } }]);
    const env: MockEnv = {
      SESSION_SECRET: TEST_SECRET,
      DB: { prepare: dbPrepare, batch: dbBatch } as unknown as MockEnv['DB'],
    };
    const res = await onRequestPost(makeContext({
      email: 'newperson@x.com',
      password: 'longenough',
      invitationToken: 'raw-invite-token',
    }, env));

    expect(res.status).toBe(201);
    const json = await res.json() as {
      ok: boolean;
      joinedTrip: { id: string; title: string } | null;
      invitationError: string | null;
    };
    expect(json.joinedTrip).toEqual({ id: 'trip-1', title: '沖繩 5 日' });
    expect(json.invitationError).toBeNull();
    expect(permissionInsertSeen).toBe(true);
    expect(invitationUpdateSeen).toBe(true);
  });

  it('expired invitation: 201 signup success + invitationError=INVITATION_EXPIRED + joinedTrip=null', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM rate_limit_buckets')) return makeStmt(null);
      if (sql.includes('SELECT id FROM users')) return makeStmt(null);
      if (sql.includes('INSERT INTO users')) return makeStmt();
      if (sql.includes('INSERT INTO auth_identities')) return makeStmt();
      if (sql.includes('FROM trip_invitations')) {
        return makeStmt({
          trip_id: 'trip-1',
          invited_email: 'newperson@x.com',
          expires_at: '2026-04-20T00:00:00Z', // expired
          accepted_at: null,
        });
      }
      return makeStmt();
    });
    const env: MockEnv = { SESSION_SECRET: TEST_SECRET, DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      email: 'newperson@x.com',
      password: 'longenough',
      invitationToken: 'expired-token',
    }, env));

    expect(res.status).toBe(201);
    const json = await res.json() as {
      joinedTrip: unknown;
      invitationError: string;
    };
    expect(json.joinedTrip).toBeNull();
    expect(json.invitationError).toBe('INVITATION_EXPIRED');
  });

  it('email mismatch: 201 signup success + invitationError=INVITATION_EMAIL_MISMATCH + joinedTrip=null', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM rate_limit_buckets')) return makeStmt(null);
      if (sql.includes('SELECT id FROM users')) return makeStmt(null);
      if (sql.includes('INSERT INTO users')) return makeStmt();
      if (sql.includes('INSERT INTO auth_identities')) return makeStmt();
      if (sql.includes('FROM trip_invitations')) {
        return makeStmt({
          trip_id: 'trip-1',
          invited_email: 'someone-else@x.com', // different
          expires_at: '2026-05-04T00:00:00Z',
          accepted_at: null,
        });
      }
      return makeStmt();
    });
    const env: MockEnv = { SESSION_SECRET: TEST_SECRET, DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      email: 'newperson@x.com',
      password: 'longenough',
      invitationToken: 'wrong-email-token',
    }, env));

    expect(res.status).toBe(201);
    const json = await res.json() as { invitationError: string; joinedTrip: unknown };
    expect(json.invitationError).toBe('INVITATION_EMAIL_MISMATCH');
    expect(json.joinedTrip).toBeNull();
  });

  it('invalid token: 201 signup success + invitationError=INVITATION_INVALID', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM rate_limit_buckets')) return makeStmt(null);
      if (sql.includes('SELECT id FROM users')) return makeStmt(null);
      if (sql.includes('INSERT INTO users')) return makeStmt();
      if (sql.includes('INSERT INTO auth_identities')) return makeStmt();
      if (sql.includes('FROM trip_invitations')) return makeStmt(null);
      return makeStmt();
    });
    const env: MockEnv = { SESSION_SECRET: TEST_SECRET, DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      email: 'newperson@x.com',
      password: 'longenough',
      invitationToken: 'bogus',
    }, env));

    expect(res.status).toBe(201);
    const json = await res.json() as { invitationError: string };
    expect(json.invitationError).toBe('INVITATION_INVALID');
  });

  it('no invitationToken: backward compat — joinedTrip + invitationError both null/undefined', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM rate_limit_buckets')) return makeStmt(null);
      if (sql.includes('SELECT id FROM users')) return makeStmt(null);
      if (sql.includes('INSERT INTO users')) return makeStmt();
      if (sql.includes('INSERT INTO auth_identities')) return makeStmt();
      return makeStmt();
    });
    const env: MockEnv = { SESSION_SECRET: TEST_SECRET, DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      email: 'newperson@x.com',
      password: 'longenough',
    }, env));

    expect(res.status).toBe(201);
    const json = await res.json() as { joinedTrip: unknown; invitationError: unknown };
    // both nullish OK
    expect(json.joinedTrip ?? null).toBeNull();
    expect(json.invitationError ?? null).toBeNull();

    // Did NOT touch trip_invitations
    const inviteCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('FROM trip_invitations'),
    );
    expect(inviteCall).toBeFalsy();
  });
});
