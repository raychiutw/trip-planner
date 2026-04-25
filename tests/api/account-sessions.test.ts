/**
 * /api/account/sessions + /sessions/:sid — V2-P6 multi-device session API
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet, onRequestDelete as onDeleteAll } from '../../functions/api/account/sessions';
import { onRequestDelete as onDeleteOne } from '../../functions/api/account/sessions/[sid]';
import { issueSession } from '../../functions/api/_session';

interface MockEnv {
  SESSION_SECRET?: string;
  DB?: { prepare: ReturnType<typeof vi.fn> };
}

function makeStmt(firstResult: unknown = null, allResults: unknown[] = [], runMeta: { changes?: number } = { changes: 1 }) {
  return {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(firstResult),
    run: vi.fn().mockResolvedValue({ meta: runMeta }),
    all: vi.fn().mockResolvedValue({ results: allResults }),
  };
}

async function makeAuthedRequest(url: string, method: 'GET' | 'DELETE'): Promise<Request> {
  // For these tests we use a stub fetch — issueSession needs SESSION_SECRET + DB
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

function makeContext(
  request: Request,
  env: MockEnv,
  params: Record<string, string> = {},
): Parameters<typeof onRequestGet>[0] {
  return {
    request,
    env: env as unknown as never,
    params: params as unknown as never,
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

describe('GET /api/account/sessions', () => {
  it('401 when no session', async () => {
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: vi.fn() } };
    const req = new Request('https://x.com/api/account/sessions');
    await expect(onRequestGet(makeContext(req, env)))
      .rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('200 returns sessions list with current marked', async () => {
    const stmt = makeStmt(null, [
      {
        sid: 'sid-1',
        ua_summary: 'Chrome · macOS',
        ip_hash: 'abc123def456',
        created_at: '2026-04-20T00:00:00Z',
        last_seen_at: '2026-04-25T00:00:00Z',
      },
      {
        sid: 'sid-2',
        ua_summary: 'Safari · iOS',
        ip_hash: 'xyz789abc',
        created_at: '2026-04-22T00:00:00Z',
        last_seen_at: '2026-04-24T00:00:00Z',
      },
    ]);
    // For getSessionUser revocation check (not revoked → null result returned by first)
    const dbPrepare = vi.fn().mockReturnValue(stmt);
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: dbPrepare },
    };
    const req = await makeAuthedRequest('https://x.com/api/account/sessions', 'GET');
    const res = await onRequestGet(makeContext(req, env));
    expect(res.status).toBe(200);
    const json = await res.json() as {
      current_sid: string | null;
      sessions: Array<{ sid: string; ip_hash_prefix: string | null; is_current: boolean }>;
    };
    expect(json.sessions).toHaveLength(2);
    // ip_hash truncated to 8 chars
    expect(json.sessions[0]?.ip_hash_prefix).toBe('abc123de');
    expect(json.sessions[0]?.ip_hash_prefix?.length).toBe(8);
  });

  it('SQL filters by user_id from session', async () => {
    const stmt = makeStmt(null, []);
    const dbPrepare = vi.fn().mockReturnValue(stmt);
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: dbPrepare },
    };
    const req = await makeAuthedRequest('https://x.com/api/account/sessions', 'GET');
    await onRequestGet(makeContext(req, env));

    const sessionSelect = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('SELECT sid, ua_summary'),
    );
    expect(sessionSelect).toBeTruthy();
    expect((sessionSelect![0] as string)).toContain('WHERE user_id = ?');
    expect((sessionSelect![0] as string)).toContain('revoked_at IS NULL');
  });
});

describe('DELETE /api/account/sessions (revoke all others)', () => {
  it('401 when no session', async () => {
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: vi.fn() } };
    const req = new Request('https://x.com/api/account/sessions', { method: 'DELETE' });
    await expect(onDeleteAll(makeContext(req, env)))
      .rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('200 + revokes all other sessions for current user', async () => {
    const stmt = makeStmt(null, [], { changes: 3 });
    const dbPrepare = vi.fn().mockReturnValue(stmt);
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: dbPrepare },
    };
    const req = await makeAuthedRequest('https://x.com/api/account/sessions', 'DELETE');
    const res = await onDeleteAll(makeContext(req, env));
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; revoked: number };
    expect(json.ok).toBe(true);
    expect(json.revoked).toBe(3);

    const updateSql = dbPrepare.mock.calls
      .map((c) => c[0] as string)
      .find((s) => s.includes('UPDATE session_devices SET revoked_at'));
    expect(updateSql).toBeTruthy();
  });
});

describe('DELETE /api/account/sessions/:sid (revoke specific)', () => {
  it('401 when no session', async () => {
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: vi.fn() } };
    const req = new Request('https://x.com/api/account/sessions/sid-x', { method: 'DELETE' });
    await expect(onDeleteOne(makeContext(req, env, { sid: 'sid-x' })))
      .rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('400 when sid param missing', async () => {
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: vi.fn().mockReturnValue(makeStmt()) } };
    const req = await makeAuthedRequest('https://x.com/api/account/sessions/', 'DELETE');
    await expect(onDeleteOne(makeContext(req, env, {})))
      .rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });

  it('404 SESSION_NOT_FOUND when sid doesn\'t belong to user', async () => {
    // SQL UPDATE with WHERE user_id = current → 0 changes if cross-user attempt
    const stmt = makeStmt(null, [], { changes: 0 });
    const dbPrepare = vi.fn().mockReturnValue(stmt);
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: dbPrepare },
    };
    const req = await makeAuthedRequest('https://x.com/api/account/sessions/other-user-sid', 'DELETE');
    const res = await onDeleteOne(makeContext(req, env, { sid: 'other-user-sid' }));
    expect(res.status).toBe(404);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('SESSION_NOT_FOUND');
  });

  it('200 + UPDATE revoked_at when sid belongs to user', async () => {
    const stmt = makeStmt(null, [], { changes: 1 });
    const dbPrepare = vi.fn().mockReturnValue(stmt);
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: dbPrepare },
    };
    const req = await makeAuthedRequest('https://x.com/api/account/sessions/my-sid', 'DELETE');
    const res = await onDeleteOne(makeContext(req, env, { sid: 'my-sid' }));
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; revoked_sid: string };
    expect(json.ok).toBe(true);
    expect(json.revoked_sid).toBe('my-sid');

    // SQL filters by both sid AND user_id (cross-user defence)
    const sql = dbPrepare.mock.calls
      .map((c) => c[0] as string)
      .find((s) => s.includes('UPDATE session_devices'));
    expect(sql).toBeTruthy();
    expect(sql).toContain('WHERE sid = ? AND user_id = ?');
  });
});
