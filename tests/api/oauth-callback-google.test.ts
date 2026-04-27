/**
 * GET /api/oauth/callback/google unit test — V2-P1
 *
 * verifyGoogleIdToken is mocked because it fetches Google's live JWKS endpoint —
 * the real verification path is covered by the jwt-module unit tests + the
 * google-id-token module tests. Here we exercise the callback flow logic
 * (state validation, user creation, session issuance) with the verification
 * stubbed to a passthrough that decodes the unsigned id_token payload.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/server/oauth-client/google-id-token', () => ({
  verifyGoogleIdToken: vi.fn(async (idToken: string) => {
    // Decode payload without signature verification (test-only).
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new Error('JWT must have 3 parts');
    const payloadB64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (payloadB64.length % 4)) % 4;
    const json = atob(payloadB64 + '='.repeat(padLen));
    return JSON.parse(json);
  }),
}));

import { onRequestGet } from '../../functions/api/oauth/callback/google';

interface MockEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
  DB?: unknown;
}

/** Minimal id_token JWT — header.payload.signature where payload is base64url(JSON) */
function makeIdToken(payload: object): string {
  const enc = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return [enc('{"alg":"RS256"}'), enc(JSON.stringify(payload)), 'fake-signature'].join('.');
}

function makeStmt(firstResult: unknown = null): { bind: ReturnType<typeof vi.fn>; first: ReturnType<typeof vi.fn>; run: ReturnType<typeof vi.fn> } {
  const stmt = {
    bind: vi.fn(),
    first: vi.fn().mockResolvedValue(firstResult),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  };
  stmt.bind.mockReturnValue(stmt);
  return stmt;
}

function makeContext(url: string, env: MockEnv): Parameters<typeof onRequestGet>[0] {
  return {
    request: new Request(url),
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
  vi.restoreAllMocks();
});

