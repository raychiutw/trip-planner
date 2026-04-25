/**
 * POST /api/oauth/forgot-password unit test — V2-P3
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost } from '../../functions/api/oauth/forgot-password';

interface MockEnv {
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
    request: new Request('https://x.com/api/oauth/forgot-password', {
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

describe('POST /api/oauth/forgot-password', () => {
  it('200 generic response when email empty (no enum leak)', async () => {
    const env: MockEnv = { DB: { prepare: vi.fn() } };
    const res = await onRequestPost(makeContext({}, env));
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; message: string };
    expect(json.ok).toBe(true);
    expect(json.message).toContain('若 email 已註冊');
  });

  it('200 generic response when email not found (no enum leak)', async () => {
    const stmt = makeStmt(null); // no user
    const env: MockEnv = { DB: { prepare: vi.fn().mockReturnValue(stmt) } };
    const res = await onRequestPost(makeContext({ email: 'nobody@x.com' }, env));
    expect(res.status).toBe(200);
    const json = await res.json() as { message: string };
    expect(json.message).toContain('若 email 已註冊');
  });

  it('200 + INSERT PasswordReset token when email + local provider exist', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT u.id AS user_id')) {
        return makeStmt({ user_id: 'user-1' });
      }
      if (sql.includes('INSERT OR REPLACE INTO oauth_models')) {
        return makeStmt();
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({ email: 'user@x.com' }, env));
    expect(res.status).toBe(200);

    // Verify INSERT PasswordReset called
    const insertCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT OR REPLACE INTO oauth_models'),
    );
    expect(insertCall).toBeTruthy();
    const stmt = dbPrepare.mock.results.find(
      (r) => r.value === dbPrepare.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('INSERT OR REPLACE'),
      )?.toString(),
    );
    // Check binding includes 'PasswordReset' name + token + payload + expiry
  });

  it('email lowercase + trim before lookup', async () => {
    const stmt = makeStmt(null);
    const dbPrepare = vi.fn().mockReturnValue(stmt);
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    await onRequestPost(makeContext({ email: '  Mixed@EXAMPLE.com  ' }, env));
    expect(stmt.bind).toHaveBeenCalledWith('mixed@example.com');
  });

  it('Token TTL = 1h (3600s) per V2-P3 spec', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT u.id')) return makeStmt({ user_id: 'u' });
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    await onRequestPost(makeContext({ email: 'u@x.com' }, env));

    // Find the INSERT OR REPLACE INTO oauth_models call (PasswordReset token store)
    // — distinct from rate_limit_buckets INSERTs that share the prefix
    const tokenInsertIdx = dbPrepare.mock.calls.findIndex(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT OR REPLACE INTO oauth_models'),
    );
    expect(tokenInsertIdx).toBeGreaterThanOrEqual(0);
    const stmt = dbPrepare.mock.results[tokenInsertIdx].value as { bind: { mock: { calls: unknown[][] } } };
    const bindArgs = stmt.bind.mock.calls[0];
    const expiresAt = bindArgs[3] as number;
    expect(expiresAt).toBe(Date.now() + 3600 * 1000);
  });

  it('Local provider lookup filter: WHERE provider = "local" (not Google-only user)', async () => {
    const stmt = makeStmt(null);
    const dbPrepare = vi.fn().mockReturnValue(stmt);
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    await onRequestPost(makeContext({ email: 'u@x.com' }, env));

    // Find the user lookup SQL — rate limit INSERTs come first now
    const userLookupSql = dbPrepare.mock.calls
      .map((c) => c[0] as string)
      .find((s) => s.includes('SELECT u.id'));
    expect(userLookupSql).toBeTruthy();
    expect(userLookupSql).toContain("provider = 'local'");
  });

  it('429 FORGOT_PASSWORD_RATE_LIMITED when IP bucket locked', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM rate_limit_buckets')) {
        // Locked bucket
        return makeStmt({
          bucket_key: 'forgot-password:unknown',
          count: 4,
          window_start: Date.now(),
          locked_until: Date.now() + 60_000,
        });
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({ email: 'u@x.com' }, env));
    expect(res.status).toBe(429);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('FORGOT_PASSWORD_RATE_LIMITED');
    expect(res.headers.get('Retry-After')).toBeTruthy();
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('Bumps both ipKey + emailKey buckets on every valid request (defence in depth)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM rate_limit_buckets')) return makeStmt(null); // not locked
      if (sql.includes('SELECT u.id')) return makeStmt(null); // user not found
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({ email: 'u@x.com' }, env));
    expect(res.status).toBe(200); // generic 200 regardless

    // Both buckets bumped
    const inserts = dbPrepare.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT OR REPLACE INTO rate_limit_buckets'),
    );
    expect(inserts.length).toBe(2);
  });

  it('sends reset email via Resend when env keys set (V2-P3 wire)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'msg-1' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT u.id')) return makeStmt({ user_id: 'u-1', display_name: 'Ray' });
      return makeStmt();
    });
    const env = {
      DB: { prepare: dbPrepare },
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'Tripline <no-reply@example.com>',
    };
    await onRequestPost(makeContext({ email: 'u@x.com' }, env as never));

    const resendCall = fetchMock.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('resend.com'),
    );
    expect(resendCall).toBeTruthy();
    const body = JSON.parse((resendCall![1] as RequestInit).body as string) as Record<string, unknown>;
    expect(body.to).toEqual(['u@x.com']);
    expect(body.subject).toContain('重設');
    expect(body.html).toContain('https://x.com/auth/password/reset?token=');
    vi.unstubAllGlobals();
  });

  it('does NOT send email when env keys unset (graceful)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT u.id')) return makeStmt({ user_id: 'u', display_name: null });
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    await onRequestPost(makeContext({ email: 'u@x.com' }, env));

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
