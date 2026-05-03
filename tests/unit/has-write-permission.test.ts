/**
 * `hasWritePermission` — viewer must be excluded from write paths (v2.18.0).
 *
 * Migration 0043 documents viewer as "read-only collaborator". Backend gate has
 * to enforce that — frontend badge alone is not protection. This test pins down
 * the SQL filter so a future refactor can't silently drop the `role != 'viewer'`
 * clause.
 *
 * V2 cutover phase 2 (migration 0047): hasPermission/hasWritePermission 改用
 * 純 user_id-keyed query (email column dropped from trip_permissions).
 * 必須 pass AuthData object (含 userId)，string-only caller 因無 userId 直接 false。
 */
import { describe, it, expect, vi } from 'vitest';
import { hasPermission, hasWritePermission } from '../../functions/api/_auth';
import type { AuthData } from '../../src/types/api';

function makeDb(opts: { row: unknown; capturedSql?: { sql?: string } } = { row: null }) {
  const captured = opts.capturedSql ?? {};
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(opts.row),
  };
  const db = {
    prepare: vi.fn((sql: string) => {
      captured.sql = sql;
      return stmt;
    }),
  };
  return { db: db as unknown as D1Database, stmt, captured };
}

function authOf(email: string, userId: string | null = `uid-${email}`): AuthData {
  return { email, userId, isAdmin: false, isServiceToken: false };
}

describe('hasWritePermission — viewer is read-only', () => {
  it('admin always passes without DB query', async () => {
    const { db, stmt } = makeDb();
    const ok = await hasWritePermission(db, authOf('a@x.com'), 'trip-1', true);
    expect(ok).toBe(true);
    expect(stmt.first).not.toHaveBeenCalled();
  });

  it("SQL excludes viewer role (role != 'viewer')", async () => {
    const captured: { sql?: string } = {};
    const { db } = makeDb({ row: null, capturedSql: captured });
    await hasWritePermission(db, authOf('a@x.com'), 'trip-1', false);
    expect(captured.sql).toContain("role != 'viewer'");
  });

  it('returns false when DB returns null (viewer-only or no row)', async () => {
    const { db } = makeDb({ row: null });
    const ok = await hasWritePermission(db, authOf('viewer@x.com'), 'trip-1', false);
    expect(ok).toBe(false);
  });

  it('returns true when DB returns a row (member/admin/owner)', async () => {
    const { db } = makeDb({ row: { '1': 1 } });
    const ok = await hasWritePermission(db, authOf('member@x.com'), 'trip-1', false);
    expect(ok).toBe(true);
  });

  it('binds userId for V2 cutover query', async () => {
    const { db, stmt } = makeDb({ row: { '1': 1 } });
    await hasWritePermission(db, authOf('Mixed@Case.COM', 'uid-123'), 'trip-1', false);
    expect(stmt.bind).toHaveBeenCalledWith('uid-123', 'trip-1');
  });

  it('legacy string caller (userId=null) → false (V2 cutover blocks)', async () => {
    const { db } = makeDb({ row: { '1': 1 } });
    const ok = await hasWritePermission(db, 'legacy@x.com', 'trip-1', false);
    expect(ok).toBe(false);
  });
});

describe('hasPermission — viewer can read', () => {
  it("SQL does NOT exclude viewer (read path)", async () => {
    const captured: { sql?: string } = {};
    const { db } = makeDb({ row: null, capturedSql: captured });
    await hasPermission(db, authOf('viewer@x.com'), 'trip-1', false);
    expect(captured.sql).not.toContain("role != 'viewer'");
  });

  it('returns true for any role row (viewer included)', async () => {
    const { db } = makeDb({ row: { '1': 1 } });
    const ok = await hasPermission(db, authOf('viewer@x.com'), 'trip-1', false);
    expect(ok).toBe(true);
  });
});
