/**
 * POST /api/oauth/token unit test — V2-P4
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost } from '../../functions/api/oauth/token';
import { hashPassword } from '../../src/server/password';

interface MockEnv {
  DB?: { prepare: ReturnType<typeof vi.fn> };
  OAUTH_SIGNING_PRIVATE_KEY?: string;
}

async function generateTestPrivateKeyBase64(): Promise<string> {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const exported = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
  const bytes = new Uint8Array(exported);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]!);
  return btoa(str);
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
      // `consumed` is undefined by default (fresh code). Override with a timestamp
      // to simulate a code that's already been used (replay test).
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
    request: new Request('https://x.com/api/oauth/token', {
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

describe('POST /api/oauth/token', () => {
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

  it('400 invalid_grant when code already consumed (replay protection)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      if (sql.includes('SELECT payload')) {
        // Real D1Adapter.consume() sets `$.consumed` (timestamp), not `used`.
        // Test mirrors production semantics so the test would catch a regression
        // where token.ts checks the wrong field.
        return makeStmt(makeAuthorizationCodePayload({ consumed: Date.now() - 1000 }));
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

  it('replay attack triggers cascade revoke of access+refresh tokens (RFC 6749 §10.5)', async () => {
    const sqls: string[] = [];
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      sqls.push(sql);
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      if (sql.includes('SELECT payload')) {
        // grantId persisted on the code at consume() time → enables cascade
        return makeStmt(makeAuthorizationCodePayload({ consumed: Date.now() - 1000, grantId: 'grant-xyz' }));
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    await onRequestPost(makeContext({
      grant_type: 'authorization_code',
      client_id: 'mobile',
      code: 'c',
      redirect_uri: 'https://x.com/cb',
    }, env));
    // revokeByGrantId fires DELETE FROM oauth_models WHERE json_extract(payload, '$.grantId')
    expect(sqls.some((s) => s.includes('DELETE FROM oauth_models WHERE json_extract(payload'))).toBe(true);
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

describe('POST /api/oauth/token — refresh_token grant', () => {
  it('happy path: rotate refresh + issue new access', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      if (sql.includes('SELECT payload, expires_at FROM oauth_models')) {
        return makeStmt({
          payload: JSON.stringify({
            client_id: 'mobile',
            user_id: 'u1',
            scopes: ['openid', 'profile'],
            grantId: 'g1',
          }),
          expires_at: Date.now() + 60000,
        });
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      grant_type: 'refresh_token',
      client_id: 'mobile',
      refresh_token: 'old-refresh-token',
    }, env));

    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(typeof json.access_token).toBe('string');
    expect(typeof json.refresh_token).toBe('string');
    expect(json.token_type).toBe('Bearer');
    expect(json.scope).toBe('openid profile');

    // Old refresh token marked consumed (NOT destroyed — kept for reuse detection)
    const sqls = dbPrepare.mock.calls.map((c) => c[0] as string);
    expect(sqls.some((s) => s.includes('UPDATE oauth_models SET payload = json_set'))).toBe(true);
    // New refresh_token must differ from the one we passed in (rotation guarantee)
    expect(json.refresh_token).not.toBe('old-refresh-token');
    expect(typeof json.refresh_token).toBe('string');
    expect((json.refresh_token as string).length).toBeGreaterThan(40);
  });

  it('refresh-token reuse detection cascades family revoke (OAuth 2.1 §6.1)', async () => {
    const sqls: string[] = [];
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      sqls.push(sql);
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      if (sql.includes('SELECT payload, expires_at FROM oauth_models')) {
        // Token row exists BUT was already consumed by an earlier rotation —
        // means an attacker is replaying a stolen refresh_token.
        return makeStmt({
          payload: JSON.stringify({
            client_id: 'mobile',
            user_id: 'u1',
            scopes: ['openid'],
            grantId: 'family-1',
            consumed: Date.now() - 5000,
          }),
          expires_at: Date.now() + 60_000,
        });
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      grant_type: 'refresh_token',
      client_id: 'mobile',
      refresh_token: 'leaked',
    }, env));
    expect(res.status).toBe(400);
    expect((await res.json() as { error_description: string }).error_description).toContain('reuse detected');
    // Cascade DELETE on grantId ran for both AccessToken + RefreshToken
    const cascadeCalls = sqls.filter((s) => s.includes('DELETE FROM oauth_models WHERE json_extract(payload'));
    expect(cascadeCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('400 invalid_grant when refresh_token unknown / expired', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      if (sql.includes('SELECT payload')) return makeStmt(null);
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      grant_type: 'refresh_token',
      client_id: 'mobile',
      refresh_token: 'expired',
    }, env));
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('invalid_grant');
  });

  it('400 invalid_grant when refresh_token belongs to other client (anti-token theft)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      if (sql.includes('SELECT payload')) {
        return makeStmt({
          payload: JSON.stringify({
            client_id: 'other-client',
            user_id: 'u1',
            scopes: ['openid'],
            grantId: 'g1',
          }),
          expires_at: Date.now() + 60000,
        });
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      grant_type: 'refresh_token',
      client_id: 'mobile',
      refresh_token: 'someone-elses-token',
    }, env));
    expect(res.status).toBe(400);
    expect((await res.json() as { error_description: string }).error_description).toContain('does not belong');
  });

  it('400 invalid_request when refresh_token missing', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      grant_type: 'refresh_token',
      client_id: 'mobile',
      // missing refresh_token
    }, env));
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('invalid_request');
  });

  it('Scope downgrade allowed (subset of stored), widening rejected', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      if (sql.includes('SELECT payload')) {
        return makeStmt({
          payload: JSON.stringify({
            client_id: 'mobile',
            user_id: 'u1',
            scopes: ['openid', 'profile', 'email'],
            grantId: 'g1',
          }),
          expires_at: Date.now() + 60000,
        });
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    // Downgrade ok
    const r1 = await onRequestPost(makeContext({
      grant_type: 'refresh_token',
      client_id: 'mobile',
      refresh_token: 'tok',
      scope: 'openid',
    }, env));
    expect(r1.status).toBe(200);
    expect(((await r1.json()) as { scope: string }).scope).toBe('openid');

    // Widening rejected
    const dbPrepare2 = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      if (sql.includes('SELECT payload')) {
        return makeStmt({
          payload: JSON.stringify({
            client_id: 'mobile',
            user_id: 'u1',
            scopes: ['openid'],
            grantId: 'g1',
          }),
          expires_at: Date.now() + 60000,
        });
      }
      return makeStmt();
    });
    const env2: MockEnv = { DB: { prepare: dbPrepare2 } };
    const r2 = await onRequestPost(makeContext({
      grant_type: 'refresh_token',
      client_id: 'mobile',
      refresh_token: 'tok',
      scope: 'openid admin',
    }, env2));
    expect(r2.status).toBe(400);
    expect(((await r2.json()) as { error: string }).error).toBe('invalid_scope');
  });

  it('id_token issued when scope=openid + signing key configured (V2-P5)', async () => {
    const signingKey = await generateTestPrivateKeyBase64();
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      if (sql.includes('SELECT payload, expires_at FROM oauth_models')) {
        return makeStmt(makeAuthorizationCodePayload());
      }
      if (sql.includes('SELECT id, email, display_name')) {
        return makeStmt({
          id: 'user-1',
          email: 'user@example.com',
          display_name: 'Test User',
          email_verified_at: '2026-04-20',
        });
      }
      return makeStmt();
    });
    const env: MockEnv = {
      DB: { prepare: dbPrepare },
      OAUTH_SIGNING_PRIVATE_KEY: signingKey,
    };
    const res = await onRequestPost(makeContext({
      grant_type: 'authorization_code',
      client_id: 'mobile',
      code: 'auth-code-xyz',
      redirect_uri: 'https://x.com/cb',
    }, env));

    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, string>;
    expect(typeof json.id_token).toBe('string');

    // Parse JWT manually (header.payload.sig)
    const parts = json.id_token.split('.');
    expect(parts.length).toBe(3);
    const padded = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (padded.length % 4)) % 4;
    const claims = JSON.parse(atob(padded + '='.repeat(padLen))) as Record<string, unknown>;
    expect(claims.iss).toBe('https://x.com');
    expect(claims.sub).toBe('user-1');
    expect(claims.aud).toBe('mobile');
    expect(claims.email).toBe('user@example.com');
    expect(claims.email_verified).toBe(true);
    expect(claims.name).toBe('Test User');
    expect(typeof claims.iat).toBe('number');
    expect(typeof claims.exp).toBe('number');
    expect(claims.exp).toBeGreaterThan(claims.iat as number);
  });

  it('NO id_token when scope lacks openid (just trips:read)', async () => {
    const signingKey = await generateTestPrivateKeyBase64();
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      if (sql.includes('SELECT payload, expires_at FROM oauth_models')) {
        return makeStmt(makeAuthorizationCodePayload({ scopes: ['trips.read'] }));
      }
      return makeStmt();
    });
    const env: MockEnv = {
      DB: { prepare: dbPrepare },
      OAUTH_SIGNING_PRIVATE_KEY: signingKey,
    };
    const res = await onRequestPost(makeContext({
      grant_type: 'authorization_code',
      client_id: 'mobile',
      code: 'c',
      redirect_uri: 'https://x.com/cb',
    }, env));

    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.id_token).toBeUndefined();
  });

  it('access_token still issued when openid scope but signing key missing (graceful degrade)', async () => {
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
      code: 'c',
      redirect_uri: 'https://x.com/cb',
    }, env));
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(typeof json.access_token).toBe('string');
    expect(json.id_token).toBeUndefined();
  });

  it('429 rate_limited when client bucket locked (V2-P6 throughput cap)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM rate_limit_buckets')) {
        return makeStmt({
          bucket_key: 'oauth-token:mobile',
          count: 101,
          window_start: Date.now(),
          locked_until: Date.now() + 30_000,
        });
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      grant_type: 'authorization_code',
      client_id: 'mobile',
      code: 'c', redirect_uri: 'r',
    }, env));
    expect(res.status).toBe(429);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('rate_limited');
    expect(res.headers.get('Retry-After')).toBeTruthy();
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('Bumps oauth-token bucket on every request (success or failure)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM rate_limit_buckets')) return makeStmt(null);
      if (sql.includes('FROM client_apps')) return makeStmt(null);
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      grant_type: 'authorization_code',
      client_id: 'mobile',
      code: 'c', redirect_uri: 'r',
    }, env));
    expect(res.status).toBe(401);
    const inserts = dbPrepare.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT OR REPLACE INTO rate_limit_buckets'),
    );
    expect(inserts.length).toBe(1);
  });
});

describe('POST /api/oauth/token — client_credentials grant (RFC 6749 §4.4)', () => {
  it('confidential client + correct secret + admin scope → 200 with access_token only (no refresh)', async () => {
    const secretHash = await hashPassword('the-secret-1');
    const CONFIDENTIAL_CLI = {
      client_id: 'tripline-internal-cli',
      client_type: 'confidential',
      client_secret_hash: secretHash,
      status: 'active',
      allowed_scopes: '["admin","trips:read","trips:write"]',
    };
    const sqls: string[] = [];
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      sqls.push(sql);
      if (sql.includes('FROM client_apps')) return makeStmt(CONFIDENTIAL_CLI);
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      grant_type: 'client_credentials',
      client_id: 'tripline-internal-cli',
      client_secret: 'the-secret-1',
      scope: 'admin',
    }, env));
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(typeof json.access_token).toBe('string');
    expect(json.refresh_token).toBeUndefined(); // §4.4.3 — no refresh
    expect(json.token_type).toBe('Bearer');
    expect(json.scope).toBe('admin');
    // Stored in AccessToken adapter
    expect(sqls.some((s) => s.includes('INSERT OR REPLACE INTO oauth_models'))).toBe(true);
  }, 60_000);

  it('public client → 401 unauthorized_client (client_credentials only for confidential)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt({
        ...PUBLIC_CLIENT,
        allowed_scopes: '["admin"]',
      });
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      grant_type: 'client_credentials',
      client_id: 'mobile',
      scope: 'admin',
    }, env));
    expect(res.status).toBe(401);
    expect((await res.json() as { error: string }).error).toBe('unauthorized_client');
  });

  it('scope outside allowed_scopes → 400 invalid_scope', async () => {
    const secretHash = await hashPassword('secret-1234');
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt({
        client_id: 'cli',
        client_type: 'confidential',
        client_secret_hash: secretHash,
        status: 'active',
        allowed_scopes: '["trips:read"]', // no admin
      });
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      grant_type: 'client_credentials',
      client_id: 'cli',
      client_secret: 'secret-1234',
      scope: 'admin',
    }, env));
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('invalid_scope');
  }, 60_000);

  it('omitting scope param → defaults to all client.allowed_scopes', async () => {
    const secretHash = await hashPassword('secret-1234');
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt({
        client_id: 'cli',
        client_type: 'confidential',
        client_secret_hash: secretHash,
        status: 'active',
        allowed_scopes: '["admin","trips:read"]',
      });
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({
      grant_type: 'client_credentials',
      client_id: 'cli',
      client_secret: 'secret-1234',
    }, env));
    expect(res.status).toBe(200);
    const json = await res.json() as { scope: string };
    expect(json.scope).toBe('admin trips:read');
  }, 60_000);
});
