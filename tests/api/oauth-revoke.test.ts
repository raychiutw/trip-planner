/**
 * POST /api/oauth/revoke unit test — V2-P5 RFC 7009
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost } from '../../functions/api/oauth/revoke';

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

const PUBLIC_CLIENT = {
  client_id: 'mobile',
  client_type: 'public' as const,
  client_secret_hash: null,
  status: 'active',
};

function makeContext(body: Record<string, string>, env: MockEnv): Parameters<typeof onRequestPost>[0] {
  const formBody = new URLSearchParams(body).toString();
  return {
    request: new Request('https://x.com/api/oauth/revoke', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formBody,
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

describe('POST /api/oauth/revoke', () => {
  it('400 invalid_request when token missing', async () => {
    const env: MockEnv = { DB: { prepare: vi.fn() } };
    const res = await onRequestPost(makeContext({ client_id: 'c' }, env));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('invalid_request');
  });

  it('401 invalid_client when client_id unknown', async () => {
    const stmt = makeStmt(null);
    const env: MockEnv = { DB: { prepare: vi.fn().mockReturnValue(stmt) } };
    const res = await onRequestPost(makeContext({ token: 't', client_id: 'unknown' }, env));
    expect(res.status).toBe(401);
  });

  it('200 silent when token unknown (RFC 7009 anti-scanning)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      if (sql.includes('SELECT payload')) return makeStmt(null); // not found in either store
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({ token: 'unknown', client_id: 'mobile' }, env));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('200 + DELETE access_token row when found', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      if (sql.includes('SELECT payload')) {
        return makeStmt({
          payload: JSON.stringify({
            client_id: 'mobile',
            user_id: 'u',
            scopes: ['openid'],
            grantId: 'g1',
          }),
          expires_at: Date.now() + 60_000,
        });
      }
      if (sql.includes('DELETE FROM oauth_models')) return makeStmt();
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({ token: 'tok', client_id: 'mobile' }, env));
    expect(res.status).toBe(200);

    const deleteCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('DELETE FROM oauth_models'),
    );
    expect(deleteCall).toBeTruthy();
  });

  it('200 silent when token belongs to different client (anti-leak)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      if (sql.includes('SELECT payload')) {
        // Token exists but belongs to client OTHER than 'mobile'
        return makeStmt({
          payload: JSON.stringify({
            client_id: 'other-client',
            user_id: 'u',
            scopes: ['openid'],
            grantId: 'g',
          }),
          expires_at: Date.now() + 60_000,
        });
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({ token: 'tok', client_id: 'mobile' }, env));
    expect(res.status).toBe(200);
    // DELETE should NOT be called because client_id mismatch
    const deleteCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('DELETE FROM oauth_models'),
    );
    expect(deleteCall).toBeFalsy();
  });

  it('honors token_type_hint=refresh_token (look up RefreshToken first)', async () => {
    const lookupOrder: string[] = [];
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM client_apps')) return makeStmt(PUBLIC_CLIENT);
      if (sql.includes('SELECT payload')) {
        // Bind args identify which adapter is being used
        return {
          bind: vi.fn().mockImplementation(function(this: { lastArgs?: unknown[] }, ...args: unknown[]) {
            lookupOrder.push(args[0] as string);
            return this;
          }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
        };
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    await onRequestPost(makeContext({
      token: 't', client_id: 'mobile', token_type_hint: 'refresh_token',
    }, env));

    // First lookup should be RefreshToken (per hint)
    expect(lookupOrder[0]).toBe('RefreshToken');
    // Then fall back to AccessToken
    expect(lookupOrder[1]).toBe('AccessToken');
  });
});
