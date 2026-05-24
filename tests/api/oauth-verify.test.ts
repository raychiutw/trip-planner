/**
 * /api/oauth/verify + /api/oauth/send-verification — V2-P2 email verification
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

/**
 * v2.33.85: handler 跑 IP+email rate-limit check BEFORE everything else
 * (v2.33.52 round 8d 引入)。預設返 empty rate-limit row (allow)。tests 需
 * vi.fn().mockReturnValue(makeStmt()) 而不能用 raw vi.fn()，否則 prepare 返
 * undefined 後 .bind() 炸 TypeError。
 */
function makeRateLimitDb(): MockEnv['DB'] {
  return { prepare: vi.fn().mockReturnValue(makeStmt()) };
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

afterEach(() => {
  vi.useRealTimers();
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

  it('302 → /login?verified=1 happy path + UPDATE email_verified_at + consume', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT payload, expires_at FROM oauth_models')) {
        return makeStmt({
          payload: JSON.stringify({
            userId: 'u-1',
            email: 'u@x.com',
            createdAt: Date.now() - 1000,
          }),
          expires_at: Date.now() + 60_000,
        });
      }
      if (sql.includes('UPDATE users SET email_verified_at')) return makeStmt();
      if (sql.includes('UPDATE oauth_models SET payload = json_set')) return makeStmt();
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestGet(makeVerifyContext('token=valid-token', env));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/login?verified=1');

    // Assert UPDATE users called
    const updateCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE users SET email_verified_at'),
    );
    expect(updateCall).toBeDefined();
    // Assert consume() called (UPDATE oauth_models SET payload = json_set, NOT DELETE)
    const consumeCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE oauth_models SET payload = json_set'),
    );
    expect(consumeCall).toBeDefined();
    // DELETE no longer called — token is kept until expires_at so re-clicks return 'used'
    const deleteCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('DELETE FROM oauth_models'),
    );
    expect(deleteCall).toBeFalsy();
  });

  it('302 → /login?verify_error=used when token already consumed (re-click)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT payload, expires_at FROM oauth_models')) {
        return makeStmt({
          payload: JSON.stringify({
            userId: 'u-1',
            email: 'u@x.com',
            createdAt: Date.now() - 1000,
            consumed: Date.now() - 100,
          }),
          expires_at: Date.now() + 60_000,
        });
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestGet(makeVerifyContext('token=already-consumed', env));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/login?verify_error=used');
    // Should NOT touch users table
    const updateUsers = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE users SET email_verified_at'),
    );
    expect(updateUsers).toBeFalsy();
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

  it('does NOT consume token if UPDATE fails (so user can retry)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT payload, expires_at FROM oauth_models')) {
        return makeStmt({
          payload: JSON.stringify({ userId: 'u', email: 'u@x.com', createdAt: 0 }),
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

    // consume() was NOT called (token preserved for retry)
    const consumeCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE oauth_models SET payload = json_set'),
    );
    expect(consumeCall).toBeFalsy();
  });
});

