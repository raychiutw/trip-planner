/**
 * GET /api/oauth/userinfo unit test — V2-P1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet } from '../../functions/api/oauth/userinfo';
import { signSessionToken } from '../../src/server/session';

const SECRET = 'test-userinfo-secret';

interface MockEnv {
  SESSION_SECRET?: string;
  DB?: { prepare: ReturnType<typeof vi.fn> };
}

function makeStmt(firstResult: unknown = null) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(firstResult),
  };
  return stmt;
}

function makeContext(url: string, env: MockEnv, cookie?: string): Parameters<typeof onRequestGet>[0] {
  return {
    request: new Request(url, { headers: cookie ? { Cookie: cookie } : undefined }),
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

describe('GET /api/oauth/userinfo', () => {
  it('throws AUTH_REQUIRED when no session cookie', async () => {
    const env: MockEnv = { SESSION_SECRET: SECRET, DB: { prepare: vi.fn() } };
    await expect(onRequestGet(makeContext('https://x.com/api/oauth/userinfo', env))).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('throws AUTH_REQUIRED when session token invalid', async () => {
    const env: MockEnv = { SESSION_SECRET: SECRET, DB: { prepare: vi.fn() } };
    await expect(
      onRequestGet(makeContext('https://x.com/api/oauth/userinfo', env, 'tripline_session=tampered.signature')),
    ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('returns 200 + user payload when session valid + user exists', async () => {
    const token = await signSessionToken('user-uuid-1', SECRET);
    const stmt = makeStmt({
      id: 'user-uuid-1',
      email: 'me@example.com',
      email_verified_at: '2026-04-25T00:00:00.000Z',
      display_name: 'Me',
      avatar_url: 'https://avatar.example.com/me.png',
      created_at: '2026-04-20T00:00:00.000Z',
    });
    const env: MockEnv = {
      SESSION_SECRET: SECRET,
      DB: { prepare: vi.fn().mockReturnValue(stmt) },
    };
    const res = await onRequestGet(makeContext('https://x.com/api/oauth/userinfo', env, `tripline_session=${token}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    const json = await res.json() as Record<string, unknown>;
    expect(json).toEqual({
      id: 'user-uuid-1',
      email: 'me@example.com',
      emailVerified: true,
      displayName: 'Me',
      avatarUrl: 'https://avatar.example.com/me.png',
      createdAt: '2026-04-20T00:00:00.000Z',
    });
  });

  it('emailVerified = false when email_verified_at is null', async () => {
    const token = await signSessionToken('u', SECRET);
    const stmt = makeStmt({
      id: 'u', email: 'u@x.com',
      email_verified_at: null,
      display_name: null, avatar_url: null,
      created_at: '2026-04-25',
    });
    const env: MockEnv = { SESSION_SECRET: SECRET, DB: { prepare: vi.fn().mockReturnValue(stmt) } };
    const res = await onRequestGet(makeContext('https://x.com/api/oauth/userinfo', env, `tripline_session=${token}`));
    const json = await res.json() as { emailVerified: boolean; displayName: null; avatarUrl: null };
    expect(json.emailVerified).toBe(false);
    expect(json.displayName).toBeNull();
    expect(json.avatarUrl).toBeNull();
  });

  it('throws AUTH_INVALID when session valid but user row missing (deleted user)', async () => {
    const token = await signSessionToken('ghost-user', SECRET);
    const stmt = makeStmt(null); // user not found
    const env: MockEnv = { SESSION_SECRET: SECRET, DB: { prepare: vi.fn().mockReturnValue(stmt) } };
    await expect(
      onRequestGet(makeContext('https://x.com/api/oauth/userinfo', env, `tripline_session=${token}`)),
    ).rejects.toMatchObject({ code: 'AUTH_INVALID' });
  });

  it('SQL filters by uid from session', async () => {
    const token = await signSessionToken('specific-uid', SECRET);
    const stmt = makeStmt({
      id: 'specific-uid', email: 'x@x.com',
      email_verified_at: null, display_name: null, avatar_url: null,
      created_at: '2026-04-25',
    });
    const prepare = vi.fn().mockReturnValue(stmt);
    const env: MockEnv = { SESSION_SECRET: SECRET, DB: { prepare } };
    await onRequestGet(makeContext('https://x.com/api/oauth/userinfo', env, `tripline_session=${token}`));
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('WHERE id = ?'));
    expect(stmt.bind).toHaveBeenCalledWith('specific-uid');
  });
});
