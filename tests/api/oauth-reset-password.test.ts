/**
 * POST /api/oauth/reset-password unit test — V2-P3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onRequestPost } from '../../functions/api/oauth/reset-password';
import { AppError, errorResponse } from '../../functions/api/_errors';

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

/**
 * v2.33.85: handler 跑 IP rate-limit check FIRST (line 56)，需 prepare 返
 * statement chain 而非 undefined。預設返 empty rate limit row (allow)。
 */
function makeDbWithRateLimitStub(): MockEnv['DB'] {
  return { prepare: vi.fn().mockReturnValue(makeStmt()) };
}

function makeContext(body: unknown, env: MockEnv): Parameters<typeof onRequestPost>[0] {
  return {
    request: new Request('https://x.com/api/oauth/reset-password', {
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

/** Mirror _middleware.ts try/catch: AppError → errorResponse(err). */
async function invoke(body: unknown, env: MockEnv): Promise<Response> {
  try {
    return await onRequestPost(makeContext(body, env));
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    throw err;
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-25T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});


describe('POST /api/oauth/reset-password', () => {
  it('400 RESET_TOKEN_MISSING when token empty', async () => {
    const env: MockEnv = { DB: makeDbWithRateLimitStub() };
    const res = await invoke({ password: 'newpass123' }, env);
    expect(res.status).toBe(400);
    expect((await res.json() as { error: { code: string } }).error.code).toBe('RESET_TOKEN_MISSING');
  });

  it('400 RESET_PASSWORD_TOO_SHORT when password < 8 chars', async () => {
    const env: MockEnv = { DB: makeDbWithRateLimitStub() };
    const res = await invoke({ token: 'tok', password: 'short' }, env);
    expect(res.status).toBe(400);
    expect((await res.json() as { error: { code: string } }).error.code).toBe('RESET_PASSWORD_TOO_SHORT');
  });

  it('400 RESET_TOKEN_INVALID when token not in D1 (expired or never existed)', async () => {
    const stmt = makeStmt(null);
    const env: MockEnv = { DB: { prepare: vi.fn().mockReturnValue(stmt) } };
    const res = await invoke({ token: 'expired', password: 'newpass1234' }, env);
    expect(res.status).toBe(400);
    expect((await res.json() as { error: { code: string } }).error.code).toBe('RESET_TOKEN_INVALID');
  });

  it('happy path: 200 + UPDATE password_hash + consume token + revoke sessions', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT payload, expires_at FROM oauth_models')) {
        // D1Adapter.find — return reset token payload (no `used` field — fresh)
        return makeStmt({
          payload: JSON.stringify({ userId: 'u1', email: 'u@x.com', createdAt: Date.now() }),
          expires_at: Date.now() + 1000 * 60 * 30, // 30 min remaining
        });
      }
      if (sql.includes('UPDATE auth_identities')) return makeStmt();
      if (sql.includes('UPDATE oauth_models SET payload = json_set')) return makeStmt(); // adapter.consume
      if (sql.includes('UPDATE session_devices')) return makeStmt(); // revokeAllOtherSessions
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await invoke({
      token: 'valid-token',
      password: 'new-secure-password-123',
    }, env);

    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; message: string };
    expect(json.ok).toBe(true);
    expect(json.message).toContain('密碼已更新');

    // Verify UPDATE auth_identities + consume() (UPDATE oauth_models payload)
    const sqls = dbPrepare.mock.calls.map((c) => c[0] as string);
    expect(sqls.some((s) => s.includes('UPDATE auth_identities'))).toBe(true);
    expect(sqls.some((s) => s.includes('UPDATE oauth_models SET payload = json_set'))).toBe(true);
    // Token row NOT destroyed — kept until expires_at so re-clicks see 'used'
    expect(sqls.some((s) => s.includes('DELETE FROM oauth_models'))).toBe(false);
  }, 30_000);

  it('400 when token already used (one-time use guard)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT payload, expires_at')) {
        return makeStmt({
          payload: JSON.stringify({ userId: 'u1', email: 'u@x.com', used: true }),
          expires_at: Date.now() + 1000 * 60,
        });
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await invoke({ token: 'used-tok', password: 'newpass1234' }, env);
    expect(res.status).toBe(400);
    expect((await res.json() as { error: { code: string } }).error.code).toBe('RESET_TOKEN_INVALID');
  });

  it('UPDATE filters provider=local (不影響 Google identity)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT payload')) {
        return makeStmt({
          payload: JSON.stringify({ userId: 'u1', email: 'u@x.com' }),
          expires_at: Date.now() + 60000,
        });
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    await invoke({ token: 't', password: 'newpass1234' }, env);

    const updateSql = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE auth_identities'),
    )?.[0] as string;
    expect(updateSql).toContain("provider = 'local'");
  }, 30_000);

  it('sends confirmation email via mac mini tunnel (post-2026-05-02 cutover)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, messageId: 'msg-1', elapsed: 200 }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT payload, expires_at FROM oauth_models')) {
        return makeStmt({
          payload: JSON.stringify({ userId: 'u-1', email: 'u@x.com', createdAt: 0, used: false }),
          expires_at: Date.now() + 60000,
        });
      }
      if (sql.includes('SELECT display_name FROM users')) {
        return makeStmt({ display_name: 'Ray' });
      }
      return makeStmt();
    });
    const env = {
      DB: { prepare: dbPrepare },
      TRIPLINE_API_URL: 'https://mac-mini.tail.ts.net:8443',
      TRIPLINE_API_SECRET: 'test-bearer',
    };
    await invoke({ token: 't', password: 'newpass1234' }, env as never);

    const mailerCall = fetchMock.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('/internal/mail/send'),
    );
    expect(mailerCall).toBeTruthy();
    const init = mailerCall![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-bearer');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.to).toBe('u@x.com');
    expect(body.subject).toContain('密碼');
    expect(body.template).toBe('reset-password-confirm');
    vi.unstubAllGlobals();
  }, 30_000);

  it('still returns 200 when confirmation email fails (best-effort, password updated)', async () => {
    // confirmation email is "事後通知" — failure should not block 200 response.
    // sendEmail throws (no TRIPLINE_API_URL); caught best-effort + audit + alert.
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT payload, expires_at FROM oauth_models')) {
        return makeStmt({
          payload: JSON.stringify({ userId: 'u-1', email: 'u@x.com', createdAt: 0, used: false }),
          expires_at: Date.now() + 60000,
        });
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await invoke({ token: 't', password: 'newpass1234' }, env);
    expect(res.status).toBe(200);

    // audit_log INSERT for failed email event
    const auditInsert = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO audit_log'),
    );
    expect(auditInsert).toBeTruthy();

    // No fetch (sendEmail throws before fetch; telegram skipped — no env)
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  }, 30_000);
});