describe('POST /api/oauth/send-verification', () => {
  it('200 generic response when email empty (no enum leak)', async () => {
    const env: MockEnv = { DB: makeRateLimitDb() };
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
    // 2026-05-02 cutover: sendEmail now requires TRIPLINE_API_URL + TRIPLINE_API_SECRET
    // Stub fetch to mac mini /internal/mail/send to return success → 200 generic.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, messageId: 'msg-test', elapsed: 100 }), { status: 200 }),
    ));

    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM users') && sql.includes('email_verified_at IS NULL')) {
        return makeStmt({ id: 'u-1', display_name: null });
      }
      if (sql.includes('INSERT OR REPLACE INTO oauth_models')) return makeStmt();
      return makeStmt();
    });
    const env = {
      DB: { prepare: dbPrepare },
      TRIPLINE_API_URL: 'https://mac-mini.tail.ts.net:8443',
      TRIPLINE_API_SECRET: 'test-bearer',
    };
    const res = await onSendVerification(makeSendContext({ email: 'unverified@x.com' }, env as never));
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
    vi.unstubAllGlobals();
  });

  it('Filters by email_verified_at IS NULL (only unverified users get tokens)', async () => {
    const stmt = makeStmt(null);
    const dbPrepare = vi.fn().mockReturnValue(stmt);
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    await onSendVerification(makeSendContext({ email: 'u@x.com' }, env));

    // v2.33.85: rate-limit check 跑在前，user SELECT 不一定是 calls[0]。
    // 改 find 含 'email_verified_at IS NULL' 的 call。
    const sqls = dbPrepare.mock.calls.map((c) => c[0] as string);
    const userSelect = sqls.find((s) => s.includes('email_verified_at IS NULL'));
    expect(userSelect).toBeDefined();
  });

  it('email lowercase + trim before lookup', async () => {
    const stmt = makeStmt(null);
    const dbPrepare = vi.fn().mockReturnValue(stmt);
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    await onSendVerification(makeSendContext({ email: '  Mixed@EXAMPLE.com  ' }, env));
    expect(stmt.bind).toHaveBeenCalledWith('mixed@example.com');
  });

  it('sends verification email via mac mini tunnel (post-2026-05-02 cutover)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, messageId: 'msg-123', elapsed: 200 }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM users') && sql.includes('email_verified_at IS NULL')) {
        return makeStmt({ id: 'u-1', display_name: 'Ray' });
      }
      return makeStmt();
    });
    // v2.33.85: v2.33.59 round 13 H2 改 background send via context.waitUntil
    // → 必須 collect promise 並 await，否則 mailer call 還沒發 test 已結束。
    const waitPromises: Promise<unknown>[] = [];
    const ctx = makeSendContext({ email: 'u@x.com' }, {
      DB: { prepare: dbPrepare },
      TRIPLINE_API_URL: 'https://mac-mini.tail.ts.net:8443',
      TRIPLINE_API_SECRET: 'test-bearer',
    } as never);
    (ctx as unknown as { waitUntil: (p: Promise<unknown>) => void }).waitUntil = (p) => {
      waitPromises.push(p);
    };
    await onSendVerification(ctx);
    await Promise.all(waitPromises);

    const mailerCall = fetchMock.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('/internal/mail/send'),
    );
    expect(mailerCall).toBeDefined();
    const init = mailerCall![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-bearer');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.to).toBe('u@x.com');
    expect(body.subject).toContain('驗證');
    // v2.33.59 round 13 H2: email link 改指 SPA landing /auth/verify-email
    expect(body.html).toContain('/auth/verify-email?token=');
    expect(body.template).toBe('verification');
    vi.unstubAllGlobals();
  });

  it('200 generic + audit + alert when TRIPLINE_API_URL missing (v2.33.59 round 13: background send anti-enum)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM users') && sql.includes('email_verified_at IS NULL')) {
        return makeStmt({ id: 'u-1', display_name: null });
      }
      return makeStmt();
    });
    const waitPromises: Promise<unknown>[] = [];
    const ctx = makeSendContext({ email: 'u@x.com' }, { DB: { prepare: dbPrepare } } as never);
    (ctx as unknown as { waitUntil: (p: Promise<unknown>) => void }).waitUntil = (p) => {
      waitPromises.push(p);
    };
    const res = await onSendVerification(ctx);
    // v2.33.59 round 13 H2: 改 background send，response 永遠 200 generic (anti-enum)。
    // sendEmail 失敗只記 audit + telegram，不洩漏給 caller。
    expect(res.status).toBe(200);
    await Promise.all(waitPromises);

    // audit_log INSERT for failed email event
    const auditInsert = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO audit_log'),
    );
    expect(auditInsert).toBeDefined();

    // No mailer fetch (sendEmail throws before fetch when TRIPLINE_API_URL missing)
    const mailerCall = fetchMock.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('/internal/mail/send'),
    );
    expect(mailerCall).toBeFalsy();
    vi.unstubAllGlobals();
  });

  it('200 generic + audit when mac mini mailer fails (v2.33.59 round 13: silent failure)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'SMTP unreachable' }), { status: 500 }),
    ));

    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM users') && sql.includes('email_verified_at IS NULL')) {
        return makeStmt({ id: 'u-1', display_name: null });
      }
      return makeStmt();
    });
    const waitPromises: Promise<unknown>[] = [];
    const ctx = makeSendContext({ email: 'u@x.com' }, {
      DB: { prepare: dbPrepare },
      TRIPLINE_API_URL: 'https://mac-mini.tail.ts.net:8443',
      TRIPLINE_API_SECRET: 'test-bearer',
    } as never);
    (ctx as unknown as { waitUntil: (p: Promise<unknown>) => void }).waitUntil = (p) => {
      waitPromises.push(p);
    };
    const res = await onSendVerification(ctx);
    // v2.33.59 round 13 H2: 200 generic even on mailer failure
    expect(res.status).toBe(200);
    await Promise.all(waitPromises);
    vi.unstubAllGlobals();
  });
});
