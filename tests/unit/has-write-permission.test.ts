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
 * 必須 pass AuthData object (含 userId)；service token / null userId 直接 false。
 *
 * Phase 3（移除全域 admin）：isAdmin 參數移除，無 admin bypass。授權純 owner/member。
 */
import { describe, it, expect, vi } from 'vitest';
import { assertNotTripRestricted, hasPermission, hasWritePermission, requireTripReadAccess } from '../../functions/api/_auth';
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
  return { email, userId, isServiceToken: false };
}

describe('hasWritePermission — viewer is read-only', () => {
  it("SQL excludes viewer role (role != 'viewer')", async () => {
    const captured: { sql?: string } = {};
    const { db } = makeDb({ row: null, capturedSql: captured });
    await hasWritePermission(db, authOf('a@x.com'), 'trip-1');
    expect(captured.sql).toContain("role != 'viewer'");
  });

  it('returns false when DB returns null (viewer-only or no row)', async () => {
    const { db } = makeDb({ row: null });
    const ok = await hasWritePermission(db, authOf('viewer@x.com'), 'trip-1');
    expect(ok).toBe(false);
  });

  it('returns true when DB returns a row (member/owner)', async () => {
    const { db } = makeDb({ row: { '1': 1 } });
    const ok = await hasWritePermission(db, authOf('member@x.com'), 'trip-1');
    expect(ok).toBe(true);
  });

  it('binds userId for V2 cutover query', async () => {
    const { db, stmt } = makeDb({ row: { '1': 1 } });
    await hasWritePermission(db, authOf('Mixed@Case.COM', 'uid-123'), 'trip-1');
    expect(stmt.bind).toHaveBeenCalledWith('uid-123', 'trip-1');
  });

  it('AuthData with null userId → false (V2 cutover blocks pre-V2 sessions)', async () => {
    const { db } = makeDb({ row: { '1': 1 } });
    const ok = await hasWritePermission(
      db,
      { email: 'legacy@x.com', userId: null, isServiceToken: false },
      'trip-1',
    );
    expect(ok).toBe(false);
  });

  it('service token → false without DB query (Phase 3：維運靠 ops scope，不靠 trip membership)', async () => {
    const { db, stmt } = makeDb({ row: { '1': 1 } });
    const ok = await hasWritePermission(
      db,
      { email: 'service:cli', userId: null, isServiceToken: true },
      'trip-1',
    );
    expect(ok).toBe(false);
    expect(stmt.first).not.toHaveBeenCalled();
  });
});

describe('restrictTrip — trip-scoped token (v2.55.56 confused-deputy)', () => {
  it('hasWritePermission: restrictTrip 相符 → 正常查 DB 放行', async () => {
    const { db, stmt } = makeDb({ row: { '1': 1 } });
    const auth: AuthData = { ...authOf('agent@x.com', 'uid-1'), restrictTrip: 'trip-1' };
    const ok = await hasWritePermission(db, auth, 'trip-1');
    expect(ok).toBe(true);
    expect(stmt.first).toHaveBeenCalled();
  });

  it('hasWritePermission: restrictTrip 不符 → false，且短路不查 DB', async () => {
    const { db, stmt } = makeDb({ row: { '1': 1 } });
    const auth: AuthData = { ...authOf('agent@x.com', 'uid-1'), restrictTrip: 'trip-1' };
    const ok = await hasWritePermission(db, auth, 'trip-OTHER');
    expect(ok).toBe(false);
    expect(stmt.first).not.toHaveBeenCalled();
  });

  it('requireTripReadAccess: restrictTrip 不符 → PERM_DENIED（連 published trip 也擋）', async () => {
    // 受限 token 即使對 published trip 也不能讀 — restrictTrip 檢查在 published 短路之前
    const { db } = makeDb({ row: { published: 1, perm_user_id: null } });
    const auth: AuthData = { ...authOf('agent@x.com', 'uid-1'), restrictTrip: 'trip-1' };
    await expect(requireTripReadAccess(db, auth, 'trip-OTHER')).rejects.toMatchObject({ code: 'PERM_DENIED' });
  });

  it('requireTripReadAccess: restrictTrip 相符 → 正常放行', async () => {
    const { db } = makeDb({ row: { published: 0, perm_user_id: 'uid-1' } });
    const auth: AuthData = { ...authOf('agent@x.com', 'uid-1'), restrictTrip: 'trip-1' };
    const result = await requireTripReadAccess(db, auth, 'trip-1');
    expect(result).toMatchObject({ isMember: true });
  });

  it('undefined restrictTrip（一般 token）→ 不受限，正常查', async () => {
    const { db, stmt } = makeDb({ row: { '1': 1 } });
    const ok = await hasWritePermission(db, authOf('owner@x.com', 'uid-1'), 'trip-any');
    expect(ok).toBe(true);
    expect(stmt.first).toHaveBeenCalled();
  });
});

describe('assertNotTripRestricted — owner-level ops 拒受限 token (v2.55.56)', () => {
  it('restrictTrip 有值 → 一律 throw PERM_DENIED（連自己那個 trip 也不放行）', () => {
    const auth: AuthData = { ...authOf('agent@x.com', 'uid-1'), restrictTrip: 'trip-1' };
    // 就算目標就是 restrict 的那個 trip，owner 層級操作仍拒（防持久性提權）
    expect(() => assertNotTripRestricted(auth)).toThrow();
    try {
      assertNotTripRestricted(auth);
    } catch (e) {
      expect((e as { code?: string }).code).toBe('PERM_DENIED');
    }
  });

  it('undefined restrictTrip（一般 token）→ no-op 不 throw', () => {
    expect(() => assertNotTripRestricted(authOf('owner@x.com', 'uid-1'))).not.toThrow();
  });

  it('service token（無 restrictTrip）→ no-op（維運 / companion 不受影響）', () => {
    const svc: AuthData = { email: 'service:cli', userId: null, isServiceToken: true };
    expect(() => assertNotTripRestricted(svc)).not.toThrow();
  });
});

describe('hasPermission — viewer can read', () => {
  it("SQL does NOT exclude viewer (read path)", async () => {
    const captured: { sql?: string } = {};
    const { db } = makeDb({ row: null, capturedSql: captured });
    await hasPermission(db, authOf('viewer@x.com'), 'trip-1');
    expect(captured.sql).not.toContain("role != 'viewer'");
  });

  it('returns true for any role row (viewer included)', async () => {
    const { db } = makeDb({ row: { '1': 1 } });
    const ok = await hasPermission(db, authOf('viewer@x.com'), 'trip-1');
    expect(ok).toBe(true);
  });
});
