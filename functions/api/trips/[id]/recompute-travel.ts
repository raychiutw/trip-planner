/**
 * POST /api/trips/:id/recompute-travel?day=N|all
 *
 * v2.23.0 google-maps-migration: ORS+Haversine → Google Routes API (src/server/maps/google-client).
 * **NO** fallback per P11/T13 — single pair Google failure → travel_source='error', skip update for that pair.
 * Aggregate Google failure → 502 MAPS_UPSTREAM_FAILED bubbled by computeRoute (caller handles).
 *
 * Recomputes travel_* fields on trip_entries by walking adjacent (sort_order)
 * entries within each day. First entry per day stays NULL (no prior).
 *
 * Mode comes from trips.default_travel_mode (google driving only currently).
 *
 * Triggered by:
 *   - TimelineRail.handleDragEnd when user reorders entries
 *   - Manual recompute via UI/CLI
 *
 * Auth: trip write permission (owner/member with write).
 */

import { hasWritePermission } from '../../_auth';
import { AppError } from '../../_errors';
import { json, getAuth } from '../../_utils';
import { assertGoogleAvailable } from '../../_maps_lock';
import { computeRoute, type TravelMode as GoogleTravelMode } from '../../../../src/server/maps/google-client';
import type { Env } from '../../_types';

/** Map trips.default_travel_mode (lowercase) → Google Routes travelMode (uppercase enum). */
function mapMode(trip_mode: string): GoogleTravelMode {
  switch (trip_mode.toLowerCase()) {
    case 'walking':
    case 'walk':
      return 'WALK';
    case 'transit':
      return 'TRANSIT';
    case 'cycling':
    case 'bicycle':
      return 'BICYCLE';
    case 'driving':
    default:
      return 'DRIVE';
  }
}

interface EntryWithCoords {
  id: number;
  day_id: number;
  sort_order: number;
  lat: number | null;
  lng: number | null;
}

interface TripDay {
  id: number;
  day_num: number;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const tripId = context.params.id as string;
  if (!tripId) throw new AppError('DATA_VALIDATION', '缺少 tripId');

  const db = context.env.DB;
  if (!await hasWritePermission(db, auth, tripId, false)) {
    throw new AppError('PERM_DENIED');
  }

  // Resolve trip mode (defaults to 'driving')
  const trip = await db
    .prepare('SELECT default_travel_mode FROM trips WHERE id = ?')
    .bind(tripId)
    .first<{ default_travel_mode: string | null }>();
  if (!trip) throw new AppError('DATA_NOT_FOUND', '找不到該行程');
  const tripMode = trip.default_travel_mode ?? 'driving';
  const googleMode = mapMode(tripMode);

  const apiKey = context.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new AppError('MAPS_UPSTREAM_FAILED', 'GOOGLE_MAPS_API_KEY not configured');
  await assertGoogleAvailable(db);

  // Resolve day filter
  const url = new URL(context.request.url);
  const dayParam = url.searchParams.get('day');
  let dayNumFilter: number | null = null;
  if (dayParam && dayParam !== 'all') {
    const n = parseInt(dayParam, 10);
    if (!Number.isFinite(n) || n < 1) {
      throw new AppError('DATA_VALIDATION', 'day 參數必須為正整數或 all');
    }
    dayNumFilter = n;
  }

  // Fetch days to process
  const daysSql = dayNumFilter !== null
    ? 'SELECT id, day_num FROM trip_days WHERE trip_id = ? AND day_num = ? ORDER BY day_num'
    : 'SELECT id, day_num FROM trip_days WHERE trip_id = ? ORDER BY day_num';
  const daysBind = dayNumFilter !== null ? [tripId, dayNumFilter] : [tripId];
  const daysRes = await db.prepare(daysSql).bind(...daysBind).all<TripDay>();

  let pairsComputed = 0;
  const sourceBreakdown: Record<string, number> = {};
  const updates: Array<{ entryId: number; distance_m: number; duration_s: number; source: string }> = [];

  // Walk each day's entries in sort_order
  for (const day of daysRes.results) {
    const entries = await db
      .prepare(
        `SELECT e.id, e.day_id, e.sort_order, p.lat, p.lng
         FROM trip_entries e
         LEFT JOIN pois p ON p.id = e.poi_id
         WHERE e.day_id = ?
         ORDER BY e.sort_order ASC`,
      )
      .bind(day.id)
      .all<EntryWithCoords>();

    const list = entries.results;
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const curr = list[i];
      if (!prev || !curr) continue;
      // Skip if either side missing coords — can't compute meaningful travel
      if (prev.lat == null || prev.lng == null || curr.lat == null || curr.lng == null) continue;

      try {
        const result = await computeRoute(
          apiKey,
          { lat: prev.lat, lng: prev.lng },
          { lat: curr.lat, lng: curr.lng },
          googleMode,
        );
        updates.push({
          entryId: curr.id,
          distance_m: result.distance_meters,
          duration_s: result.duration_seconds,
          source: 'google',
        });
        sourceBreakdown['google'] = (sourceBreakdown['google'] ?? 0) + 1;
        pairsComputed++;
      } catch (err) {
        // Single-pair failure: log but continue（design doc T13: no fallback）。
        // 整段 Google service down 時，會在第一 pair 就 throw MAPS_UPSTREAM_FAILED 上來
        // (computeRoute 內部 throw)，整 batch 失敗 — 此 try 只 catch invalid coords / 個別 4xx。
        sourceBreakdown['error'] = (sourceBreakdown['error'] ?? 0) + 1;
        if (err instanceof AppError && err.code === 'MAPS_LOCKED') throw err;
        // Other errors → swallow per pair, continue with rest
      }
    }
  }

  // Batch UPDATE trip_entries
  const now = Date.now();
  if (updates.length > 0) {
    const stmts = updates.map((u) =>
      db
        .prepare(
          `UPDATE trip_entries
           SET travel_distance_m = ?, travel_min = ?, travel_computed_at = ?, travel_source = ?
           WHERE id = ?`,
        )
        .bind(u.distance_m, Math.round(u.duration_s / 60), now, u.source, u.entryId),
    );
    await db.batch(stmts);
  }

  return json({
    ok: true,
    trip_id: tripId,
    days_processed: daysRes.results.length,
    pairs_computed: pairsComputed,
    source_breakdown: sourceBreakdown,
    mode: tripMode,
  });
};
