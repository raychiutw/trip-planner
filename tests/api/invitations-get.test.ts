/**
 * GET /api/invitations?token=xxx — V2 共編邀請查詢
 *
 * Lookup invitation by HMAC(SESSION_SECRET, raw_token) → trip_invitations row。
 * 三種失敗 case 共用 410 GONE：
 *   - INVITATION_INVALID  : token_hash 找不到 row
 *   - INVITATION_EXPIRED  : expires_at < now
 *   - INVITATION_ACCEPTED : accepted_at IS NOT NULL（避免重複觸發）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet } from '../../functions/api/invitations';
import { hashInvitationToken } from '../../src/server/invitation-token';

interface MockEnv {
  DB?: { prepare: ReturnType<typeof vi.fn> };
  SESSION_SECRET?: string;
}

const TEST_SECRET = 'test-session-secret-32-chars-long';

function makeStmt(firstResult: unknown = null) {
  return {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(firstResult),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  };
}

function makeContext(query: string, env: MockEnv): Parameters<typeof onRequestGet>[0] {
  return {
    request: new Request(`https://x.com/api/invitations?${query}`, { method: 'GET' }),
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
  vi.setSystemTime(new Date('2026-04-27T10:00:00Z'));
});

describe('GET /api/invitations', () => {
  it('400 when token query param missing', async () => {
    const env: MockEnv = { DB: { prepare: vi.fn() }, SESSION_SECRET: TEST_SECRET };
    const res = await onRequestGet(makeContext('', env));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('INVITATION_TOKEN_MISSING');
  });

  it('500 when SESSION_SECRET not set (server misconfig)', async () => {
    const env: MockEnv = { DB: { prepare: vi.fn() } };
    const res = await onRequestGet(makeContext('token=anything', env));
    expect(res.status).toBe(500);
  });

  it('410 INVITATION_INVALID when token_hash not found', async () => {
    const stmt = makeStmt(null);
    const env: MockEnv = { DB: { prepare: vi.fn().mockReturnValue(stmt) }, SESSION_SECRET: TEST_SECRET };
    const res = await onRequestGet(makeContext('token=fake-token', env));
    expect(res.status).toBe(410);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('INVITATION_INVALID');
  });

  it('410 INVITATION_EXPIRED when expires_at in past', async () => {
    const dbPrepare = vi.fn().mockReturnValue(makeStmt({
      trip_id: 'trip-1',
      trip_title: '沖繩',
      invited_email: 'invitee@x.com',
      inviter_display_name: 'Ray',
      inviter_email: 'ray@x.com',
      expires_at: '2026-04-20T10:00:00Z', // 7 days ago
      accepted_at: null,
    }));
    const env: MockEnv = { DB: { prepare: dbPrepare }, SESSION_SECRET: TEST_SECRET };
    const res = await onRequestGet(makeContext('token=expired-token', env));
    expect(res.status).toBe(410);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('INVITATION_EXPIRED');
  });

  it('410 INVITATION_ACCEPTED when accepted_at is set', async () => {
    const dbPrepare = vi.fn().mockReturnValue(makeStmt({
      trip_id: 'trip-1',
      trip_title: '沖繩',
      invited_email: 'invitee@x.com',
      inviter_display_name: 'Ray',
      inviter_email: 'ray@x.com',
      expires_at: '2026-05-04T10:00:00Z',
      accepted_at: '2026-04-26T10:00:00Z',
    }));
    const env: MockEnv = { DB: { prepare: dbPrepare }, SESSION_SECRET: TEST_SECRET };
    const res = await onRequestGet(makeContext('token=accepted-token', env));
    expect(res.status).toBe(410);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe('INVITATION_ACCEPTED');
  });

  it('200 happy path: returns trip preview + inviter info', async () => {
    const dbPrepare = vi.fn().mockReturnValue(makeStmt({
      trip_id: 'trip-1',
      trip_title: '沖繩 5 日',
      invited_email: 'invitee@x.com',
      inviter_display_name: 'Ray',
      inviter_email: 'ray@x.com',
      expires_at: '2026-05-04T10:00:00Z',
      accepted_at: null,
    }));
    const env: MockEnv = { DB: { prepare: dbPrepare }, SESSION_SECRET: TEST_SECRET };
    const res = await onRequestGet(makeContext('token=valid-token', env));
    expect(res.status).toBe(200);
    const json = await res.json() as {
      tripId: string;
      tripTitle: string;
      invitedEmail: string;
      inviterDisplayName: string;
      inviterEmail: string;
      expiresAt: string;
    };
    expect(json.tripId).toBe('trip-1');
    expect(json.tripTitle).toBe('沖繩 5 日');
    expect(json.invitedEmail).toBe('invitee@x.com');
    expect(json.inviterDisplayName).toBe('Ray');
    expect(json.inviterEmail).toBe('ray@x.com');
    expect(json.expiresAt).toBe('2026-05-04T10:00:00Z');
  });

  it('queries DB with HMAC(SESSION_SECRET, raw_token) not raw token', async () => {
    const stmt = makeStmt(null);
    const dbPrepare = vi.fn().mockReturnValue(stmt);
    const env: MockEnv = { DB: { prepare: dbPrepare }, SESSION_SECRET: TEST_SECRET };

    const rawToken = 'my-raw-token-xyz';
    await onRequestGet(makeContext(`token=${rawToken}`, env));

    const expectedHash = await hashInvitationToken(rawToken, TEST_SECRET);
    expect(stmt.bind).toHaveBeenCalledWith(expectedHash);
    // raw token must NOT be passed
    expect(stmt.bind).not.toHaveBeenCalledWith(rawToken);
  });

  it('SQL JOINs trips for trip_title + users for inviter info', async () => {
    const dbPrepare = vi.fn().mockReturnValue(makeStmt(null));
    const env: MockEnv = { DB: { prepare: dbPrepare }, SESSION_SECRET: TEST_SECRET };
    await onRequestGet(makeContext('token=t', env));

    const sql = dbPrepare.mock.calls[0][0] as string;
    expect(sql).toMatch(/FROM trip_invitations/i);
    expect(sql).toMatch(/JOIN trips/i);
    expect(sql).toMatch(/JOIN users/i);
  });
});
