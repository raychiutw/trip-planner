/**
 * /api/oauth/verify + /api/oauth/send-verification — V2-P2 email verification
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet } from '../../functions/api/oauth/verify';
import { onRequestPost as onSendVerification } from '../../functions/api/oauth/send-verification';

interface MockEnv {
  DB?: { prepare: ReturnType<typeof vi.fn> };
}

function makeStmt(firstResult: unknown = null) {
  return {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(firstResult),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  };
}

function makeVerifyContext(query: string, env: MockEnv): Parameters<typeof onRequestGet>[0] {
  return {
    request: new Request(`https://x.com/api/oauth/verify?${query}`, { method: 'GET' }),
    env: env as unknown as never,
    params: {} as unknown as never,
    data: {} as unknown as never,
    next: () => Promise.resolve(new Response()),
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
  } as unknown as Parameters<typeof onRequestGet>[0];
}

function makeSendContext(body: unknown, env: MockEnv): Parameters<typeof onSendVerification>[0] {
  return {
    request: new Request('https://x.com/api/oauth/send-verification', {
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
  } as unknown as Parameters<typeof onSendVerification>[0];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-25T00:00:00Z'));
});

describe('GET /api/oauth/verify', () => {
  it('302 → /login?verify_error=missing_token when token query absent', async () => {
    const env: MockEnv = { DB: { prepare: vi.fn() } };
    const res = await onRequestGet(makeVerifyContext('', env));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/login?verify_error=missing_token');
  });

  it('302 → /login?verify_error=expired when token not found', async () => {
    const stmt = makeStmt(null); // adapter.find returns nothing
    const env: MockEnv = { DB: { prepare: vi.fn().mockReturnValue(stmt) } };
    const res = await onRequestGet(makeVerifyContext('token=fake-token', env));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/login?verify_error=expired');
  });

  it('302 → /login?verified=1 happy path + UPDATE email_verified_at', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT payload, expires_at FROM oauth_models')) {
        return makeStmt({
          payload: JSON.stringify({
            userId: 'u-1',
            email: 'u@x.com',
            createdAt: Date.now() - 1000,
            used: false,
          }),
          expires_at: Date.now() + 60_000,
        });
      }
      if (sql.includes('UPDATE users SET email_verified_at')) return makeStmt();
      if (sql.includes('DELETE FROM oauth_models')) return makeStmt();
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestGet(makeVerifyContext('token=valid-token', env));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/login?verified=1');

    // Assert UPDATE called
    const updateCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE users SET email_verified_at'),
    );
    expect(updateCall).toBeTruthy();
    // Assert DELETE called (one-time use)
    const deleteCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('DELETE FROM oauth_models'),
    );
    expect(deleteCall).toBeTruthy();
  });

  it('302 → /login?verify_error=expired when token expired (D1Adapter.find returns null)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT payload, expires_at FROM oauth_models')) {
        // Adapter find filters expired internally — null returned
        return makeStmt(null);
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestGet(makeVerifyContext('token=expired-token', env));
    expect(res.headers.get('Location')).toBe('/login?verify_error=expired');
  });

  it('does NOT destroy token if UPDATE fails (so user can retry)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT payload, expires_at FROM oauth_models')) {
        return makeStmt({
          payload: JSON.stringify({ userId: 'u', email: 'u@x.com', createdAt: 0, used: false }),
          expires_at: Date.now() + 60_000,
        });
      }
      if (sql.includes('UPDATE users SET email_verified_at')) {
        const stmt = makeStmt();
        stmt.run = vi.fn().mockRejectedValue(new Error('DB unavailable'));
        return stmt;
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestGet(makeVerifyContext('token=t', env));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/login?verify_error=server_error');

    // DELETE was NOT called (token preserved for retry)
    const deleteCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('DELETE FROM oauth_models'),
    );
    expect(deleteCall).toBeFalsy();
  });
});

describe('POST /api/oauth/send-verification', () => {
  it('200 generic response when email empty (no enum leak)', async () => {
    const env: MockEnv = { DB: { prepare: vi.fn() } };
    const res = await onSendVerification(makeSendContext({}, env));
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; message: string };
    expect(json.ok).toBe(true);
    expect(json.message).toContain('若帳號');
  });

  it('200 generic when email not found (no enum leak)', async () => {
    const stmt = makeStmt(null); // user not found
    const env: MockEnv = { DB: { prepare: vi.fn().mockReturnValue(stmt) } };
    const res = await onSendVerification(makeSendContext({ email: 'nobody@x.com' }, env));
    expect(res.status).toBe(200);
    // No INSERT — user not found means no token generated
  });

  it('200 generic when email already verified (silent no-op)', async () => {
    // Filter SQL excludes verified users → SELECT returns null
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM users') && sql.includes('email_verified_at IS NULL')) {
        // emulate WHERE email_verified_at IS NULL filter excluding verified user
        return makeStmt(null);
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onSendVerification(makeSendContext({ email: 'verified@x.com' }, env));
    expect(res.status).toBe(200);
    const insertCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT OR REPLACE INTO oauth_models'),
    );
    expect(insertCall).toBeFalsy();
  });

  it('200 + INSERT EmailVerification token when email is unverified user', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM users') && sql.includes('email_verified_at IS NULL')) {
        return makeStmt({ id: 'u-1', display_name: null });
      }
      if (sql.includes('INSERT OR REPLACE INTO oauth_models')) return makeStmt();
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onSendVerification(makeSendContext({ email: 'unverified@x.com' }, env));
    expect(res.status).toBe(200);

    // Verify INSERT called with name='EmailVerification'
    const insertIdx = dbPrepare.mock.calls.findIndex(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT OR REPLACE INTO oauth_models'),
    );
    expect(insertIdx).toBeGreaterThanOrEqual(0);
    const insertStmt = dbPrepare.mock.results[insertIdx].value as { bind: { mock: { calls: unknown[][] } } };
    const bindArgs = insertStmt.bind.mock.calls[0];
    expect(bindArgs[0]).toBe('EmailVerification'); // name
    // bindArgs[1] = id (token), bindArgs[2] = payload JSON, bindArgs[3] = expires_at
    expect(bindArgs[3]).toBe(Date.now() + 24 * 60 * 60 * 1000); // 24h TTL
  });

  it('Filters by email_verified_at IS NULL (only unverified users get tokens)', async () => {
    const stmt = makeStmt(null);
    const dbPrepare = vi.fn().mockReturnValue(stmt);
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    await onSendVerification(makeSendContext({ email: 'u@x.com' }, env));

    const sql = dbPrepare.mock.calls[0][0] as string;
    expect(sql).toContain('email_verified_at IS NULL');
  });

  it('email lowercase + trim before lookup', async () => {
    const stmt = makeStmt(null);
    const dbPrepare = vi.fn().mockReturnValue(stmt);
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    await onSendVerification(makeSendContext({ email: '  Mixed@EXAMPLE.com  ' }, env));
    expect(stmt.bind).toHaveBeenCalledWith('mixed@example.com');
  });

  it('sends Resend email when RESEND_API_KEY + EMAIL_FROM set (V2-P3 wire)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'msg-123' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM users') && sql.includes('email_verified_at IS NULL')) {
        return makeStmt({ id: 'u-1', display_name: 'Ray' });
      }
      return makeStmt();
    });
    const env = {
      DB: { prepare: dbPrepare },
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'Tripline <no-reply@example.com>',
    };
    await onSendVerification(makeSendContext({ email: 'u@x.com' }, env as never));

    // fetch hits Resend with verify URL in body
    const resendCall = fetchMock.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('resend.com'),
    );
    expect(resendCall).toBeTruthy();
    const body = JSON.parse((resendCall![1] as RequestInit).body as string) as Record<string, unknown>;
    expect(body.to).toEqual(['u@x.com']);
    expect(body.subject).toContain('驗證');
    expect(body.html).toContain('https://x.com/api/oauth/verify?token=');
    vi.unstubAllGlobals();
  });

  it('does NOT send email when RESEND_API_KEY missing (graceful degrade)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM users') && sql.includes('email_verified_at IS NULL')) {
        return makeStmt({ id: 'u-1', display_name: null });
      }
      return makeStmt();
    });
    const env = { DB: { prepare: dbPrepare } }; // NO RESEND_API_KEY
    await onSendVerification(makeSendContext({ email: 'u@x.com' }, env as never));

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('returns generic 200 even when Resend API fails (best-effort)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_api_key' }), { status: 401 }),
    ));

    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM users') && sql.includes('email_verified_at IS NULL')) {
        return makeStmt({ id: 'u-1', display_name: null });
      }
      return makeStmt();
    });
    const env = {
      DB: { prepare: dbPrepare },
      RESEND_API_KEY: 're_bad',
      EMAIL_FROM: 'Tripline <no-reply@example.com>',
    };
    const res = await onSendVerification(makeSendContext({ email: 'u@x.com' }, env as never));
    expect(res.status).toBe(200);
    vi.unstubAllGlobals();
  });
});
