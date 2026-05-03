/**
 * `hasWritePermission` — viewer must be excluded from write paths (v2.18.0).
 *
 * Migration 0043 documents viewer as "read-only collaborator". Backend gate has
 * to enforce that — frontend badge alone is not protection. This test pins down
 * the SQL filter so a future refactor can't silently drop the `role != 'viewer'`
 * clause.
 */
import { describe, it, expect, vi } from 'vitest';
import { hasPermission, hasWritePermission } from '../../functions/api/_auth';

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

describe('hasWritePermission — viewer is read-only', () => {
  it('admin always passes without DB query', async () => {
    const { db, stmt } = makeDb();
    const ok = await hasWritePermission(db, 'a@x.com', 'trip-1', true);
    expect(ok).toBe(true);
    expect(stmt.first).not.toHaveBeenCalled();
  });

  it("SQL excludes viewer role (role != 'viewer')", async () => {
    const captured: { sql?: string } = {};
    const { db } = makeDb({ row: null, capturedSql: captured });
    await hasWritePermission(db, 'a@x.com', 'trip-1', false);
    expect(captured.sql).toContain("role != 'viewer'");
  });

  it('returns false when DB returns null (viewer-only or no row)', async () => {
    const { db } = makeDb({ row: null });
    const ok = await hasWritePermission(db, 'viewer@x.com', 'trip-1', false);
    expect(ok).toBe(false);
  });

  it('returns true when DB returns a row (member/admin/owner)', async () => {
    const { db } = makeDb({ row: { '1': 1 } });
    const ok = await hasWritePermission(db, 'member@x.com', 'trip-1', false);
    expect(ok).toBe(true);
  });

  it('email is lowercased before bind', async () => {
    const { db, stmt } = makeDb({ row: { '1': 1 } });
    await hasWritePermission(db, 'Mixed@Case.COM', 'trip-1', false);
    // V2 cutover dual-read: bind order = (email, userId, tripId, '*')。
    // 字串 caller 沒帶 userId → null，SQL 自動 fall back to email match。
    expect(stmt.bind).toHaveBeenCalledWith('mixed@case.com', null, 'trip-1', '*');
  });
});

describe('hasPermission — viewer can read', () => {
  it("SQL does NOT exclude viewer (read path)", async () => {
    const captured: { sql?: string } = {};
    const { db } = makeDb({ row: null, capturedSql: captured });
    await hasPermission(db, 'viewer@x.com', 'trip-1', false);
    expect(captured.sql).not.toContain("role != 'viewer'");
  });

  it('returns true for any role row (viewer included)', async () => {
    const { db } = makeDb({ row: { '1': 1 } });
    const ok = await hasPermission(db, 'viewer@x.com', 'trip-1', false);
    expect(ok).toBe(true);
  });
});
