/**
 * POST /api/oauth/login unit test — V2-P2
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost } from '../../functions/api/oauth/login';
import { hashPassword } from '../../src/server/password';

interface MockEnv {
  SESSION_SECRET?: string;
  DB?: { prepare: ReturnType<typeof vi.fn> };
}

function makeStmt(firstResult: unknown = null) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(firstResult),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  };
  return stmt;
}

function makeContext(body: unknown, env: MockEnv): Parameters<typeof onRequestPost>[0] {
  return {
    request: new Request('https://x.com/api/oauth/login', {
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

describe('POST /api/oauth/login', () => {
  it('400 LOGIN_INVALID_INPUT when email or password missing', async () => {
    const env: MockEnv = { SESSION_SECRET: 's', DB: { prepare: vi.fn() } };
    const r1 = await onRequestPost(makeContext({ email: 'a@b.com' }, env));
    expect(r1.status).toBe(400);
    expect((await r1.json() as { error: { code: string } }).error.code).toBe('LOGIN_INVALID_INPUT');
    const r2 = await onRequestPost(makeContext({ password: 'pwd123' }, env));
    expect(r2.status).toBe(400);
  });

  it('401 LOGIN_INVALID when email not found (generic — no enum leak)', async () => {
    const stmt = makeStmt(null); // no identity
    const env: MockEnv = {
      SESSION_SECRET: 's',
      DB: { prepare: vi.fn().mockReturnValue(stmt) },
    };
    const res = await onRequestPost(makeContext({ email: 'unknown@x.com', password: 'whatever' }, env));
    expect(res.status).toBe(401);
    expect((await res.json() as { error: { code: string } }).error.code).toBe('LOGIN_INVALID');
  }, 30_000);

  it('401 LOGIN_INVALID when password wrong', async () => {
    const real = await hashPassword('correct-pass');
    const stmt = makeStmt({ user_id: 'u1', password_hash: real });
    const env: MockEnv = {
      SESSION_SECRET: 's',
      DB: { prepare: vi.fn().mockReturnValue(stmt) },
    };
    const res = await onRequestPost(makeContext({ email: 'a@b.com', password: 'wrong-pass' }, env));
    expect(res.status).toBe(401);
    expect((await res.json() as { error: { code: string } }).error.code).toBe('LOGIN_INVALID');
  }, 60_000);

  it('happy path: 200 + Set-Cookie + last_used_at update', async () => {
    const real = await hashPassword('correct-pass');
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT user_id, password_hash')) {
        return makeStmt({ user_id: 'logged-in-uid', password_hash: real });
      }
      if (sql.includes('UPDATE auth_identities')) return makeStmt();
      return makeStmt();
    });
    const env: MockEnv = {
      SESSION_SECRET: 'session-secret-test',
      DB: { prepare: dbPrepare },
    };
    const res = await onRequestPost(makeContext({ email: 'a@b.com', password: 'correct-pass' }, env));
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; userId: string; email: string };
    expect(json.ok).toBe(true);
    expect(json.userId).toBe('logged-in-uid');
    expect(json.email).toBe('a@b.com');
    expect(res.headers.get('Set-Cookie')).toMatch(/tripline_session=/);

    // last_used_at UPDATE was called
    const calls = dbPrepare.mock.calls.map((c) => c[0] as string);
    expect(calls.some((s) => s.includes('UPDATE auth_identities'))).toBe(true);
  }, 60_000);

  it('email lowercase + trim before lookup', async () => {
    const stmt = makeStmt(null);
    const dbPrepare = vi.fn().mockReturnValue(stmt);
    const env: MockEnv = { SESSION_SECRET: 's', DB: { prepare: dbPrepare } };
    await onRequestPost(makeContext({ email: '  Mixed.Case@EXAMPLE.com  ', password: 'whatever' }, env));
    expect(stmt.bind).toHaveBeenCalledWith('local', 'mixed.case@example.com');
  }, 30_000);

  it('still 401 even if DB returns identity with NULL password_hash (e.g. only Google identity)', async () => {
    const stmt = makeStmt({ user_id: 'u1', password_hash: null }); // Google-only user attempting password login
    const env: MockEnv = { SESSION_SECRET: 's', DB: { prepare: vi.fn().mockReturnValue(stmt) } };
    const res = await onRequestPost(makeContext({ email: 'a@b.com', password: 'whatever' }, env));
    expect(res.status).toBe(401);
  }, 30_000);
});
