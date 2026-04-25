/**
 * POST /api/oauth/server-consent unit test — V2-P5
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost } from '../../functions/api/oauth/server-consent';
import { signSessionToken } from '../../src/server/session';

const SECRET = 'session-secret-test';

interface MockEnv {
  SESSION_SECRET?: string;
  DB?: { prepare: ReturnType<typeof vi.fn> };
}

function makeStmt() {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  };
  return stmt;
}

function makeContext(body: Record<string, string>, env: MockEnv, cookie?: string): Parameters<typeof onRequestPost>[0] {
  return {
    request: new Request('https://x.com/api/oauth/server-consent', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: new URLSearchParams(body).toString(),
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

describe('POST /api/oauth/server-consent', () => {
  it('302 to /login when no session (preserve params via redirect_after)', async () => {
    const env: MockEnv = { DB: { prepare: vi.fn() } };
    const res = await onRequestPost(makeContext({
      client_id: 'partner', redirect_uri: 'https://x.com/cb', scope: 'openid', state: 's',
      response_type: 'code', decision: 'allow',
    }, env));
    expect(res.status).toBe(302);
    const loc = res.headers.get('Location') ?? '';
    expect(loc).toMatch(/^\/login\?redirect_after=/);
    expect(decodeURIComponent(loc)).toContain('/oauth/consent?');
    expect(decodeURIComponent(loc)).toContain('client_id=partner');
  });

  it('decision=deny → 302 redirect_uri?error=access_denied&state=', async () => {
    const token = await signSessionToken('u1', SECRET);
    const env: MockEnv = {
      SESSION_SECRET: SECRET,
      DB: { prepare: vi.fn().mockReturnValue(makeStmt()) },
    };
    const res = await onRequestPost(makeContext({
      client_id: 'partner', redirect_uri: 'https://x.com/cb',
      scope: 'openid', state: 'csrf-1', decision: 'deny',
    }, env, `tripline_session=${token}`));
    expect(res.status).toBe(302);
    const loc = res.headers.get('Location') ?? '';
    expect(loc).toContain('https://x.com/cb');
    expect(loc).toContain('error=access_denied');
    expect(loc).toContain('state=csrf-1');
  });

  it('decision=allow → store Consent in D1 + 302 back to server-authorize', async () => {
    const dbPrepare = vi.fn().mockReturnValue(makeStmt());
    const token = await signSessionToken('u1', SECRET);
    const env: MockEnv = {
      SESSION_SECRET: SECRET,
      DB: { prepare: dbPrepare },
    };
    const res = await onRequestPost(makeContext({
      client_id: 'partner',
      redirect_uri: 'https://x.com/cb',
      response_type: 'code',
      scope: 'openid profile',
      state: 'csrf-x',
      decision: 'allow',
    }, env, `tripline_session=${token}`));

    expect(res.status).toBe(302);
    const loc = res.headers.get('Location') ?? '';
    expect(loc).toContain('/api/oauth/server-authorize?');
    expect(loc).toContain('client_id=partner');
    expect(loc).toContain('state=csrf-x');

    // INSERT Consent
    const insertCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT OR REPLACE INTO oauth_models'),
    );
    expect(insertCall).toBeTruthy();
    const stmt = dbPrepare.mock.results.find(
      (_, i) => typeof dbPrepare.mock.calls[i][0] === 'string' &&
                (dbPrepare.mock.calls[i][0] as string).includes('INSERT OR REPLACE'),
    )?.value;
    if (stmt) {
      const bindArgs = (stmt as { bind: { mock: { calls: unknown[][] } } }).bind.mock.calls[0];
      expect(bindArgs[0]).toBe('Consent');
      expect(bindArgs[1]).toBe('u1:partner'); // key = uid:client_id
      const payload = JSON.parse(bindArgs[2] as string);
      expect(payload.user_id).toBe('u1');
      expect(payload.client_id).toBe('partner');
      expect(payload.scopes).toEqual(['openid', 'profile']);
    }
  });

  it('400 invalid_request when decision missing or unknown', async () => {
    const token = await signSessionToken('u1', SECRET);
    const env: MockEnv = {
      SESSION_SECRET: SECRET,
      DB: { prepare: vi.fn().mockReturnValue(makeStmt()) },
    };
    const r1 = await onRequestPost(makeContext({
      client_id: 'p', redirect_uri: 'r', scope: 'openid',
    }, env, `tripline_session=${token}`));
    expect(r1.status).toBe(400);

    const r2 = await onRequestPost(makeContext({
      client_id: 'p', redirect_uri: 'r', scope: 'openid', decision: 'maybe',
    }, env, `tripline_session=${token}`));
    expect(r2.status).toBe(400);
  });

  it('400 when decision=allow but client_id missing', async () => {
    const token = await signSessionToken('u1', SECRET);
    const env: MockEnv = {
      SESSION_SECRET: SECRET,
      DB: { prepare: vi.fn().mockReturnValue(makeStmt()) },
    };
    const res = await onRequestPost(makeContext({
      decision: 'allow', scope: 'openid',
    }, env, `tripline_session=${token}`));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error_description: string }).error_description).toContain('client_id');
  });

  it('Consent TTL = 1 year', async () => {
    const dbPrepare = vi.fn().mockReturnValue(makeStmt());
    const token = await signSessionToken('u1', SECRET);
    const env: MockEnv = {
      SESSION_SECRET: SECRET,
      DB: { prepare: dbPrepare },
    };
    await onRequestPost(makeContext({
      client_id: 'p', redirect_uri: 'r', scope: 'openid',
      decision: 'allow', response_type: 'code', state: 's',
    }, env, `tripline_session=${token}`));
    const stmt = dbPrepare.mock.results.find(
      (_, i) => typeof dbPrepare.mock.calls[i][0] === 'string' &&
                (dbPrepare.mock.calls[i][0] as string).includes('INSERT OR REPLACE'),
    )?.value;
    if (stmt) {
      const bindArgs = (stmt as { bind: { mock: { calls: unknown[][] } } }).bind.mock.calls[0];
      const expiresAt = bindArgs[3] as number;
      // 1 year in ms
      expect(expiresAt).toBe(Date.now() + 365 * 24 * 60 * 60 * 1000);
    }
  });
});
