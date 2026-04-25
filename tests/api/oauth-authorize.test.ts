/**
 * GET /api/oauth/authorize unit test — V2-P1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet } from '../../functions/api/oauth/authorize';

interface MockEnv {
  GOOGLE_CLIENT_ID?: string;
  DB?: {
    prepare: ReturnType<typeof vi.fn>;
  };
}

function makeEnv(opts: { clientId?: string } = {}): MockEnv {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  };
  return {
    GOOGLE_CLIENT_ID: opts.clientId,
    DB: { prepare: vi.fn().mockReturnValue(stmt) },
  };
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
});

describe('GET /api/oauth/authorize', () => {
  it('rejects provider != google with 400 PROVIDER_UNSUPPORTED', async () => {
    const env = makeEnv({ clientId: 'gid' });
    const res = await onRequestGet(makeContext('https://x.com/api/oauth/authorize?provider=apple', env));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('PROVIDER_UNSUPPORTED');
  });

  it('rejects no provider param with 400', async () => {
    const env = makeEnv({ clientId: 'gid' });
    const res = await onRequestGet(makeContext('https://x.com/api/oauth/authorize', env));
    expect(res.status).toBe(400);
  });

  it('returns 503 OAUTH_NOT_CONFIGURED when GOOGLE_CLIENT_ID missing', async () => {
    const env = makeEnv({}); // no clientId
    const res = await onRequestGet(makeContext('https://x.com/api/oauth/authorize?provider=google', env));
    expect(res.status).toBe(503);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('OAUTH_NOT_CONFIGURED');
  });

  it('redirects 302 to Google authorize URL when configured', async () => {
    const env = makeEnv({ clientId: 'test-client-id' });
    const res = await onRequestGet(makeContext('https://trip-planner-dby.pages.dev/api/oauth/authorize?provider=google', env));
    expect(res.status).toBe(302);
    const location = res.headers.get('Location');
    expect(location).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
    expect(location).toContain('client_id=test-client-id');
    expect(location).toContain('response_type=code');
    expect(location).toContain('scope=openid+profile+email');
    expect(location).toContain('redirect_uri=https%3A%2F%2Ftrip-planner-dby.pages.dev%2Fapi%2Foauth%2Fcallback');
    expect(location).toContain('access_type=offline');
    expect(location).toContain('prompt=consent');
    expect(location).toMatch(/state=[A-Za-z0-9_-]+/);
  });

  it('stores state in D1 oauth_models with 5min TTL', async () => {
    const env = makeEnv({ clientId: 'gid' });
    await onRequestGet(makeContext('https://x.com/api/oauth/authorize?provider=google', env));

    expect(env.DB!.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE INTO oauth_models'));
    const stmt = env.DB!.prepare.mock.results[0].value;
    expect(stmt.bind).toHaveBeenCalledWith(
      'OAuthState',
      expect.any(String), // state
      expect.stringContaining('"provider":"google"'),
      Date.now() + 300 * 1000, // 5min TTL
    );
  });

  it('open redirect protection: redirect_after_login must start with single /', async () => {
    const env = makeEnv({ clientId: 'gid' });
    // open redirect attempt: //evil.com → 應 fallback default
    const res = await onRequestGet(makeContext('https://x.com/api/oauth/authorize?provider=google&redirect_after_login=//evil.com/steal', env));
    expect(res.status).toBe(302);
    // state stored 但 redirectAfterLogin 應 = /manage default
    const stmt = env.DB!.prepare.mock.results[0].value;
    const payload = JSON.parse(stmt.bind.mock.calls[0][2]);
    expect(payload.redirectAfterLogin).toBe('/manage');
  });

  it('open redirect protection: absolute URL → fallback default', async () => {
    const env = makeEnv({ clientId: 'gid' });
    const res = await onRequestGet(makeContext('https://x.com/api/oauth/authorize?provider=google&redirect_after_login=https://evil.com', env));
    expect(res.status).toBe(302);
    const stmt = env.DB!.prepare.mock.results[0].value;
    const payload = JSON.parse(stmt.bind.mock.calls[0][2]);
    expect(payload.redirectAfterLogin).toBe('/manage');
  });

  it('valid same-origin redirect_after_login preserved', async () => {
    const env = makeEnv({ clientId: 'gid' });
    await onRequestGet(makeContext('https://x.com/api/oauth/authorize?provider=google&redirect_after_login=/trip/test-trip', env));
    const stmt = env.DB!.prepare.mock.results[0].value;
    const payload = JSON.parse(stmt.bind.mock.calls[0][2]);
    expect(payload.redirectAfterLogin).toBe('/trip/test-trip');
  });

  it('state is unique across calls (32 bytes random)', async () => {
    const env1 = makeEnv({ clientId: 'gid' });
    const env2 = makeEnv({ clientId: 'gid' });
    const res1 = await onRequestGet(makeContext('https://x.com/api/oauth/authorize?provider=google', env1));
    const res2 = await onRequestGet(makeContext('https://x.com/api/oauth/authorize?provider=google', env2));
    const state1 = new URL(res1.headers.get('Location')!).searchParams.get('state');
    const state2 = new URL(res2.headers.get('Location')!).searchParams.get('state');
    expect(state1).not.toBe(state2);
    expect(state1!.length).toBeGreaterThan(40);
  });
});
