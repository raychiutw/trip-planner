/**
 * /api/dev/apps unit test — V2-P4 OAuth client_app management
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost, onRequestGet } from '../../functions/api/dev/apps';
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

async function makeAuthedRequest(url: string, method: 'GET' | 'POST', body?: unknown): Promise<Request> {
  // issueSession on a Response, then steal the cookie
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
    headers: {
      'content-type': 'application/json',
      Cookie: sessionCookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeContext(request: Request, env: MockEnv): Parameters<typeof onRequestPost>[0] {
  return {
    request,
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

describe('POST /api/dev/apps', () => {
  it('401 when no session cookie', async () => {
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: vi.fn() } };
    const req = new Request('https://x.com/api/dev/apps', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_name: 'X', redirect_uris: ['https://x.com/cb'] }),
    });
    await expect(onRequestPost(makeContext(req, env))).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('400 DATA_VALIDATION when app_name missing', async () => {
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: vi.fn() } };
    const req = await makeAuthedRequest('https://x.com/api/dev/apps', 'POST', {
      redirect_uris: ['https://x.com/cb'],
    });
    await expect(onRequestPost(makeContext(req, env))).rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });

  it('400 DATA_VALIDATION when redirect_uris missing or empty', async () => {
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: vi.fn() } };
    const req1 = await makeAuthedRequest('https://x.com/api/dev/apps', 'POST', {
      app_name: 'My App', redirect_uris: [],
    });
    await expect(onRequestPost(makeContext(req1, env))).rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });

  it('400 DATA_VALIDATION when redirect_uri is non-https (except localhost)', async () => {
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: vi.fn() } };
    const req = await makeAuthedRequest('https://x.com/api/dev/apps', 'POST', {
      app_name: 'My App',
      redirect_uris: ['http://attacker.com/cb'],
    });
    await expect(onRequestPost(makeContext(req, env))).rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });

  it('localhost redirect_uri is allowed (dev compat)', async () => {
    const dbPrepare = vi.fn().mockReturnValue(makeStmt());
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: dbPrepare } };
    const req = await makeAuthedRequest('https://x.com/api/dev/apps', 'POST', {
      app_name: 'Dev App',
      redirect_uris: ['http://localhost:3000/cb'],
    });
    const res = await onRequestPost(makeContext(req, env));
    expect(res.status).toBe(201);
  }, 30_000);

  it('201 returns client_id (always) + null client_secret for public client', async () => {
    const dbPrepare = vi.fn().mockReturnValue(makeStmt());
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: dbPrepare } };
    const req = await makeAuthedRequest('https://x.com/api/dev/apps', 'POST', {
      app_name: 'Public Mobile App',
      client_type: 'public',
      redirect_uris: ['https://example.com/cb'],
    });
    const res = await onRequestPost(makeContext(req, env));
    expect(res.status).toBe(201);
    const json = await res.json() as Record<string, unknown>;
    expect(typeof json.client_id).toBe('string');
    expect((json.client_id as string).startsWith('tp_')).toBe(true);
    expect(json.client_secret).toBeNull();
    expect(json.client_type).toBe('public');
    expect(json.status).toBe('pending_review');
  }, 30_000);

  it('201 returns client_secret ONCE for confidential client', async () => {
    const dbPrepare = vi.fn().mockReturnValue(makeStmt());
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: dbPrepare } };
    const req = await makeAuthedRequest('https://x.com/api/dev/apps', 'POST', {
      app_name: 'Server Side App',
      client_type: 'confidential',
      redirect_uris: ['https://example.com/cb'],
    });
    const res = await onRequestPost(makeContext(req, env));
    expect(res.status).toBe(201);
    const json = await res.json() as Record<string, unknown>;
    expect(typeof json.client_secret).toBe('string');
    expect((json.client_secret as string).startsWith('tps_')).toBe(true);
    // Verify hash (not plaintext) was stored in DB
    const insertCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO client_apps'),
    );
    expect(insertCall).toBeTruthy();
    // bind args: client_id, client_secret_hash, client_type, ...
    const insertStmt = dbPrepare.mock.results.find(
      (_, i) => typeof dbPrepare.mock.calls[i][0] === 'string' &&
                (dbPrepare.mock.calls[i][0] as string).includes('INSERT INTO client_apps'),
    )?.value;
    const bindArgs = (insertStmt as { bind: { mock: { calls: unknown[][] } } }).bind.mock.calls[0];
    expect(bindArgs[1]).not.toBe(json.client_secret); // hash, not plaintext
    expect(typeof bindArgs[1]).toBe('string'); // pbkdf2$... format
  }, 30_000);

  it('owner_user_id = session uid (cannot override via body)', async () => {
    const dbPrepare = vi.fn().mockReturnValue(makeStmt());
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: dbPrepare } };
    const req = await makeAuthedRequest('https://x.com/api/dev/apps', 'POST', {
      app_name: 'Test App',
      redirect_uris: ['https://x.com/cb'],
      owner_user_id: 'attacker-user-id', // ignored
    } as Record<string, unknown>);
    const res = await onRequestPost(makeContext(req, env));
    expect(res.status).toBe(201);
    const insertStmt = dbPrepare.mock.results.find(
      (_, i) => typeof dbPrepare.mock.calls[i][0] === 'string' &&
                (dbPrepare.mock.calls[i][0] as string).includes('INSERT INTO client_apps'),
    )?.value;
    const bindArgs = (insertStmt as { bind: { mock: { calls: unknown[][] } } }).bind.mock.calls[0];
    // owner_user_id is the 9th positional bind arg (0-indexed: 8)
    expect(bindArgs[8]).toBe('user-1'); // session uid, not 'attacker-user-id'
  }, 30_000);

  it('default scopes used when allowed_scopes not provided', async () => {
    const dbPrepare = vi.fn().mockReturnValue(makeStmt());
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: dbPrepare } };
    const req = await makeAuthedRequest('https://x.com/api/dev/apps', 'POST', {
      app_name: 'Test App',
      redirect_uris: ['https://x.com/cb'],
    });
    const res = await onRequestPost(makeContext(req, env));
    const json = await res.json() as { allowed_scopes: string[] };
    expect(json.allowed_scopes).toEqual(['openid', 'profile', 'email']);
  }, 30_000);
});

describe('GET /api/dev/apps', () => {
  it('401 when no session', async () => {
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: vi.fn() } };
    const req = new Request('https://x.com/api/dev/apps', { method: 'GET' });
    await expect(onRequestGet(makeContext(req, env))).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('200 returns user-owned apps with redirect_uris parsed from JSON', async () => {
    const stmt = makeStmt(null, [
      {
        client_id: 'tp_abc',
        client_type: 'public',
        app_name: 'My App',
        redirect_uris: '["https://example.com/cb"]',
        allowed_scopes: '["openid","profile"]',
        status: 'active',
        created_at: '2026-04-20',
      },
    ]);
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: vi.fn().mockReturnValue(stmt) },
    };
    const req = await makeAuthedRequest('https://x.com/api/dev/apps', 'GET');
    const res = await onRequestGet(makeContext(req, env));
    expect(res.status).toBe(200);
    const json = await res.json() as { apps: Array<Record<string, unknown>> };
    expect(json.apps).toHaveLength(1);
    expect(json.apps[0]?.redirect_uris).toEqual(['https://example.com/cb']);
    expect(json.apps[0]?.allowed_scopes).toEqual(['openid', 'profile']);
  });

  it('filters by owner_user_id (session.uid)', async () => {
    const stmt = makeStmt(null, []);
    const dbPrepare = vi.fn().mockReturnValue(stmt);
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: dbPrepare },
    };
    const req = await makeAuthedRequest('https://x.com/api/dev/apps', 'GET');
    await onRequestGet(makeContext(req, env));
    expect(stmt.bind).toHaveBeenCalledWith('user-1');
    const sql = dbPrepare.mock.calls[0][0] as string;
    expect(sql).toContain('WHERE owner_user_id = ?');
  });
});
