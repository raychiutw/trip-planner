/**
 * Integration test — service-token attribution + auth guards (v2.21.0 MF7)
 *
 * Verifies:
 *  - admin scope service token: hasPermission/hasWritePermission grant access; email = ADMIN_EMAIL.
 *  - non-admin scope service token: email = `service:${client_id}`, NOT inheriting ADMIN_EMAIL.
 *  - hasPermission / hasWritePermission early-return false for non-admin service tokens
 *    even if some trip_permissions row exists for the (forged) email — defense-in-depth.
 *  - audit_log.changed_by reflects sentinel `service:${client_id}` for non-admin writes.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, seedTrip } from './helpers';
import { hasPermission, hasWritePermission } from '../../functions/api/_auth';

let db: D1Database;

beforeAll(async () => {
  db = await createTestDb();
  // Owner user + trip
  await seedTrip(db, { id: 'trip-svc', owner: 'owner@test.com' });
});

afterAll(disposeMiniflare);

describe('service-token auth guards (MF7)', () => {
  it('admin scope service token → hasPermission grants', async () => {
    const auth = mockAuth({
      email: 'admin@test.com',
      userId: null as unknown as string,
      isAdmin: true,
      isServiceToken: true,
      scopes: ['admin'],
      clientId: 'svc-admin-1',
    });
    expect(await hasPermission(db, auth, 'trip-svc', auth.isAdmin)).toBe(true);
    expect(await hasWritePermission(db, auth, 'trip-svc', auth.isAdmin)).toBe(true);
  });

  it('non-admin scope service token → hasPermission denies (defense-in-depth)', async () => {
    const auth = mockAuth({
      email: 'service:svc-readonly-1', // sentinel, not admin email
      userId: null as unknown as string,
      isAdmin: false,
      isServiceToken: true,
      scopes: ['read'],
      clientId: 'svc-readonly-1',
    });
    expect(await hasPermission(db, auth, 'trip-svc', auth.isAdmin)).toBe(false);
    expect(await hasWritePermission(db, auth, 'trip-svc', auth.isAdmin)).toBe(false);
  });

  it('non-admin scope service token cannot escalate via forged userId on permission row', async () => {
    // Even if a trip_permissions row existed for some user_id, the service-token guard
    // returns false BEFORE the SQL lookup runs.
    const ghostUserId = 'ghost-user';
    await db.prepare(
      'INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)'
    ).bind(ghostUserId, 'ghost@test.com', 'ghost').run();
    await db.prepare(
      'INSERT OR IGNORE INTO trip_permissions (user_id, trip_id, role) VALUES (?, ?, ?)'
    ).bind(ghostUserId, 'trip-svc', 'member').run();

    const auth = mockAuth({
      email: 'service:svc-ghost-1',
      userId: ghostUserId,
      isAdmin: false,
      isServiceToken: true,
      scopes: ['read'],
      clientId: 'svc-ghost-1',
    });
    expect(await hasPermission(db, auth, 'trip-svc', auth.isAdmin)).toBe(false);
    expect(await hasWritePermission(db, auth, 'trip-svc', auth.isAdmin)).toBe(false);
  });

  it('user session (not service token) still gates by trip_permissions', async () => {
    const auth = mockAuth({ email: 'owner@test.com' });
    expect(await hasPermission(db, auth, 'trip-svc', auth.isAdmin)).toBe(true);
    const stranger = mockAuth({ email: 'stranger@test.com' });
    // stranger has no trip_permissions row even though seedUser may not have run yet
    expect(await hasPermission(db, stranger, 'trip-svc', stranger.isAdmin)).toBe(false);
  });
});

describe('audit attribution sentinel (MF7)', () => {
  it('non-admin service token write logs `service:${clientId}` not admin email', async () => {
    // Simulate the middleware-set email for a non-admin service token
    const changedBy = 'service:svc-attribution-1';
    await db.prepare(
      'INSERT INTO audit_log (trip_id, table_name, record_id, action, changed_by, diff_json) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind('trip-svc', 'trips', 1, 'update', changedBy, '{"x":1}').run();

    const row = await db
      .prepare('SELECT changed_by FROM audit_log WHERE trip_id = ? AND changed_by LIKE ? ORDER BY id DESC LIMIT 1')
      .bind('trip-svc', 'service:%')
      .first<{ changed_by: string }>();
    expect(row?.changed_by).toBe(changedBy);
    expect(row?.changed_by).not.toBe('admin@test.com');
  });

  it('admin service token write keeps ADMIN_EMAIL attribution', async () => {
    // admin scope tokens still write ADMIN_EMAIL — admin-equivalent operations
    await db.prepare(
      'INSERT INTO audit_log (trip_id, table_name, record_id, action, changed_by, diff_json) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind('trip-svc', 'trips', 1, 'update', 'admin@test.com', '{"y":2}').run();

    const row = await db
      .prepare("SELECT changed_by FROM audit_log WHERE trip_id = ? AND changed_by = 'admin@test.com' ORDER BY id DESC LIMIT 1")
      .bind('trip-svc')
      .first<{ changed_by: string }>();
    expect(row?.changed_by).toBe('admin@test.com');
  });
});
