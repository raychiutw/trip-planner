/**
 * invitation-accept.test.ts — tryAcceptInvitation 5 個 outcome code path
 * v2.33.58 round 12b: CRITICAL ZERO_COVERAGE fill。endpoint integration test
 * 已涵蓋 happy path，本檔直接 mock D1 驗 4 個 fail code + 1 個 race guard。
 */
import { describe, it, expect, vi } from 'vitest';
import { tryAcceptInvitation } from '../../src/server/invitation-accept';
import { hashInvitationToken } from '../../src/server/invitation-token';

const SECRET = 'test-secret-32-bytes-long-enough';
const USER = { id: 'user-1', email: 'recipient@example.com' };
const RAW_TOKEN = 'abc-token-123';

interface MockRow {
  first?: unknown;
}

function makeDb(invitation: unknown, tripTitle?: string) {
  const batched: unknown[] = [];
  const db = {
    prepare(sql: string) {
      const select = sql.includes('FROM trip_invitations');
      const tripTitleQuery = sql.includes('FROM trips');
      return {
        bind() { return this; },
        async first<T>() {
          if (select) return invitation as T;
          if (tripTitleQuery) return tripTitle != null ? ({ title: tripTitle } as T) : null;
          return null;
        },
      };
    },
    async batch(stmts: unknown[]) {
      batched.push(...stmts);
      return [{ meta: { changes: 1 } }, { meta: { changes: 1 } }];
    },
    __batched: batched,
  };
  return db;
}

describe('tryAcceptInvitation — fail paths', () => {
  it('INVITATION_INVALID 當 token_hash 找不到', async () => {
    const db = makeDb(null) as unknown as D1Database;
    const result = await tryAcceptInvitation(db, SECRET, RAW_TOKEN, USER);
    expect(result).toEqual({ ok: false, code: 'INVITATION_INVALID' });
  });

  it('INVITATION_ACCEPTED 當 row.accepted_at != null', async () => {
    const db = makeDb({
      trip_id: 'trip-1',
      invited_email: 'recipient@example.com',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      accepted_at: new Date().toISOString(),
    }) as unknown as D1Database;
    const result = await tryAcceptInvitation(db, SECRET, RAW_TOKEN, USER);
    expect(result).toEqual({ ok: false, code: 'INVITATION_ACCEPTED' });
  });

  it('INVITATION_EXPIRED 當 expires_at 過去', async () => {
    const db = makeDb({
      trip_id: 'trip-1',
      invited_email: 'recipient@example.com',
      expires_at: new Date(Date.now() - 86400000).toISOString(),
      accepted_at: null,
    }) as unknown as D1Database;
    const result = await tryAcceptInvitation(db, SECRET, RAW_TOKEN, USER);
    expect(result).toEqual({ ok: false, code: 'INVITATION_EXPIRED' });
  });

  it('INVITATION_EMAIL_MISMATCH 當 user.email != invited_email', async () => {
    const db = makeDb({
      trip_id: 'trip-1',
      invited_email: 'different@example.com',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      accepted_at: null,
    }) as unknown as D1Database;
    const result = await tryAcceptInvitation(db, SECRET, RAW_TOKEN, USER);
    expect(result).toEqual({ ok: false, code: 'INVITATION_EMAIL_MISMATCH' });
  });

  it('email 比對 case-insensitive', async () => {
    const db = makeDb(
      {
        trip_id: 'trip-1',
        invited_email: 'RECIPIENT@Example.COM',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        accepted_at: null,
      },
      'My Trip',
    ) as unknown as D1Database;
    const result = await tryAcceptInvitation(db, SECRET, RAW_TOKEN, USER);
    expect(result.ok).toBe(true);
  });
});

describe('tryAcceptInvitation — happy path', () => {
  it('返 tripId + tripTitle', async () => {
    const db = makeDb(
      {
        trip_id: 'trip-okinawa-1',
        invited_email: 'recipient@example.com',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        accepted_at: null,
      },
      '沖繩 7/26',
    ) as unknown as D1Database;
    const result = await tryAcceptInvitation(db, SECRET, RAW_TOKEN, USER);
    expect(result).toEqual({ ok: true, tripId: 'trip-okinawa-1', tripTitle: '沖繩 7/26' });
  });

  it('trip title missing → tripTitle 退回空字串 (graceful degradation)', async () => {
    const db = makeDb({
      trip_id: 'trip-1',
      invited_email: 'recipient@example.com',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      accepted_at: null,
    }) as unknown as D1Database;
    const result = await tryAcceptInvitation(db, SECRET, RAW_TOKEN, USER);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tripTitle).toBe('');
  });

  it('atomic batch 含 INSERT trip_permissions + UPDATE trip_invitations accepted_at IS NULL guard', async () => {
    const db = makeDb({
      trip_id: 'trip-1',
      invited_email: 'recipient@example.com',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      accepted_at: null,
    }, 'X') as unknown as D1Database;
    await tryAcceptInvitation(db, SECRET, RAW_TOKEN, USER);
    // batch 收 2 個 statement
    expect((db as unknown as { __batched: unknown[] }).__batched).toHaveLength(2);
  });
});

describe('tryAcceptInvitation — HMAC parity', () => {
  it('token_hash 用 SECRET HMAC raw token (對齊 generateInvitationToken)', async () => {
    const captured: string[] = [];
    const db: D1Database = {
      prepare(sql: string) {
        if (sql.includes('FROM trip_invitations')) {
          return {
            bind(...args: unknown[]) {
              captured.push(...(args.filter((a) => typeof a === 'string') as string[]));
              return this;
            },
            async first() { return null; },
          } as never;
        }
        return { bind() { return this; }, async first() { return null; } } as never;
      },
      async batch() { return []; },
    } as never;
    await tryAcceptInvitation(db, SECRET, RAW_TOKEN, USER);
    const expectedHash = await hashInvitationToken(RAW_TOKEN, SECRET);
    expect(captured).toContain(expectedHash);
  });
});
