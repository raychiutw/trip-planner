/**
 * /api/dev/apps/:client_id — V2-P4 detail / update / suspend
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  onRequestGet,
  onRequestPatch,
  onRequestDelete,
} from '../../functions/api/dev/apps/[client_id]';
import { issueSession } from '../../functions/api/_session';

interface MockEnv {
  SESSION_SECRET?: string;
  DB?: { prepare: ReturnType<typeof vi.fn> };
}

function makeStmt(firstResult: unknown = null) {
  return {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(firstResult),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  };
}

const SAMPLE_APP_ROW = {
  client_id: 'tp_abc',
  client_type: 'public',
  app_name: 'Trip Buddy',
  app_description: 'Travel companion',
  app_logo_url: null,
  homepage_url: 'https://example.com',
  redirect_uris: '["https://example.com/cb"]',
  allowed_scopes: '["openid","profile"]',
  owner_user_id: 'user-1',
  status: 'active',
  created_at: '2026-04-20',
  updated_at: '2026-04-22',
};

async function makeAuthedRequest(url: string, method: string, body?: unknown): Promise<Request> {
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
      Cookie: sessionCookie,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeContext(
  request: Request,
  env: MockEnv,
  clientId: string,
): Parameters<typeof onRequestGet>[0] {
  return {
    request,
    env: env as unknown as never,
    params: { client_id: clientId } as unknown as never,
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

describe('GET /api/dev/apps/:client_id', () => {
  it('401 when no session', async () => {
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: vi.fn() } };
    const req = new Request('https://x.com/api/dev/apps/tp_abc', { method: 'GET' });
    await expect(onRequestGet(makeContext(req, env, 'tp_abc')))
      .rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('404 APP_NOT_FOUND when client_id not owned by user', async () => {
    const stmt = makeStmt(null); // not found
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: vi.fn().mockReturnValue(stmt) },
    };
    const req = await makeAuthedRequest('https://x.com/api/dev/apps/tp_xyz', 'GET');
    const res = await onRequestGet(makeContext(req, env, 'tp_xyz'));
    expect(res.status).toBe(404);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('APP_NOT_FOUND');
  });

  it('200 returns full row with parsed redirect_uris + allowed_scopes', async () => {
    const stmt = makeStmt(SAMPLE_APP_ROW);
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: vi.fn().mockReturnValue(stmt) },
    };
    const req = await makeAuthedRequest('https://x.com/api/dev/apps/tp_abc', 'GET');
    const res = await onRequestGet(makeContext(req, env, 'tp_abc'));
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.client_id).toBe('tp_abc');
    expect(json.app_name).toBe('Trip Buddy');
    expect(json.redirect_uris).toEqual(['https://example.com/cb']);
    expect(json.allowed_scopes).toEqual(['openid', 'profile']);
  });

  it('SQL filters by both client_id AND owner_user_id (cross-user attack defence)', async () => {
    const stmt = makeStmt(SAMPLE_APP_ROW);
    const dbPrepare = vi.fn().mockReturnValue(stmt);
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: dbPrepare },
    };
    const req = await makeAuthedRequest('https://x.com/api/dev/apps/tp_abc', 'GET');
    await onRequestGet(makeContext(req, env, 'tp_abc'));

    const sql = dbPrepare.mock.calls[0][0] as string;
    expect(sql).toContain('WHERE client_id = ? AND owner_user_id = ?');
    expect(stmt.bind).toHaveBeenCalledWith('tp_abc', 'user-1');
  });
});

describe('PATCH /api/dev/apps/:client_id', () => {
  it('401 when no session', async () => {
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: vi.fn() } };
    const req = new Request('https://x.com/api/dev/apps/tp_abc', { method: 'PATCH' });
    await expect(onRequestPatch(makeContext(req, env, 'tp_abc')))
      .rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('404 when client_id not owned', async () => {
    const stmt = makeStmt(null);
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: vi.fn().mockReturnValue(stmt) },
    };
    const req = await makeAuthedRequest('https://x.com/api/dev/apps/tp_xyz', 'PATCH', {
      app_name: 'New Name',
    });
    const res = await onRequestPatch(makeContext(req, env, 'tp_xyz'));
    expect(res.status).toBe(404);
  });

  it('400 when no patchable fields provided', async () => {
    const dbPrepare = vi.fn().mockImplementation(() => makeStmt(SAMPLE_APP_ROW));
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: dbPrepare },
    };
    const req = await makeAuthedRequest('https://x.com/api/dev/apps/tp_abc', 'PATCH', {});
    await expect(onRequestPatch(makeContext(req, env, 'tp_abc')))
      .rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });

  it('400 when app_name too short', async () => {
    const dbPrepare = vi.fn().mockImplementation(() => makeStmt(SAMPLE_APP_ROW));
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: dbPrepare },
    };
    const req = await makeAuthedRequest('https://x.com/api/dev/apps/tp_abc', 'PATCH', {
      app_name: 'X',
    });
    await expect(onRequestPatch(makeContext(req, env, 'tp_abc')))
      .rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });

  it('400 when redirect_uris contains non-HTTPS', async () => {
    const dbPrepare = vi.fn().mockImplementation(() => makeStmt(SAMPLE_APP_ROW));
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: dbPrepare },
    };
    const req = await makeAuthedRequest('https://x.com/api/dev/apps/tp_abc', 'PATCH', {
      redirect_uris: ['http://attacker.com/cb'],
    });
    await expect(onRequestPatch(makeContext(req, env, 'tp_abc')))
      .rejects.toMatchObject({ code: 'DATA_VALIDATION' });
  });

  it('200 updates allowed fields + returns updated row', async () => {
    let callCount = 0;
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT')) {
        // First select returns existing, second select returns updated
        callCount++;
        if (callCount === 1) return makeStmt(SAMPLE_APP_ROW);
        return makeStmt({ ...SAMPLE_APP_ROW, app_name: 'New Name' });
      }
      if (sql.includes('UPDATE client_apps')) return makeStmt();
      return makeStmt();
    });
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: dbPrepare },
    };
    const req = await makeAuthedRequest('https://x.com/api/dev/apps/tp_abc', 'PATCH', {
      app_name: 'New Name',
      app_description: 'Updated description',
    });
    const res = await onRequestPatch(makeContext(req, env, 'tp_abc'));
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.app_name).toBe('New Name');

    // Verify UPDATE called with the right fields
    const updateCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE client_apps'),
    );
    expect(updateCall).toBeTruthy();
    const updateSql = updateCall![0] as string;
    expect(updateSql).toContain('app_name = ?');
    expect(updateSql).toContain('app_description = ?');
    expect(updateSql).toContain('updated_at = datetime');
  });

  it('Cannot update protected fields (client_id / client_type / status / owner_user_id)', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT')) return makeStmt(SAMPLE_APP_ROW);
      if (sql.includes('UPDATE')) return makeStmt();
      return makeStmt();
    });
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: dbPrepare },
    };
    const req = await makeAuthedRequest('https://x.com/api/dev/apps/tp_abc', 'PATCH', {
      app_name: 'New',
      client_id: 'malicious',          // ignored
      client_type: 'confidential',      // ignored
      status: 'active',                 // ignored
      owner_user_id: 'attacker',        // ignored
    } as Record<string, unknown>);
    await onRequestPatch(makeContext(req, env, 'tp_abc'));

    const updateCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE client_apps'),
    );
    const sql = updateCall![0] as string;
    // None of the protected columns should appear in UPDATE SET clause
    expect(sql).not.toMatch(/SET[^W]*client_id\s*=/);
    expect(sql).not.toMatch(/SET[^W]*client_type\s*=/);
    expect(sql).not.toMatch(/SET[^W]*status\s*=/);
    expect(sql).not.toMatch(/SET[^W]*owner_user_id\s*=/);
  });
});

describe('DELETE /api/dev/apps/:client_id', () => {
  it('401 when no session', async () => {
    const env: MockEnv = { SESSION_SECRET: 'test-secret-32-chars-long-enough', DB: { prepare: vi.fn() } };
    const req = new Request('https://x.com/api/dev/apps/tp_abc', { method: 'DELETE' });
    await expect(onRequestDelete(makeContext(req, env, 'tp_abc')))
      .rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('404 when client_id not owned', async () => {
    const stmt = makeStmt(null);
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: vi.fn().mockReturnValue(stmt) },
    };
    const req = await makeAuthedRequest('https://x.com/api/dev/apps/tp_xyz', 'DELETE');
    const res = await onRequestDelete(makeContext(req, env, 'tp_xyz'));
    expect(res.status).toBe(404);
  });

  it('200 soft-deletes (status=suspended) preserving audit trail', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT')) return makeStmt(SAMPLE_APP_ROW);
      if (sql.includes('UPDATE client_apps')) return makeStmt();
      return makeStmt();
    });
    const env: MockEnv = {
      SESSION_SECRET: 'test-secret-32-chars-long-enough',
      DB: { prepare: dbPrepare },
    };
    const req = await makeAuthedRequest('https://x.com/api/dev/apps/tp_abc', 'DELETE');
    const res = await onRequestDelete(makeContext(req, env, 'tp_abc'));
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; suspended_client_id: string };
    expect(json.ok).toBe(true);
    expect(json.suspended_client_id).toBe('tp_abc');

    // Verify UPDATE status='suspended' (NOT physical DELETE)
    const updateCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes("status = 'suspended'"),
    );
    expect(updateCall).toBeTruthy();
    // No DELETE FROM client_apps anywhere
    const deleteCall = dbPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('DELETE FROM client_apps'),
    );
    expect(deleteCall).toBeFalsy();
  });
});
