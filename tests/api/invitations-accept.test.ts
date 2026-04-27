/**
 * POST /api/invitations/accept — V2 共編邀請接受流程
 *
 * 需 session（getSessionUser）+ user.email 必須 match invited_email（防 phishing：
 * 別人不能接走不屬於自己的邀請）+ atomic INSERT trip_permissions + UPDATE accepted_at。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost } from '../../functions/api/invitations/accept';
import { hashInvitationToken } from '../../src/server/invitation-token';

const TEST_SECRET = 'test-session-secret-32-chars-long';

interface MockEnv {
  DB?: {
    prepare: ReturnType<typeof vi.fn>;
    batch?: ReturnType<typeof vi.fn>;
  };
  SESSION_SECRET?: string;
}

function makeStmt(firstResult: unknown = null) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(firstResult),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  };
  return stmt;
}

function makeContext(
  body: unknown,
  env: MockEnv,
  sessionCookie?: string,
): Parameters<typeof onRequestPost>[0] {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (sessionCookie) headers['cookie'] = sessionCookie;
  return {
    request: new Request('https://x.com/api/invitations/accept', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
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
  vi.setSystemTime(new Date('2026-04-27T10:00:00Z'));
});

/**
 * Stub session: mock requireSessionUser by injecting a session cookie that the real
 * session module verifies. We stub crypto-light by mocking the verifySessionToken
 * import path indirectly — easier: since requireSessionUser reads cookie + calls
 * verifySessionToken, we mock at the DB layer (revocation check) and pass a
 * crafted cookie.
 *
 * Simpler: mock _session module at vi.mock level.
 */
vi.mock('../../functions/api/_session', () => ({
  requireSessionUser: vi.fn(),
  getSessionUser: vi.fn(),
}));

import { requireSessionUser } from '../../functions/api/_session';
import { AppError } from '../../functions/api/_errors';

