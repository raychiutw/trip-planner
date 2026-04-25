/**
 * GET /api/oauth/server-authorize unit test — V2-P4
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet } from '../../functions/api/oauth/server-authorize';
import { signSessionToken } from '../../src/server/session';

const SECRET = 'session-secret-test';

const ACTIVE_CLIENT = {
  client_id: 'partner-x',
  client_type: 'confidential',
  app_name: 'Partner X',
  redirect_uris: JSON.stringify(['https://partner.com/cb']),
  allowed_scopes: JSON.stringify(['openid', 'profile', 'email']),
  status: 'active',
};

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

function makeContext(url: string, env: MockEnv, cookie?: string): Parameters<typeof onRequestGet>[0] {
  return {
    request: new Request(url, cookie ? { headers: { Cookie: cookie } } : {}),
    env: env as unknown as never,
    params: {} as unknown as never,
    data: {} as unknown as never,
    next: () => Promise.resolve(new Response()),
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
  } as unknown as Parameters<typeof onRequestGet>[0];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-25T00:00:00Z'));
});

const buildUrl = (params: Record<string, string>) => {
  const sp = new URLSearchParams(params);
  return `https://x.com/api/oauth/server-authorize?${sp.toString()}`;
};

describe('GET /api/oauth/server-authorize', () => {
  it('400 when client_id missing (not redirectable)', async () => {
    const env: MockEnv = { DB: { prepare: vi.fn() } };
    const res = await onRequestGet(makeContext(buildUrl({ response_type: 'code' }), env));
    expect(res.status).toBe(400);
  });

  it('400 when client_id unknown (not redirectable)', async () => {
    const env: MockEnv = { DB: { prepare: vi.fn().mockReturnValue(makeStmt(null)) } };
    const res = await onRequestGet(makeContext(buildUrl({
      client_id: 'unknown',
      redirect_uri: 'https://partner.com/cb',
      response_type: 'code',
      scope: 'openid',
    }), env));
    expect(res.status).toBe(400);
  });

  it('302 to client redirect_uri with error when scope invalid', async () => {
    const env: MockEnv = {
      DB: { prepare: vi.fn().mockReturnValue(makeStmt(ACTIVE_CLIENT)) },
    };
    const res = await onRequestGet(makeContext(buildUrl({
      client_id: 'partner-x',
      redirect_uri: 'https://partner.com/cb',
      response_type: 'code',
      scope: 'admin', // not in allowed
      state: 'csrf-1',
    }), env));
    expect(res.status).toBe(302);
    const loc = res.headers.get('Location') ?? '';
    expect(loc).toContain('https://partner.com/cb?');
    expect(loc).toContain('error=invalid_scope');
    expect(loc).toContain('state=csrf-1');
  });

  it('302 to /login when valid request but no session', async () => {
    const env: MockEnv = {
      DB: { prepare: vi.fn().mockReturnValue(makeStmt(ACTIVE_CLIENT)) },
    };
    const res = await onRequestGet(makeContext(buildUrl({
      client_id: 'partner-x',
      redirect_uri: 'https://partner.com/cb',
      response_type: 'code',
      scope: 'openid',
      state: 's',
    }), env));
    expect(res.status).toBe(302);
    const loc = res.headers.get('Location') ?? '';
    expect(loc).toMatch(/^\/login\?redirect_after=/);
    expect(decodeURIComponent(loc)).toContain('/api/oauth/server-authorize?');
  });

  it('happy path: logged in + valid → 302 redirect_uri?code=&state=', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(ACTIVE_CLIENT);
      if (sql.includes('INSERT OR REPLACE INTO oauth_models')) return makeStmt();
      return makeStmt();
    });
    const token = await signSessionToken('user-1', SECRET);
    const env: MockEnv = {
      SESSION_SECRET: SECRET,
      DB: { prepare: dbPrepare },
    };
    const res = await onRequestGet(makeContext(buildUrl({
      client_id: 'partner-x',
      redirect_uri: 'https://partner.com/cb',
      response_type: 'code',
      scope: 'openid profile',
      state: 'csrf-xyz',
    }), env, `tripline_session=${token}`));

    expect(res.status).toBe(302);
    const loc = res.headers.get('Location') ?? '';
    expect(loc).toMatch(/^https:\/\/partner\.com\/cb\?code=[A-Za-z0-9_-]+&state=csrf-xyz$/);

    // Verify INSERT AuthorizationCode in D1
    const insertCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT OR REPLACE INTO oauth_models'),
    );
    expect(insertCall).toBeTruthy();
  });

  it('PKCE public client: code_challenge stored', async () => {
    const PUBLIC_CLIENT = { ...ACTIVE_CLIENT, client_id: 'mobile', client_type: 'public' };
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      return makeStmt();
    });
    const token = await signSessionToken('user-1', SECRET);
    const env: MockEnv = {
      SESSION_SECRET: SECRET,
      DB: { prepare: dbPrepare },
    };
    const res = await onRequestGet(makeContext(buildUrl({
      client_id: 'mobile',
      redirect_uri: 'https://partner.com/cb',
      response_type: 'code',
      scope: 'openid',
      code_challenge: 'pkce-challenge-abc',
      code_challenge_method: 'S256',
      state: 's',
    }), env, `tripline_session=${token}`));

    expect(res.status).toBe(302);

    // Inspect INSERT payload — should contain code_challenge
    const insertStmt = dbPrepare.mock.results.find(
      (r, i) => typeof dbPrepare.mock.calls[i][0] === 'string' &&
                (dbPrepare.mock.calls[i][0] as string).includes('INSERT OR REPLACE'),
    )?.value;
    if (insertStmt) {
      const bindArgs = (insertStmt as { bind: { mock: { calls: unknown[][] } } }).bind.mock.calls[0];
      const payload = JSON.parse(bindArgs[2] as string);
      expect(payload.code_challenge).toBe('pkce-challenge-abc');
      expect(payload.code_challenge_method).toBe('S256');
    }
  });

  it('Rejects redirect_uri not in whitelist (not redirectable)', async () => {
    const env: MockEnv = {
      DB: { prepare: vi.fn().mockReturnValue(makeStmt(ACTIVE_CLIENT)) },
    };
    const res = await onRequestGet(makeContext(buildUrl({
      client_id: 'partner-x',
      redirect_uri: 'https://evil.com/cb',
      response_type: 'code',
      scope: 'openid',
    }), env));
    expect(res.status).toBe(400);
    // Not 302 — security critical, attacker shouldn't get redirect to their own URL
  });
});
