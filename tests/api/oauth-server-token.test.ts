/**
 * POST /api/oauth/server-token unit test — V2-P4
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost } from '../../functions/api/oauth/server-token';
import { hashPassword } from '../../src/server/password';

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

const PUBLIC_CLIENT = {
  client_id: 'mobile',
  client_type: 'public',
  client_secret_hash: null,
  status: 'active',
};

function makeAuthorizationCodePayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    payload: JSON.stringify({
      client_id: 'mobile',
      user_id: 'user-1',
      redirect_uri: 'https://x.com/cb',
      scopes: ['openid', 'profile'],
      code_challenge: null,
      code_challenge_method: null,
      used: false,
      ...overrides,
    }),
    expires_at: Date.now() + 60_000,
  };
}

function makeContext(body: unknown, env: MockEnv, contentType = 'application/json'): Parameters<typeof onRequestPost>[0] {
  let bodyStr: string;
  if (contentType === 'application/x-www-form-urlencoded' && typeof body === 'object' && body !== null) {
    bodyStr = new URLSearchParams(body as Record<string, string>).toString();
  } else {
    bodyStr = JSON.stringify(body);
  }
  return {
    request: new Request('https://x.com/api/oauth/server-token', {
      method: 'POST',
      headers: { 'content-type': contentType },
      body: bodyStr,
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

describe('POST /api/oauth/server-token', () => {
  it('400 unsupported_grant_type when not authorization_code', async () => {
    const env: MockEnv = { DB: { prepare: vi.fn() } };
    const res = await onRequestPost(makeContext({ grant_type: 'password' }, env));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('unsupported_grant_type');
  });

  it('400 invalid_client when client_id missing', async () => {
    const env: MockEnv = { DB: { prepare: vi.fn() } };
    const res = await onRequestPost(makeContext({ grant_type: 'authorization_code' }, env));
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('invalid_client');
  });

  it('401 invalid_client when client unknown', async () => {
    const env: MockEnv = { DB: { prepare: vi.fn().mockReturnValue(makeStmt(null)) } };
    const res = await onRequestPost(makeContext({
      grant_type: 'authorization_code', client_id: 'unknown', code: 'c', redirect_uri: 'r',
    }, env));
    expect(res.status).toBe(401);
    expect((await res.json() as { error: string }).error).toBe('invalid_client');
  });

  it('happy path public client (no PKCE): exchange code for tokens', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      if (sql.includes('SELECT payload, expires_at FROM oauth_models')) {
        return makeStmt(makeAuthorizationCodePayload());
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      grant_type: 'authorization_code',
      client_id: 'mobile',
      code: 'auth-code-xyz',
      redirect_uri: 'https://x.com/cb',
    }, env));

    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(typeof json.access_token).toBe('string');
    expect(typeof json.refresh_token).toBe('string');
    expect(json.token_type).toBe('Bearer');
    expect(json.expires_in).toBe(3600);
    expect(json.scope).toBe('openid profile');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('400 invalid_grant when code unknown / expired', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      if (sql.includes('SELECT payload')) return makeStmt(null); // not found
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      grant_type: 'authorization_code',
      client_id: 'mobile',
      code: 'expired',
      redirect_uri: 'r',
    }, env));
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('invalid_grant');
  });

  it('400 invalid_grant when redirect_uri mismatch (anti-injection)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      if (sql.includes('SELECT payload')) {
        return makeStmt(makeAuthorizationCodePayload({ redirect_uri: 'https://original.com/cb' }));
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      grant_type: 'authorization_code',
      client_id: 'mobile',
      code: 'c',
      redirect_uri: 'https://attacker.com/cb', // different
    }, env));
    expect(res.status).toBe(400);
    expect((await res.json() as { error_description: string }).error_description).toContain('redirect_uri mismatch');
  });

  it('400 invalid_grant when code_verifier missing for PKCE-protected code', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      if (sql.includes('SELECT payload')) {
        return makeStmt(makeAuthorizationCodePayload({
          code_challenge: 'some-challenge',
          code_challenge_method: 'S256',
        }));
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      grant_type: 'authorization_code',
      client_id: 'mobile',
      code: 'c',
      redirect_uri: 'https://x.com/cb',
      // missing code_verifier
    }, env));
    expect(res.status).toBe(400);
    expect((await res.json() as { error_description: string }).error_description).toContain('code_verifier');
  });

  it('PKCE happy path: code_verifier matches code_challenge', async () => {
    // Compute valid PKCE pair
    const verifier = 'test-verifier-string-32-chars-min';
    const verifierHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const bytes = new Uint8Array(verifierHash);
    let str = '';
    for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]!);
    const challenge = btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      if (sql.includes('SELECT payload')) {
        return makeStmt(makeAuthorizationCodePayload({
          code_challenge: challenge,
          code_challenge_method: 'S256',
        }));
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      grant_type: 'authorization_code',
      client_id: 'mobile',
      code: 'c',
      redirect_uri: 'https://x.com/cb',
      code_verifier: verifier,
    }, env));
    expect(res.status).toBe(200);
  });

  it('400 invalid_grant when code already used (replay protection)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      if (sql.includes('SELECT payload')) {
        return makeStmt(makeAuthorizationCodePayload({ used: true }));
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      grant_type: 'authorization_code',
      client_id: 'mobile',
      code: 'c',
      redirect_uri: 'https://x.com/cb',
    }, env));
    expect(res.status).toBe(400);
    expect((await res.json() as { error_description: string }).error_description).toContain('already used');
  });

  it('confidential client requires + verifies client_secret', async () => {
    const secretHash = await hashPassword('correct-secret-1');
    const CONFIDENTIAL = {
      client_id: 'partner',
      client_type: 'confidential',
      client_secret_hash: secretHash,
      status: 'active',
    };
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(CONFIDENTIAL);
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };

    // Wrong secret
    const r1 = await onRequestPost(makeContext({
      grant_type: 'authorization_code',
      client_id: 'partner',
      client_secret: 'wrong-secret-2',
      code: 'c',
      redirect_uri: 'r',
    }, env));
    expect(r1.status).toBe(401);
    expect((await r1.json() as { error: string }).error).toBe('invalid_client');
  }, 60_000);
});
