/**
 * _auth 的 hasPermission／hasWritePermission／requireTripReadAccess：service token 不可憑偽造的 userId 越權。
 * 從 tests/api/middleware-service-token.integration 拆出：經 middleware 不可能產生「isServiceToken 且帶 userId」
 * 的 auth，只能直接餵 mock，所以是 module 測試，不屬於 HTTP 邊界套件。
 * 用共用的 Miniflare D1（專屬 id 前綴，結束清自己的資料）。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from '../api/setup';
import { mockServiceAuth, seedTrip } from '../api/helpers';
import { cleanupTrips } from '../api/cleanup-trips';
import { hasPermission, hasWritePermission, requireTripReadAccess } from '../../functions/api/_auth';

let db: D1Database;
const TRIP = 'auth-svc-ghost-trip';
const OWNER = 'auth-svc-ghost-owner@test.com';

beforeAll(async () => {
  db = await createTestDb();
  // 非公開行程，讓授權判斷只能靠 trip_permissions
  await seedTrip(db, { id: TRIP, owner: OWNER, published: 0 });
});

afterAll(async () => {
  await db.prepare("DELETE FROM trip_permissions WHERE user_id = 'ghost-user'").run();
  await db.prepare("DELETE FROM users WHERE id = 'ghost-user'").run();
  await cleanupTrips(db, [TRIP]);
  await disposeMiniflare();
});

describe('service-token guard — 偽造 userId（_auth 的 module 行為）', () => {
  it('non-admin scope service token cannot escalate via forged userId on permission row', async () => {
    // Even if a trip_permissions row existed for some user_id, the service-token guard
    // returns false BEFORE the SQL lookup runs.
    const ghostUserId = 'ghost-user';
    await db.prepare(
      'INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)'
    ).bind(ghostUserId, 'ghost@test.com', 'ghost').run();
    await db.prepare(
      'INSERT OR IGNORE INTO trip_permissions (user_id, trip_id, role) VALUES (?, ?, ?)'
    ).bind(ghostUserId, TRIP, 'member').run();

    const auth = mockServiceAuth({
      email: 'service:svc-ghost-1',
      userId: ghostUserId, // forged — guard must still deny before SQL lookup
      scopes: ['read'],
      clientId: 'svc-ghost-1',
    });
    expect(await hasPermission(db, auth, TRIP)).toBe(false);
    expect(await hasWritePermission(db, auth, TRIP)).toBe(false);

    // 補強（mutation 驗證發現缺口）：scope 齊全時，擋住偽造 userId 的只剩 isServiceToken 這道 guard
    const fullScope = mockServiceAuth({
      email: 'service:svc-ghost-2',
      userId: ghostUserId,
      scopes: ['trips:read', 'trips:write'],
      clientId: 'svc-ghost-2',
    });
    expect(await hasPermission(db, fullScope, TRIP)).toBe(false);
    expect(await hasWritePermission(db, fullScope, TRIP)).toBe(false);
    await expect(requireTripReadAccess(db, fullScope, TRIP)).rejects.toThrow();
  });
});
