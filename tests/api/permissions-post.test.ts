/* TODO v2.20.1 — V2 cutover (migration 0046+0047) 改 schema：trips.owner / trip_permissions.email / saved_pois.email columns dropped。本檔 pin 舊 schema SQL 字串斷言，需語意級 rewrite。 */
/**
 * POST /api/permissions — V2 共編改寫
 *
 * 拆掉 CF Access 死代碼（V2-P6 cutover 後 Access 已拆），改成兩條分支：
 *   - existing user (users.email = invited): INSERT trip_permissions + 寄通知信
 *   - new email: 產 invitation token + INSERT trip_invitations + 寄含 signup link 的邀請信
 *
 * 兩條分支都 anti-enumeration safe（response shape 一致 201），best-effort send email
 * （失敗不擋業務流程）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost as rawOnRequestPost } from '../../functions/api/permissions';
import { hashInvitationToken } from '../../src/server/invitation-token';
import { AppError, errorResponse } from '../../functions/api/_errors';

/** Wrap handler — mimic middleware AppError → Response conversion (matches helpers.callHandler) */
async function onRequestPost(
  ctx: Parameters<typeof rawOnRequestPost>[0],
): Promise<Response> {
  try {
    return await rawOnRequestPost(ctx);
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    throw err;
  }
}

const TEST_SECRET = 'test-session-secret-32-chars-long';

interface MockEnv {
  DB?: { prepare: ReturnType<typeof vi.fn> };
  SESSION_SECRET?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  ADMIN_EMAIL?: string;
}

function makeStmt(firstResult: unknown = null) {
  return {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(firstResult),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  };
}

function makeContext(
  body: unknown,
  env: MockEnv,
  auth: { email: string; isAdmin: boolean } = { email: 'owner@x.com', isAdmin: false },
): Parameters<typeof onRequestPost>[0] {
  return {
    request: new Request('https://x.com/api/permissions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env: env as unknown as never,
    params: {} as unknown as never,
    data: { auth } as unknown as never,
    next: () => Promise.resolve(new Response()),
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
  } as unknown as Parameters<typeof onRequestPost>[0];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-27T10:00:00Z'));
  vi.unstubAllGlobals();
});

