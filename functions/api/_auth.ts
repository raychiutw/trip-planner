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
 * Verifies that a trip_poi belongs to the given trip.
 * Replaces verifyRestaurantBelongsToTrip, verifyShoppingBelongsToTrip, verifyHotelBelongsToTrip.
 */
export async function verifyTripPoiBelongsToTrip(
  db: D1Database,
  tripPoiId: number,
  tripId: string,
): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM trip_pois WHERE id = ? AND trip_id = ?')
    .bind(tripPoiId, tripId)
    .first();
  return !!row;
}
