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

  it('400 SIGNUP_INVALID_PASSWORD when password < 8 chars', async () => {
    const env: MockEnv = { SESSION_SECRET: 's', DB: { prepare: vi.fn() } };
    const res = await onRequestPost(makeContext({ email: 'a@b.com', password: 'short' }, env));
    expect(res.status).toBe(400);
    expect((await res.json() as { error: { code: string } }).error.code).toBe('SIGNUP_INVALID_PASSWORD');
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

    // First DB call should be lookup with lowercased email
    const firstStmt = dbPrepare.mock.results[0].value;
    expect(firstStmt.bind).toHaveBeenCalledWith('mixed.case@example.com');
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
});
