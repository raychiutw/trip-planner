/**
 * POST /api/invitations/accept — V2 共編邀請接受流程
 *
 * 需 session（getSessionUser）+ user.email 必須 match invited_email（防 phishing：
 * 別人不能接走不屬於自己的邀請）+ atomic INSERT trip_permissions + UPDATE accepted_at。
 */
/**
 * v2.33.83 Round 32: 改 scoped doMock + dynamic import 避免 module-level
 * `vi.mock` 在 `isolate: false` 下 spillover 至 session-helper.test.ts、
 * dev-apps*.test.ts、account-*.test.ts（這些檔 import 真實 _session 邏輯）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hashInvitationToken } from '../../src/server/invitation-token';
import type { onRequestPost as OnRequestPost } from '../../functions/api/invitations/accept';

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

// Module-level mock refs — fresh fn per test via beforeEach reassign。
// 不在 top level `vi.mock(...)`，改 beforeEach + `vi.doMock` 才能在
// `isolate: false` 下避免污染其他 tests/api/* import 真實 _session 邏輯。
let mockRequireSessionUser: ReturnType<typeof vi.fn>;
let mockGetSessionUser: ReturnType<typeof vi.fn>;
let onRequestPost: typeof OnRequestPost;

let AppError: typeof import('../../functions/api/_errors').AppError;

beforeEach(async () => {
  vi.resetModules();
  mockRequireSessionUser = vi.fn();
  mockGetSessionUser = vi.fn();
  // AppError 需 dynamic import — 因為 SUT 在 resetModules() 後重新 import
  // _errors，其 instanceof check 用的是「重新 import 的 AppError class」，
  // test 端必須用同 identity 才會被 SUT catch block 認出。
  AppError = (await import('../../functions/api/_errors')).AppError;
  // 部分 mock — 保留 _session 其他 exports（issueSession 等）為 real 實作，
  // 因 isolate: false 下其他 file 仍會用到。
  vi.doMock('../../functions/api/_session', async () => {
    const actual = await vi.importActual<typeof import('../../functions/api/_session')>(
      '../../functions/api/_session',
    );
    return {
      ...actual,
      requireSessionUser: mockRequireSessionUser,
      getSessionUser: mockGetSessionUser,
    };
  });
  // dynamic import AFTER doMock — SUT 取到 mocked _session
  onRequestPost = (await import('../../functions/api/invitations/accept')).onRequestPost;
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-27T10:00:00Z'));
});

afterEach(() => {
  vi.doUnmock('../../functions/api/_session');
  vi.useRealTimers();
});


describe('POST /api/invitations/accept', () => {
  it('401 AUTH_REQUIRED when no session', async () => {
    mockRequireSessionUser.mockRejectedValueOnce(
      new AppError('AUTH_REQUIRED'),
    );
    const env: MockEnv = { DB: { prepare: vi.fn() }, SESSION_SECRET: TEST_SECRET };
    const res = await onRequestPost(makeContext({ token: 't' }, env));
    expect(res.status).toBe(401);
  });

  it('400 INVITATION_TOKEN_MISSING when token body missing', async () => {
    mockRequireSessionUser.mockResolvedValueOnce({ uid: 'u-1' });
    const env: MockEnv = { DB: { prepare: vi.fn() }, SESSION_SECRET: TEST_SECRET };
    const res = await onRequestPost(makeContext({}, env));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('INVITATION_TOKEN_MISSING');
  });

  it('410 INVITATION_INVALID when token_hash not found', async () => {
    mockRequireSessionUser.mockResolvedValueOnce({ uid: 'u-1' });
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
    mockRequireSessionUser.mockResolvedValueOnce({ uid: 'u-1' });
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
    mockRequireSessionUser.mockResolvedValueOnce({ uid: 'u-1' });
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
    mockRequireSessionUser.mockResolvedValueOnce({ uid: 'u-1' });
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
    mockRequireSessionUser.mockResolvedValueOnce({ uid: 'u-1' });
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
    mockRequireSessionUser.mockResolvedValueOnce({ uid: 'u-1' });
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
    mockRequireSessionUser.mockResolvedValueOnce({ uid: 'u-1' });
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
