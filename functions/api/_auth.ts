/**
 * Shared authorization helper for API write handlers.
 */
import { AppError } from './_errors';
import { getAuth } from './_utils';
import type { AuthData } from './_types';

/**
 * Returns the authenticated AuthData or throws AUTH_REQUIRED.
 * Use in place of the repeated `const auth = getAuth(context); if (!auth) throw ...` pattern.
 */
export function requireAuth(context: { data: unknown }): AuthData {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');
  return auth;
}

/**
 * Admin-only gate. Returns AuthData or throws AUTH_REQUIRED / PERM_ADMIN_ONLY.
 */
export function requireAdmin(context: { data: unknown }): AuthData {
  const auth = requireAuth(context);
  if (!auth.isAdmin) throw new AppError('PERM_ADMIN_ONLY');
  return auth;
}

/**
 * Returns true if the authenticated user has any permission row on the given trip
 * (read access). Admins and service tokens always pass. viewer / member / owner /
 * admin roles all return true — viewer is read-allowed.
 *
 * V2 cutover phase 2 (migration 0047): email column dropped from trip_permissions.
 * 純 user_id-based query。pre-V2 sessions / service tokens 沒 user_id → 直接 false（不
 * 是 trip member）。
 *
 * For write/destructive operations, use `hasWritePermission` instead.
 */
export async function hasPermission(
  db: D1Database,
  auth: AuthData,
  tripId: string,
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin) return true;
  if (auth.isServiceToken) return false;
  if (!auth.userId) return false;
  const row = await db
    .prepare('SELECT 1 FROM trip_permissions WHERE user_id = ? AND trip_id = ?')
    .bind(auth.userId, tripId)
    .first();
  return !!row;
}

/**
 * v2.33.41 security audit: read-access gate for `/api/trips/:id/*` endpoints.
 * Accepts a request if:
 *   - the trip is `published=1` (public-share row), OR
 *   - the caller is authenticated AND has a `trip_permissions` row (any role).
 *
 * 之前 `_middleware.ts:415` 對所有 `GET /api/trips/**` 直接 bypass auth，多個
 * GET handler 沒做 published / permission 檢查，導致 anonymous 知 tripId 即可
 * 讀 doc 航班 / hotel POI / 緊急聯絡。tripId 是 user-chosen lowercase slug
 * (`/^[a-z0-9-]+$/`)，極易猜（`tokyo-2026` 等）。
 *
 * Throws `DATA_NOT_FOUND` 若 trip 不存在；throws `PERM_DENIED` 若需要 auth 卻無權。
 * 統一回 PERM_DENIED 而非 AUTH_REQUIRED 避免 enumerate published vs unpublished tripId。
 */
export async function requireTripReadAccess(
  db: D1Database,
  auth: AuthData | null,
  tripId: string,
): Promise<{ published: boolean; isMember: boolean }> {
  const trip = await db
    .prepare('SELECT published FROM trips WHERE id = ?')
    .bind(tripId)
    .first<{ published: number | null }>();
  if (!trip) throw new AppError('DATA_NOT_FOUND');
  const published = trip.published === 1;
  if (published) return { published: true, isMember: false };
  if (!auth) throw new AppError('PERM_DENIED');
  const isMember = await hasPermission(db, auth, tripId, auth.isAdmin);
  if (!isMember) throw new AppError('PERM_DENIED');
  return { published: false, isMember: true };
}

/**
 * Returns true if the authenticated user can write to the given trip.
 * viewer role is BLOCKED here per migration 0043 ("viewer = read-only collaborator").
 * Admins and service tokens always pass. owner / admin / member roles return true.
 *
 * V2 cutover phase 2: 純 user_id-based query (email column 已 dropped)。
 *
 * v2.18.0: introduced alongside the 3-tier role model so write paths gate viewer out
 * while read paths (`hasPermission`) keep viewer access.
 */
export async function hasWritePermission(
  db: D1Database,
  auth: AuthData,
  tripId: string,
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin) return true;
  if (auth.isServiceToken) return false;
  if (!auth.userId) return false;
  const row = await db
    .prepare("SELECT 1 FROM trip_permissions WHERE user_id = ? AND trip_id = ? AND role != 'viewer'")
    .bind(auth.userId, tripId)
    .first();
  return !!row;
}

/**
 * Verifies that an entry belongs to the given trip via day_id → days.trip_id.
 */
export async function verifyEntryBelongsToTrip(
  db: D1Database,
  entryId: number,
  tripId: string,
): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM trip_entries e JOIN trip_days d ON e.day_id = d.id WHERE e.id = ? AND d.trip_id = ?')
    .bind(entryId, tripId)
    .first();
  return !!row;
}

/**
 * Verifies that a POI is attached to a trip, either as a canonical entry POI
 * (`trip_entry_pois`) or as the day-level hotel (`trip_days.hotel_poi_id`).
 *
 * v2.29.0: trip_pois 整表 DROPPED. verifyTripPoiBelongsToTrip removed (no
 * trip_pois.id 可查); all callers go through this function instead.
 */
export async function verifyPoiBelongsToTrip(
  db: D1Database,
  poiId: number,
  tripId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1
       FROM trip_entry_pois tep
       JOIN trip_entries e ON e.id = tep.entry_id
       JOIN trip_days d ON d.id = e.day_id
       WHERE tep.poi_id = ? AND d.trip_id = ?
       UNION ALL
       SELECT 1
       FROM trip_days td
       WHERE td.hotel_poi_id = ? AND td.trip_id = ?
       LIMIT 1`,
    )
    .bind(poiId, tripId, poiId, tripId)
    .first();
  return !!row;
}
