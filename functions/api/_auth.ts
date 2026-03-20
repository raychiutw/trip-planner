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
    .prepare('SELECT 1 FROM permissions WHERE email = ? AND (trip_id = ? OR trip_id = ?)')
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
    .prepare('SELECT 1 FROM entries e JOIN days d ON e.day_id = d.id WHERE e.id = ? AND d.trip_id = ?')
    .bind(entryId, tripId)
    .first();
  return !!row;
}

/**
 * Verifies that a restaurant belongs to the given trip via entry_id → entries.day_id → days.trip_id.
 */
export async function verifyRestaurantBelongsToTrip(
  db: D1Database,
  restaurantId: number,
  tripId: string,
): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM restaurants r JOIN entries e ON r.entry_id = e.id JOIN days d ON e.day_id = d.id WHERE r.id = ? AND d.trip_id = ?')
    .bind(restaurantId, tripId)
    .first();
  return !!row;
}

/**
 * Verifies that a shopping item belongs to the given trip.
 * Shopping can belong to either an entry or a hotel.
 */
export async function verifyShoppingBelongsToTrip(
  db: D1Database,
  shoppingId: number,
  tripId: string,
): Promise<boolean> {
  const row = await db
    .prepare(`
      SELECT 1 FROM shopping s
      LEFT JOIN entries e ON s.parent_type = 'entry' AND s.parent_id = e.id
      LEFT JOIN hotels h ON s.parent_type = 'hotel' AND s.parent_id = h.id
      LEFT JOIN days de ON e.day_id = de.id
      LEFT JOIN days dh ON h.day_id = dh.id
      WHERE s.id = ? AND (de.trip_id = ? OR dh.trip_id = ?)
    `)
    .bind(shoppingId, tripId, tripId)
    .first();
  return !!row;
}

/**
 * Verifies that a hotel belongs to the given trip via day_id → days.trip_id.
 */
export async function verifyHotelBelongsToTrip(
  db: D1Database,
  hotelId: number,
  tripId: string,
): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM hotels h JOIN days d ON h.day_id = d.id WHERE h.id = ? AND d.trip_id = ?')
    .bind(hotelId, tripId)
    .first();
  return !!row;
}