describe('GET /api/oauth/callback/google', () => {
  it('400 OAUTH_MISSING_PARAMS when no code/state', async () => {
    const env: MockEnv = { DB: { prepare: vi.fn() } };
    const res = await onRequestGet(makeContext('https://x.com/api/oauth/callback/google', env));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('OAUTH_MISSING_PARAMS');
  });

  it('400 OAUTH_INVALID_STATE when state not in D1', async () => {
    const stmt = makeStmt(null); // adapter.find returns null
    const env: MockEnv = { DB: { prepare: vi.fn().mockReturnValue(stmt) } };
    const res = await onRequestGet(makeContext('https://x.com/api/oauth/callback/google?code=c1&state=missing', env));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('OAUTH_INVALID_STATE');
  });

  it('503 when GOOGLE_CLIENT_SECRET missing (after state validate)', async () => {
    const stmt = makeStmt({
      payload: '{"provider":"google","redirectAfterLogin":"/manage"}',
      expires_at: Date.now() + 60000,
    });
    const env: MockEnv = {
      GOOGLE_CLIENT_ID: 'gid',
      // CLIENT_SECRET missing
      DB: { prepare: vi.fn().mockReturnValue(stmt) },
    };
    const res = await onRequestGet(makeContext('https://x.com/api/oauth/callback/google?code=c&state=s', env));
    expect(res.status).toBe(503);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('OAUTH_NOT_CONFIGURED');
  });

  it('happy path: existing identity → update last_used_at + 302 redirect with session cookie', async () => {
    const states: Record<string, ReturnType<typeof makeStmt>> = {};
    let prepareCalls = 0;
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      prepareCalls++;
      // Sequence:
      // 1. SELECT find OAuthState → stateRow with redirectAfterLogin
      // 2. DELETE OAuthState (consume)
      // 3. SELECT auth_identities → existing user
      // 4. UPDATE auth_identities last_used_at
      if (sql.includes('SELECT payload, expires_at FROM oauth_models')) {
        return makeStmt({
          payload: '{"provider":"google","redirectAfterLogin":"/manage"}',
          expires_at: Date.now() + 60000,
        });
      }
      if (sql.includes('DELETE FROM oauth_models')) {
        return makeStmt();
      }
      if (sql.includes('SELECT user_id FROM auth_identities')) {
        return makeStmt({ user_id: 'existing-user-uuid' });
      }
      if (sql.includes('UPDATE auth_identities')) {
        return makeStmt();
      }
      return makeStmt();
    });
    const env: MockEnv = {
      GOOGLE_CLIENT_ID: 'gid',
      GOOGLE_CLIENT_SECRET: 'secret',
      SESSION_SECRET: 'session-secret-test',
      DB: { prepare: dbPrepare },
    };
    // Mock global fetch for Google token exchange
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        access_token: 'at',
        id_token: makeIdToken({ sub: 'google-sub-123', email: 'user@example.com', name: 'User Name' }),
        expires_in: 3600,
        token_type: 'Bearer',
      }), { status: 200 }),
    );

    const res = await onRequestGet(makeContext('https://x.com/api/oauth/callback/google?code=auth-code&state=valid-state', env));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/manage');
    expect(res.headers.get('Set-Cookie')).toMatch(/tripline_session=/);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' }),
    );
    fetchSpy.mockRestore();
  });

  it('happy path: new user → create user + identity row + redirect', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT payload')) return makeStmt({
        payload: '{"redirectAfterLogin":"/explore"}',
        expires_at: Date.now() + 60000,
      });
      if (sql.includes('DELETE FROM oauth_models')) return makeStmt();
      if (sql.includes('SELECT user_id')) return makeStmt(null); // no existing identity
      if (sql.includes('INSERT INTO users')) return makeStmt();
      if (sql.includes('INSERT INTO auth_identities')) return makeStmt();
      return makeStmt();
    });
    const env: MockEnv = {
      GOOGLE_CLIENT_ID: 'gid',
      GOOGLE_CLIENT_SECRET: 'secret',
      SESSION_SECRET: 'session-secret-test',
      DB: { prepare: dbPrepare },
    };
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        access_token: 'at',
        id_token: makeIdToken({ sub: 'new-sub', email: 'new@example.com', email_verified: true, name: 'New' }),
        expires_in: 3600,
        token_type: 'Bearer',
      }), { status: 200 }),
    );

    const res = await onRequestGet(makeContext('https://x.com/api/oauth/callback/google?code=c&state=s', env));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/explore');
    // 確認有 INSERT INTO users + INSERT INTO auth_identities calls
    const calls = dbPrepare.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls.some((s) => typeof s === 'string' && s.includes('INSERT INTO users'))).toBe(true);
    expect(calls.some((s) => typeof s === 'string' && s.includes('INSERT INTO auth_identities'))).toBe(true);
    fetchSpy.mockRestore();
  });

  it('502 OAUTH_TOKEN_EXCHANGE_FAILED when Google rejects code', async () => {
    const stmt = makeStmt({
      payload: '{"redirectAfterLogin":"/manage"}',
      expires_at: Date.now() + 60000,
    });
    const env: MockEnv = {
      GOOGLE_CLIENT_ID: 'gid',
      GOOGLE_CLIENT_SECRET: 'secret',
      DB: { prepare: vi.fn().mockReturnValue(stmt) },
    };
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('invalid_grant', { status: 400 }),
    );
    const res = await onRequestGet(makeContext('https://x.com/api/oauth/callback/google?code=c&state=s', env));
    expect(res.status).toBe(502);
    fetchSpy.mockRestore();
  });

  it('400 OAUTH_INVALID_ID_TOKEN when id_token missing sub/email', async () => {
    const stmt = makeStmt({
      payload: '{"redirectAfterLogin":"/manage"}',
      expires_at: Date.now() + 60000,
    });
    const env: MockEnv = {
      GOOGLE_CLIENT_ID: 'gid',
      GOOGLE_CLIENT_SECRET: 'secret',
      DB: { prepare: vi.fn().mockReturnValue(stmt) },
    };
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        access_token: 'at',
        id_token: makeIdToken({ aud: 'no-sub-no-email' }), // missing sub/email
        expires_in: 3600,
        token_type: 'Bearer',
      }), { status: 200 }),
    );
    const res = await onRequestGet(makeContext('https://x.com/api/oauth/callback/google?code=c&state=s', env));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('OAUTH_INVALID_ID_TOKEN');
    fetchSpy.mockRestore();
  });
});
