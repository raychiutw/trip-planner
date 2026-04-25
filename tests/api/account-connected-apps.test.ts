/**
 * /api/account/connected-apps — V2-P5 user-side OAuth grant management
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet } from '../../functions/api/account/connected-apps';
import { onRequestDelete } from '../../functions/api/account/connected-apps/[client_id]';
import { issueSession } from '../../functions/api/_session';

interface MockEnv {
  SESSION_SECRET?: string;
  DB?: { prepare: ReturnType<typeof vi.fn> };
}

function makeStmt(firstResult: unknown = null, allResults: unknown[] = []) {
  return {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(firstResult),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
    all: vi.fn().mockResolvedValue({ results: allResults }),
  };
}

async function makeAuthedRequest(url: string, method: 'GET' | 'DELETE'): Promise<Request> {
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
    headers: { Cookie: sessionCookie },
  });
}

function makeGetContext(request: Request, env: MockEnv): Parameters<typeof onRequestGet>[0] {
  return {
    request,
    env: env as unknown as never,
    params: {} as unknown as never,
    data: {} as unknown as never,
    next: () => Promise.resolve(new Response()),
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
  } as unknown as Parameters<typeof onRequestGet>[0];
}

function makeDeleteContext(
  request: Request,
  env: MockEnv,
  clientId: string,
): Parameters<typeof onRequestDelete>[0] {
  return {
    request,
    env: env as unknown as never,
    params: { client_id: clientId } as unknown as never,
    data: {} as unknown as never,
    next: () => Promise.resolve(new Response()),
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
  } as unknown as Parameters<typeof onRequestDelete>[0];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-25T00:00:00Z'));
});

describe('GET /api/account/connected-apps', () => {
  it('401 when no session', async () => {
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: vi.fn() } };
    const req = new Request('https://x.com/api/account/connected-apps', { method: 'GET' });
    await expect(onRequestGet(makeGetContext(req, env))).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('200 returns empty list when no consents', async () => {
    const stmt = makeStmt(null, []);
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: vi.fn().mockReturnValue(stmt) },
    };
    const req = await makeAuthedRequest('https://x.com/api/account/connected-apps', 'GET');
    const res = await onRequestGet(makeGetContext(req, env));
    expect(res.status).toBe(200);
    const json = await res.json() as { apps: unknown[] };
    expect(json.apps).toEqual([]);
  });

  it('200 returns connected apps with merged consent + client_app data', async () => {
    const consentPayload = JSON.stringify({
      user_id: 'user-1',
      client_id: 'tp_abc',
      scopes: ['openid', 'profile', 'trips.read'],
      grantedAt: 1700000000000,
    });
    const stmt = makeStmt(null, [
      {
        consent_payload: consentPayload,
        client_id: 'tp_abc',
        app_name: 'Trip Buddy',
        app_description: 'Trip companion app',
        app_logo_url: null,
        homepage_url: 'https://tripbuddy.example.com',
        status: 'active',
      },
    ]);
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: vi.fn().mockReturnValue(stmt) },
    };
    const req = await makeAuthedRequest('https://x.com/api/account/connected-apps', 'GET');
    const res = await onRequestGet(makeGetContext(req, env));
    const json = await res.json() as { apps: Array<Record<string, unknown>> };

    expect(json.apps).toHaveLength(1);
    expect(json.apps[0]).toMatchObject({
      client_id: 'tp_abc',
      app_name: 'Trip Buddy',
      scopes: ['openid', 'profile', 'trips.read'],
      granted_at: 1700000000000,
      status: 'active',
    });
  });

  it('SQL filters by user_id from session (not from query)', async () => {
    const stmt = makeStmt(null, []);
    const dbPrepare = vi.fn().mockReturnValue(stmt);
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: dbPrepare },
    };
    const req = await makeAuthedRequest('https://x.com/api/account/connected-apps', 'GET');
    await onRequestGet(makeGetContext(req, env));

    // bind args: session.uid + Date.now()
    const bindCall = stmt.bind.mock.calls[0];
    expect(bindCall[0]).toBe('user-1');
    expect(typeof bindCall[1]).toBe('number');
  });
});

describe('DELETE /api/account/connected-apps/:client_id', () => {
  it('401 when no session', async () => {
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: vi.fn() } };
    const req = new Request('https://x.com/api/account/connected-apps/tp_abc', { method: 'DELETE' });
    await expect(onRequestDelete(makeDeleteContext(req, env, 'tp_abc')))
      .rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('400 DATA_VALIDATION when client_id param missing', async () => {
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: vi.fn() } };
    const req = await makeAuthedRequest('https://x.com/api/account/connected-apps/', 'DELETE');
    await expect(onRequestDelete(makeDeleteContext(req, env, '')))
      .rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });

  it('404 CONSENT_NOT_FOUND when no consent for (user, client)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT payload, expires_at FROM oauth_models')) {
        return makeStmt(null); // no consent
      }
      return makeStmt();
    });
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: dbPrepare },
    };
    const req = await makeAuthedRequest('https://x.com/api/account/connected-apps/unknown_app', 'DELETE');
    const res = await onRequestDelete(makeDeleteContext(req, env, 'unknown_app'));
    expect(res.status).toBe(404);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('CONSENT_NOT_FOUND');
  });

  it('200 destroys consent + all tokens for (user, client) pair', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT payload, expires_at FROM oauth_models')) {
        return makeStmt({
          payload: JSON.stringify({
            user_id: 'user-1',
            client_id: 'tp_abc',
            scopes: ['openid'],
            grantedAt: Date.now(),
          }),
          expires_at: Date.now() + 60_000,
        });
      }
      if (sql.includes('DELETE FROM oauth_models')) return makeStmt();
      return makeStmt();
    });
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: dbPrepare },
    };
    const req = await makeAuthedRequest('https://x.com/api/account/connected-apps/tp_abc', 'DELETE');
    const res = await onRequestDelete(makeDeleteContext(req, env, 'tp_abc'));
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; revoked_client_id: string };
    expect(json.ok).toBe(true);
    expect(json.revoked_client_id).toBe('tp_abc');

    // Two DELETE calls: consent destroy + bulk token cleanup
    const deleteCalls = dbPrepare.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('DELETE FROM oauth_models'),
    );
    expect(deleteCalls.length).toBe(2);

    // Bulk token cleanup must filter by both user_id + client_id
    const bulkCleanup = deleteCalls.find(
      (c) => (c[0] as string).includes("name IN ('AccessToken', 'RefreshToken')"),
    );
    expect(bulkCleanup).toBeTruthy();
  });

  it('Cannot revoke another user\'s consent (cross-user attack)', async () => {
    // user-1 tries to revoke client tp_abc; consent stored for user-2:tp_abc only
    // adapter.find(`${session.uid}:tp_abc`) → key 'user-1:tp_abc' returns null
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT payload, expires_at FROM oauth_models')) {
        return makeStmt(null); // user-1 has no consent for tp_abc
      }
      return makeStmt();
    });
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: dbPrepare },
    };
    const req = await makeAuthedRequest('https://x.com/api/account/connected-apps/tp_abc', 'DELETE');
    const res = await onRequestDelete(makeDeleteContext(req, env, 'tp_abc'));
    expect(res.status).toBe(404);

    // No DELETE calls should have run (we 404'd before)
    const deleteCalls = dbPrepare.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('DELETE FROM oauth_models'),
    );
    expect(deleteCalls.length).toBe(0);
  });
});
