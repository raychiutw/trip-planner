/**
 * POST /api/trips/:id/recompute-travel?day=N|all
 *
 * Recomputes travel_* fields on trip_entries by walking adjacent (sort_order)
 * entries within each day, fetching pois.lat/lng, calling
 * src/server/travel/compute.ts (ORS primary, Haversine fallback).
 *
 * Updates entry[i+1].travel_distance_m / travel_min / travel_computed_at /
 * travel_source. First entry per day stays NULL (no prior).
 *
 * Mode comes from trips.default_travel_mode.
 *
 * Triggered by:
 *   - TimelineRail.handleDragEnd (commit 16) when user reorders entries
 *   - Manual recompute via UI/CLI
 *
 * Auth: trip write permission (owner/member with write).
 */

import { hasWritePermission } from '../../_auth';
import { AppError } from '../../_errors';
import { json, getAuth } from '../../_utils';
import { computeTravel, type TravelMode } from '../../../../src/server/travel/compute';
import type { Env } from '../../_types';

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
  if (!await hasWritePermission(db, auth.email, tripId, false)) {
    throw new AppError('PERM_DENIED');
  }

  // Resolve trip mode (defaults to 'driving')
  const trip = await db
    .prepare('SELECT default_travel_mode FROM trips WHERE id = ?')
    .bind(tripId)
    .first<{ default_travel_mode: string | null }>();
  if (!trip) throw new AppError('DATA_NOT_FOUND', '找不到該行程');
  const mode = (trip.default_travel_mode ?? 'driving') as TravelMode;

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

      const result = await computeTravel({
        orsApiKey: context.env.ORS_API_KEY,
        mode,
        origin: { lat: prev.lat, lng: prev.lng },
        dest: { lat: curr.lat, lng: curr.lng },
      });
      updates.push({
        entryId: curr.id,
        distance_m: result.distance_m,
        duration_s: result.duration_s,
        source: result.source,
      });
      sourceBreakdown[result.source] = (sourceBreakdown[result.source] ?? 0) + 1;
      pairsComputed++;
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
    mode,
  });
};
