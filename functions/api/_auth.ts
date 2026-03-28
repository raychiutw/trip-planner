/**
 * Shared authorization helper for API write handlers.
 */

/**
 * Returns true if the authenticated user has permission to write to the given trip.
 * Admins and service tokens always have permission. Regular users must have an entry
 * in the permissions table matching their email and the trip id (or a wildcard '*').
 */
export async function hasPermission(
  db: D1Database,
  email: string,
  tripId: string,
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin) return true;
  const row = await db
    .prepare('SELECT 1 FROM trip_permissions WHERE email = ? AND (trip_id = ? OR trip_id = ?)')
    .bind(email.toLowerCase(), tripId, '*')
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
