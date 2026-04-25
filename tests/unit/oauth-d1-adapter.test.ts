/**
 * D1Adapter unit test — V2-P1 (per docs/v2-oauth-server-plan.md)
 *
 * Mock D1Database 接口，驗 SQL string + bind params + lazy expiration check。
 * 不跑真 SQLite，純 contract test：upsert/find/findByUid/consume/destroy/revokeByGrantId/sweepExpired。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { D1Adapter } from '../../src/server/oauth-d1-adapter';
import type { D1Database } from '@cloudflare/workers-types';

interface MockStmt {
  bind: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  all?: ReturnType<typeof vi.fn>;
}

function makeMockDb(firstResult: unknown = null, runMeta: { changes?: number } = {}): { db: D1Database; stmt: MockStmt; prepare: ReturnType<typeof vi.fn> } {
  const stmt: MockStmt = {
    bind: vi.fn(),
    first: vi.fn().mockResolvedValue(firstResult),
    run: vi.fn().mockResolvedValue({ meta: runMeta }),
  };
  stmt.bind.mockReturnValue(stmt); // chain
  const prepare = vi.fn().mockReturnValue(stmt);
  const db = { prepare } as unknown as D1Database;
  return { db, stmt, prepare };
}

describe('D1Adapter — Panva oidc-provider Adapter contract', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25T00:00:00Z'));
  });

  describe('upsert', () => {
    it('INSERT OR REPLACE with name + id + JSON payload + expires_at = now + ms', async () => {
      const { db, stmt, prepare } = makeMockDb();
      const adapter = new D1Adapter(db, 'Session');
      await adapter.upsert('jti-123', { uid: 'u1', exp: 999 }, 600);

      expect(prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE INTO oauth_models'));
      expect(stmt.bind).toHaveBeenCalledWith(
        'Session',
        'jti-123',
        JSON.stringify({ uid: 'u1', exp: 999 }),
        Date.now() + 600 * 1000,
      );
      expect(stmt.run).toHaveBeenCalled();
    });
  });

  describe('find', () => {
    it('returns parsed payload when found and not expired', async () => {
      const future = Date.now() + 1000;
      const { db } = makeMockDb({ payload: '{"uid":"u1"}', expires_at: future });
      const adapter = new D1Adapter(db, 'Session');
      const result = await adapter.find('jti-123');
      expect(result).toEqual({ uid: 'u1' });
    });

    it('returns undefined when row not found', async () => {
      const { db } = makeMockDb(null);
      const adapter = new D1Adapter(db, 'Session');
      expect(await adapter.find('missing')).toBeUndefined();
    });

    it('returns undefined when expired (lazy delete on read)', async () => {
      const past = Date.now() - 1000;
      const { db } = makeMockDb({ payload: '{"uid":"u1"}', expires_at: past });
      const adapter = new D1Adapter(db, 'Session');
      expect(await adapter.find('jti-expired')).toBeUndefined();
    });

    it('SQL filters by name + id', async () => {
      const { db, stmt, prepare } = makeMockDb({ payload: '{}', expires_at: Date.now() + 1000 });
      const adapter = new D1Adapter(db, 'AccessToken');
      await adapter.find('token-abc');
      expect(prepare).toHaveBeenCalledWith(expect.stringContaining('WHERE name = ? AND id = ?'));
      expect(stmt.bind).toHaveBeenCalledWith('AccessToken', 'token-abc');
    });
  });

  describe('findByUserCode', () => {
    it('throws not-implemented (V2-P5 device flow)', async () => {
      const { db } = makeMockDb();
      const adapter = new D1Adapter(db, 'DeviceCode');
      await expect(adapter.findByUserCode('user-code')).rejects.toThrow(/not implemented/);
    });
  });

  describe('findByUid', () => {
    it('uses json_extract(payload, $.uid) filter', async () => {
      const future = Date.now() + 1000;
      const { db, stmt, prepare } = makeMockDb({ payload: '{"uid":"sess-u1"}', expires_at: future });
      const adapter = new D1Adapter(db, 'Session');
      const result = await adapter.findByUid('sess-u1');

      expect(prepare).toHaveBeenCalledWith(expect.stringContaining('json_extract(payload, ?)'));
      expect(stmt.bind).toHaveBeenCalledWith('Session', '$.uid', 'sess-u1');
      expect(result).toEqual({ uid: 'sess-u1' });
    });

    it('returns undefined when expired', async () => {
      const past = Date.now() - 1000;
      const { db } = makeMockDb({ payload: '{"uid":"u1"}', expires_at: past });
      const adapter = new D1Adapter(db, 'Session');
      expect(await adapter.findByUid('u1')).toBeUndefined();
    });
  });

  describe('consume', () => {
    it('UPDATE payload set $.consumed = now() (authorization_code one-shot)', async () => {
      const { db, stmt, prepare } = makeMockDb();
      const adapter = new D1Adapter(db, 'AuthorizationCode');
      await adapter.consume('code-xyz');

      expect(prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE oauth_models'));
      expect(prepare).toHaveBeenCalledWith(expect.stringContaining('json_set(payload, ?'));
      expect(stmt.bind).toHaveBeenCalledWith('$.consumed', Date.now(), 'AuthorizationCode', 'code-xyz');
    });
  });

  describe('destroy', () => {
    it('DELETE by name + id', async () => {
      const { db, stmt, prepare } = makeMockDb();
      const adapter = new D1Adapter(db, 'RefreshToken');
      await adapter.destroy('rt-123');

      expect(prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM oauth_models WHERE name = ? AND id = ?'));
      expect(stmt.bind).toHaveBeenCalledWith('RefreshToken', 'rt-123');
      expect(stmt.run).toHaveBeenCalled();
    });
  });

  describe('revokeByGrantId', () => {
    it('DELETE across all names by json_extract($.grantId)', async () => {
      const { db, stmt, prepare } = makeMockDb();
      const adapter = new D1Adapter(db, 'AccessToken');
      await adapter.revokeByGrantId('grant-xyz');

      expect(prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM oauth_models WHERE json_extract(payload, ?)'));
      expect(stmt.bind).toHaveBeenCalledWith('$.grantId', 'grant-xyz');
    });
  });

  describe('sweepExpired (static maintenance)', () => {
    it('DELETE all expired rows + return count', async () => {
      const { db, stmt, prepare } = makeMockDb(null, { changes: 42 });
      const count = await D1Adapter.sweepExpired(db);

      expect(prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM oauth_models WHERE expires_at < ?'));
      expect(stmt.bind).toHaveBeenCalledWith(Date.now());
      expect(count).toBe(42);
    });

    it('returns 0 when meta.changes missing', async () => {
      const { db } = makeMockDb(null, {});
      const count = await D1Adapter.sweepExpired(db);
      expect(count).toBe(0);
    });
  });
});
