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
 * Returns true if the authenticated user has any permission row on the given trip
 * (read access). Admins and service tokens always pass. viewer / member / owner /
 * admin roles all return true — viewer is read-allowed.
 *
 * V2 cutover dual-read (E-H2): prefer user_id match, fall back to email for rows
 * not yet backfilled. After phase 2 DROP COLUMN email, the email branch becomes
 * unreachable (column gone) — code change is then a one-liner cleanup.
 *
 * For write/destructive operations, use `hasWritePermission` instead.
 */
export async function hasPermission(
  db: D1Database,
  emailOrAuth: string | AuthData,
  tripId: string,
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin) return true;
  const { email, userId } = normalizeAuth(emailOrAuth);
  // Dual-read: match by user_id OR email — either column hits is enough during transition.
  // SQLite NULL semantics: `user_id = NULL` always FALSE, so null userId silently falls
  // through to email match. After phase 2 drops email column, swap to user_id only.
  const row = await db
    .prepare(
      `SELECT 1 FROM trip_permissions
       WHERE (email = ? OR user_id = ?)
         AND (trip_id = ? OR trip_id = ?)`,
    )
    .bind(email.toLowerCase(), userId, tripId, '*')
    .first();
  return !!row;
}

/**
 * Returns true if the authenticated user can write to the given trip.
 * viewer role is BLOCKED here per migration 0043 ("viewer = read-only collaborator").
 * Admins and service tokens always pass. owner / admin / member roles return true.
 *
 * V2 cutover dual-read (E-H2): same dual-read pattern as hasPermission.
 *
 * v2.18.0: introduced alongside the 3-tier role model so write paths gate viewer out
 * while read paths (`hasPermission`) keep viewer access.
 */
export async function hasWritePermission(
  db: D1Database,
  emailOrAuth: string | AuthData,
  tripId: string,
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin) return true;
  const { email, userId } = normalizeAuth(emailOrAuth);
  const row = await db
    .prepare(
      `SELECT 1 FROM trip_permissions
       WHERE (email = ? OR user_id = ?)
         AND (trip_id = ? OR trip_id = ?)
         AND role != 'viewer'`,
    )
    .bind(email.toLowerCase(), userId, tripId, '*')
    .first();
  return !!row;
}

/**
 * Backwards-compat shim: callers pass either a string email (legacy) or AuthData.
 * Returns { email, userId } extracting both forms. userId may be null for legacy
 * email-string callers — dual-read query handles that via NULL match.
 */
function normalizeAuth(emailOrAuth: string | AuthData): { email: string; userId: string | null } {
  if (typeof emailOrAuth === 'string') {
    return { email: emailOrAuth, userId: null };
  }
  return { email: emailOrAuth.email, userId: emailOrAuth.userId };
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