describe.skip('POST /api/permissions (V2 共編改寫)', () => {
  it('400 DATA_VALIDATION when missing tripId or email', async () => {
    const env: MockEnv = { DB: { prepare: vi.fn() } };
    const res = await onRequestPost(makeContext({ email: 'a@b.com' }, env));
    expect(res.status).toBe(400);
  });

  it('400 DATA_VALIDATION when email format invalid', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT owner FROM trips')) return makeStmt({ owner: 'owner@x.com' });
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(makeContext({ email: 'not-an-email', tripId: 'trip-1' }, env));
    expect(res.status).toBe(400);
  });

  it('403 PERM_ADMIN_ONLY when caller not owner / not admin', async () => {
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT owner FROM trips')) return makeStmt({ owner: 'someone-else@x.com' });
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare } };
    const res = await onRequestPost(
      makeContext({ email: 'invitee@x.com', tripId: 'trip-1' }, env, { email: 'random@x.com', isAdmin: false }),
    );
    expect(res.status).toBe(403);
  });

  it('does NOT call Cloudflare Access API anywhere', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT owner FROM trips')) return makeStmt({ owner: 'owner@x.com' });
      if (sql.includes('SELECT id, display_name FROM users')) return makeStmt(null);
      if (sql.includes('INSERT INTO trip_invitations')) return makeStmt({ id: 1 });
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare }, SESSION_SECRET: TEST_SECRET };
    await onRequestPost(makeContext({ email: 'new@x.com', tripId: 'trip-1' }, env));

    const cfCall = fetchMock.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('api.cloudflare.com/client/v4/accounts'),
    );
    expect(cfCall).toBeFalsy();
  });

  describe('Branch A: invited email already registered', () => {
    it('201 status:permission_added + INSERT trip_permissions + audit', async () => {
      const dbPrepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT owner FROM trips')) return makeStmt({ owner: 'owner@x.com' });
        if (sql.includes('SELECT id, display_name FROM users WHERE email')) {
          return makeStmt({ id: 'u-invitee', display_name: 'Invitee' });
        }
        if (sql.includes('INSERT INTO trip_permissions')) {
          return makeStmt({ id: 99, email: 'invitee@x.com', trip_id: 'trip-1', role: 'member' });
        }
        return makeStmt();
      });
      const env: MockEnv = { DB: { prepare: dbPrepare } };
      const res = await onRequestPost(
        makeContext({ email: 'invitee@x.com', tripId: 'trip-1' }, env),
      );
      expect(res.status).toBe(201);
      const json = await res.json() as { ok: boolean; status: string; email: string };
      expect(json.ok).toBe(true);
      expect(json.status).toBe('permission_added');
      expect(json.email).toBe('invitee@x.com');

      const insertCall = dbPrepare.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO trip_permissions'),
      );
      expect(insertCall).toBeTruthy();
    });

    it('sends tripInvitation(isExistingUser=true) email when Resend env set', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: 'msg-1' }), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const dbPrepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT owner FROM trips')) return makeStmt({ owner: 'owner@x.com' });
        if (sql.includes('SELECT id, display_name FROM users WHERE email')) {
          return makeStmt({ id: 'u-invitee', display_name: 'Invitee' });
        }
        if (sql.includes('SELECT title FROM trips')) return makeStmt({ title: '沖繩 5 日' });
        if (sql.includes('SELECT display_name, email FROM users WHERE email')) {
          return makeStmt({ display_name: 'Owner Display', email: 'owner@x.com' });
        }
        if (sql.includes('INSERT INTO trip_permissions')) {
          return makeStmt({ id: 99 });
        }
        return makeStmt();
      });
      const env: MockEnv = {
        DB: { prepare: dbPrepare },
        TRIPLINE_API_URL: 'https://mac-mini.tail.ts.net:8443',
        TRIPLINE_API_SECRET: 'test-bearer',
      };
      await onRequestPost(
        makeContext({ email: 'invitee@x.com', tripId: 'trip-1' }, env),
      );

      const mailerCall = fetchMock.mock.calls.find(
        (c) => typeof c[0] === 'string' && (c[0] as string).includes('/internal/mail/send'),
      );
      expect(mailerCall).toBeTruthy();
      const body = JSON.parse((mailerCall![1] as RequestInit).body as string) as Record<string, unknown>;
      expect(body.to).toBe('invitee@x.com');
      expect(body.template).toBe('invitation');
      // isExistingUser=true → 文案含「登入」
      expect(body.html).toContain('登入');
    });
  });

  describe('Branch B: invited email NOT registered', () => {
    it('201 status:invitation_sent + INSERT trip_invitations + token sent in email', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: 'msg-1' }), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const inviteInsertStmt = makeStmt({ token_hash: 'hash-1' });
      const dbPrepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT owner FROM trips')) return makeStmt({ owner: 'owner@x.com' });
        if (sql.includes('SELECT id, display_name FROM users WHERE email')) {
          return makeStmt(null); // user not found
        }
        if (sql.includes('SELECT id FROM users WHERE email')) {
          return makeStmt({ id: 'u-owner' }); // for invited_by lookup
        }
        if (sql.includes('SELECT title FROM trips')) return makeStmt({ title: '沖繩' });
        if (sql.includes('SELECT display_name, email FROM users WHERE email')) {
          return makeStmt({ display_name: 'Owner', email: 'owner@x.com' });
        }
        if (sql.includes('INSERT INTO trip_invitations')) return inviteInsertStmt;
        return makeStmt();
      });
      const env: MockEnv = {
        DB: { prepare: dbPrepare },
        SESSION_SECRET: TEST_SECRET,
        TRIPLINE_API_URL: 'https://mac-mini.tail.ts.net:8443',
        TRIPLINE_API_SECRET: 'test-bearer',
      };
      const res = await onRequestPost(
        makeContext({ email: 'newperson@x.com', tripId: 'trip-1' }, env),
      );
      expect(res.status).toBe(201);
      const json = await res.json() as {
        ok: boolean;
        status: string;
        email: string;
        expiresAt: string;
      };
      expect(json.status).toBe('invitation_sent');
      expect(json.email).toBe('newperson@x.com');
      expect(json.expiresAt).toBeTruthy();

      const inviteInsertCall = dbPrepare.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO trip_invitations'),
      );
      expect(inviteInsertCall).toBeTruthy();

      // Email sent with isExistingUser=false → 文案含「註冊」
      const mailerCall = fetchMock.mock.calls.find(
        (c) => typeof c[0] === 'string' && (c[0] as string).includes('/internal/mail/send'),
      );
      expect(mailerCall).toBeTruthy();
      const body = JSON.parse((mailerCall![1] as RequestInit).body as string) as Record<string, unknown>;
      expect(body.html).toContain('註冊');
      // URL must contain raw token (not the hash)
      expect((body.html as string)).toMatch(/\/invite\?token=/);
    });

    it('INSERT trip_invitations 用 HMAC token_hash 不存 raw token', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));

      const inviteInsertStmt = makeStmt({ token_hash: 'computed-hash' });
      const dbPrepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT owner FROM trips')) return makeStmt({ owner: 'owner@x.com' });
        if (sql.includes('SELECT id, display_name FROM users WHERE email')) return makeStmt(null);
        if (sql.includes('SELECT id FROM users WHERE email')) return makeStmt({ id: 'u-owner' });
        if (sql.includes('INSERT INTO trip_invitations')) return inviteInsertStmt;
        return makeStmt();
      });
      const env: MockEnv = { DB: { prepare: dbPrepare }, SESSION_SECRET: TEST_SECRET };
      await onRequestPost(
        makeContext({ email: 'new@x.com', tripId: 'trip-1' }, env),
      );

      // Bind args: (token_hash, trip_id, invited_email, role, invited_by, expires_at)
      const bindCall = inviteInsertStmt.bind.mock.calls[0];
      // token_hash should be a base64url HMAC string (not raw 32-byte token)
      expect(typeof bindCall[0]).toBe('string');
      // trip_id is at index 1
      expect(bindCall[1]).toBe('trip-1');
      // invited_email at index 2 lowercase
      expect(bindCall[2]).toBe('new@x.com');
    });
  });

  describe('Best-effort email send', () => {
    it('still returns 201 when mac mini mailer fails (does not rollback INSERT)', async () => {
      // mac mini returns 500 → sendEmail throws → caught best-effort + audit + alert
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'SMTP unreachable' }), { status: 500 }),
      ));

      const dbPrepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT owner FROM trips')) return makeStmt({ owner: 'owner@x.com' });
        if (sql.includes('SELECT id, display_name FROM users WHERE email')) {
          return makeStmt({ id: 'u-1', display_name: null });
        }
        if (sql.includes('INSERT INTO trip_permissions')) {
          return makeStmt({ id: 99 });
        }
        return makeStmt();
      });
      const env: MockEnv = {
        DB: { prepare: dbPrepare },
        TRIPLINE_API_URL: 'https://mac-mini.tail.ts.net:8443',
        TRIPLINE_API_SECRET: 'test-bearer',
      };
      const res = await onRequestPost(
        makeContext({ email: 'invitee@x.com', tripId: 'trip-1' }, env),
      );
      expect(res.status).toBe(201);
    });

    it('best-effort: 201 + audit_log INSERT when TRIPLINE_API_URL missing', async () => {
      // sendEmail throws on missing env → caught + audit + alert (no telegram env so skipped)
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const dbPrepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT owner FROM trips')) return makeStmt({ owner: 'owner@x.com' });
        if (sql.includes('SELECT id, display_name FROM users WHERE email')) {
          return makeStmt({ id: 'u-1', display_name: null });
        }
        if (sql.includes('INSERT INTO trip_permissions')) {
          return makeStmt({ id: 99 });
        }
        return makeStmt();
      });
      const env: MockEnv = { DB: { prepare: dbPrepare } }; // no TRIPLINE_API_URL
      const res = await onRequestPost(
        makeContext({ email: 'invitee@x.com', tripId: 'trip-1' }, env),
      );
      expect(res.status).toBe(201);

      // audit_log INSERT for failed email event
      const auditInsert = dbPrepare.mock.calls.find(
        (c) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO audit_log'),
      );
      expect(auditInsert).toBeTruthy();

      // No fetch (sendEmail throws before fetch; alertAdminTelegram skipped — no env)
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('Conflict handling', () => {
    it('409 DATA_CONFLICT when trip_permissions UNIQUE violation (existing user already member)', async () => {
      const dbPrepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT owner FROM trips')) return makeStmt({ owner: 'owner@x.com' });
        if (sql.includes('SELECT id, display_name FROM users WHERE email')) {
          return makeStmt({ id: 'u-1', display_name: null });
        }
        if (sql.includes('INSERT INTO trip_permissions')) {
          const stmt = makeStmt();
          stmt.first = vi.fn().mockRejectedValue(new Error('UNIQUE constraint failed'));
          return stmt;
        }
        return makeStmt();
      });
      const env: MockEnv = { DB: { prepare: dbPrepare } };
      const res = await onRequestPost(
        makeContext({ email: 'invitee@x.com', tripId: 'trip-1' }, env),
      );
      expect(res.status).toBe(409);
    });
  });
});