describe('POST /api/invitations/accept', () => {
  it('401 AUTH_REQUIRED when no session', async () => {
    (requireSessionUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new AppError('AUTH_REQUIRED'),
    );
    const env: MockEnv = { DB: { prepare: vi.fn() }, SESSION_SECRET: TEST_SECRET };
    const res = await onRequestPost(makeContext({ token: 't' }, env));
    expect(res.status).toBe(401);
  });

  it('400 INVITATION_TOKEN_MISSING when token body missing', async () => {
    (requireSessionUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ uid: 'u-1' });
    const env: MockEnv = { DB: { prepare: vi.fn() }, SESSION_SECRET: TEST_SECRET };
    const res = await onRequestPost(makeContext({}, env));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('INVITATION_TOKEN_MISSING');
  });

  it('410 INVITATION_INVALID when token_hash not found', async () => {
    (requireSessionUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ uid: 'u-1' });
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT id, email FROM users')) {
        return makeStmt({ id: 'u-1', email: 'me@x.com' });
      }
      if (sql.includes('FROM trip_invitations')) return makeStmt(null);
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare }, SESSION_SECRET: TEST_SECRET };
    const res = await onRequestPost(makeContext({ token: 'fake' }, env));
    expect(res.status).toBe(410);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('INVITATION_INVALID');
  });

  it('410 INVITATION_EXPIRED when expires_at < now', async () => {
    (requireSessionUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ uid: 'u-1' });
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT id, email FROM users')) {
        return makeStmt({ id: 'u-1', email: 'me@x.com' });
      }
      if (sql.includes('FROM trip_invitations')) {
        return makeStmt({
          trip_id: 'trip-1',
          invited_email: 'me@x.com',
          expires_at: '2026-04-20T10:00:00Z', // expired
          accepted_at: null,
        });
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare }, SESSION_SECRET: TEST_SECRET };
    const res = await onRequestPost(makeContext({ token: 't' }, env));
    expect(res.status).toBe(410);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('INVITATION_EXPIRED');
  });

  it('410 INVITATION_ACCEPTED when already accepted', async () => {
    (requireSessionUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ uid: 'u-1' });
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT id, email FROM users')) {
        return makeStmt({ id: 'u-1', email: 'me@x.com' });
      }
      if (sql.includes('FROM trip_invitations')) {
        return makeStmt({
          trip_id: 'trip-1',
          invited_email: 'me@x.com',
          expires_at: '2026-05-04T10:00:00Z',
          accepted_at: '2026-04-26T10:00:00Z',
        });
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare }, SESSION_SECRET: TEST_SECRET };
    const res = await onRequestPost(makeContext({ token: 't' }, env));
    expect(res.status).toBe(410);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('INVITATION_ACCEPTED');
  });

  it('403 INVITATION_EMAIL_MISMATCH when session user.email != invited_email', async () => {
    (requireSessionUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ uid: 'u-1' });
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT id, email FROM users')) {
        return makeStmt({ id: 'u-1', email: 'wrongperson@x.com' });
      }
      if (sql.includes('FROM trip_invitations')) {
        return makeStmt({
          trip_id: 'trip-1',
          invited_email: 'real-invitee@x.com', // different
          expires_at: '2026-05-04T10:00:00Z',
          accepted_at: null,
        });
      }
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare }, SESSION_SECRET: TEST_SECRET };
    const res = await onRequestPost(makeContext({ token: 't' }, env));
    expect(res.status).toBe(403);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('INVITATION_EMAIL_MISMATCH');
  });

  it('200 happy path: INSERT trip_permissions + UPDATE accepted_at', async () => {
    (requireSessionUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ uid: 'u-1' });
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT id, email FROM users')) {
        return makeStmt({ id: 'u-1', email: 'me@x.com' });
      }
      if (sql.includes('FROM trip_invitations')) {
        return makeStmt({
          trip_id: 'trip-1',
          invited_email: 'me@x.com',
          expires_at: '2026-05-04T10:00:00Z',
          accepted_at: null,
        });
      }
      if (sql.includes('SELECT title FROM trips')) {
        return makeStmt({ title: '沖繩 5 日' });
      }
      return makeStmt();
    });
    const dbBatch = vi.fn().mockResolvedValue([
      { meta: { changes: 1 } },
      { meta: { changes: 1 } },
    ]);
    const env: MockEnv = {
      DB: { prepare: dbPrepare, batch: dbBatch },
      SESSION_SECRET: TEST_SECRET,
    };
    const res = await onRequestPost(makeContext({ token: 't' }, env));
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; tripId: string; tripTitle: string };
    expect(json.ok).toBe(true);
    expect(json.tripId).toBe('trip-1');
    expect(json.tripTitle).toBe('沖繩 5 日');

    // Atomic batch — INSERT permission + UPDATE invitation in same batch
    expect(dbBatch).toHaveBeenCalledTimes(1);
    const batchArg = dbBatch.mock.calls[0][0] as unknown[];
    expect(batchArg).toHaveLength(2);
  });

  it('queries DB with HMAC token_hash not raw token', async () => {
    (requireSessionUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ uid: 'u-1' });
    const inviteStmt = makeStmt(null);
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT id, email FROM users')) {
        return makeStmt({ id: 'u-1', email: 'me@x.com' });
      }
      if (sql.includes('FROM trip_invitations')) return inviteStmt;
      return makeStmt();
    });
    const env: MockEnv = { DB: { prepare: dbPrepare }, SESSION_SECRET: TEST_SECRET };

    const rawToken = 'my-raw-xyz';
    await onRequestPost(makeContext({ token: rawToken }, env));

    const expectedHash = await hashInvitationToken(rawToken, TEST_SECRET);
    expect(inviteStmt.bind).toHaveBeenCalledWith(expectedHash);
  });

  it('email match is case-insensitive (invited_email lowercase guaranteed by INSERT)', async () => {
    (requireSessionUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ uid: 'u-1' });
    const dbPrepare = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT id, email FROM users')) {
        return makeStmt({ id: 'u-1', email: 'Me@X.com' }); // mixed case
      }
      if (sql.includes('FROM trip_invitations')) {
        return makeStmt({
          trip_id: 'trip-1',
          invited_email: 'me@x.com', // lowercase
          expires_at: '2026-05-04T10:00:00Z',
          accepted_at: null,
        });
      }
      if (sql.includes('SELECT title FROM trips')) {
        return makeStmt({ title: 'Trip' });
      }
      return makeStmt();
    });
    const dbBatch = vi.fn().mockResolvedValue([{ meta: { changes: 1 } }, { meta: { changes: 1 } }]);
    const env: MockEnv = {
      DB: { prepare: dbPrepare, batch: dbBatch },
      SESSION_SECRET: TEST_SECRET,
    };
    const res = await onRequestPost(makeContext({ token: 't' }, env));
    expect(res.status).toBe(200);
  });
});
