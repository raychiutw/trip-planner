/**
 * POST /api/trips/:id/recompute-travel?day=N|all
 *
 * v2.23.0 google-maps-migration: ORS+Haversine → Google Routes API.
 * v2.23.8 self-drive: per-pair mode logic (DRIVE / WALK / TRANSIT).
 *
 * Mode resolution per pair (curr entry):
 *   - self_drive_enabled AND curr datetime ∈ [pickup_at, return_at] → DRIVE
 *   - else: WALK 試算（1 call）→ duration ≤10min → WALK
 *   - else: TRANSIT（2nd call，departureTime = curr datetime）
 *
 * Fallback when entry has no time: assume DRIVE (within self-drive window if enabled).
 *
 * NO Haversine fallback per P11/T13 — single pair Google failure → travel_source='error', skip.
 *
 * Auth: trip write permission (owner/member with write).
 */

import { hasWritePermission } from '../../_auth';
import { AppError } from '../../_errors';
import { json, getAuth } from '../../_utils';
import { assertGoogleAvailable } from '../../_maps_lock';
import { computeRoute } from '../../../../src/server/maps/google-client';
import type { Env } from '../../_types';

const WALK_THRESHOLD_MIN = 10;

interface EntryWithCoords {
  id: number;
  day_id: number;
  sort_order: number;
  time: string | null;     // entry start time HH:MM, may be NULL
  lat: number | null;
  lng: number | null;
}

interface TripDay {
  id: number;
  day_num: number;
  date: string;            // YYYY-MM-DD
}

interface TripMeta {
  default_travel_mode: string | null;
  self_drive_enabled: number | null;
  self_drive_pickup_at: string | null;     // ISO datetime YYYY-MM-DDTHH:MM
  self_drive_return_at: string | null;
}

/**
 * Build effective ISO datetime for an entry: combine day.date + entry.time.
 * Returns null if entry has no time (caller falls back to default mode).
 */
function entryDateTime(date: string, time: string | null): string | null {
  if (!time) return null;
  // assume time is HH:MM
  return `${date}T${time}:00`;
}

/**
 * Determine if entry's effective datetime falls within self-drive window.
 * If entry has no datetime: default true (assume in window — DRIVE conservative).
 */
function isInSelfDriveWindow(
  entryDt: string | null,
  pickupAt: string | null,
  returnAt: string | null,
): boolean {
  if (!pickupAt || !returnAt) return false;
  if (!entryDt) return true; // entry no time → assume during self-drive window
  return entryDt >= pickupAt && entryDt <= returnAt;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const tripId = context.params.id as string;
  if (!tripId) throw new AppError('DATA_VALIDATION', '缺少 tripId');

  const db = context.env.DB;
  if (!await hasWritePermission(db, auth, tripId, auth.isAdmin)) {
    throw new AppError('PERM_DENIED');
  }

  // Resolve trip meta — default_travel_mode + self-drive window
  const trip = await db
    .prepare(
      `SELECT default_travel_mode, self_drive_enabled,
              self_drive_pickup_at, self_drive_return_at
         FROM trips WHERE id = ?`,
    )
    .bind(tripId)
    .first<TripMeta>();
  if (!trip) throw new AppError('DATA_NOT_FOUND', '找不到該行程');

  const tripDefaultMode = trip.default_travel_mode ?? 'driving';
  const selfDriveEnabled = trip.self_drive_enabled === 1;
  const pickupAt = trip.self_drive_pickup_at;
  const returnAt = trip.self_drive_return_at;

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

  // Fetch days to process — incl date for entry datetime synthesis
  const daysSql = dayNumFilter !== null
    ? 'SELECT id, day_num, date FROM trip_days WHERE trip_id = ? AND day_num = ? ORDER BY day_num'
    : 'SELECT id, day_num, date FROM trip_days WHERE trip_id = ? ORDER BY day_num';
  const daysBind = dayNumFilter !== null ? [tripId, dayNumFilter] : [tripId];
  const daysRes = await db.prepare(daysSql).bind(...daysBind).all<TripDay>();

  let pairsComputed = 0;
  const sourceBreakdown: Record<string, number> = {};
  const modeBreakdown: Record<string, number> = {};
  const updates: Array<{
    entryId: number;
    distance_m: number;
    duration_s: number;
    source: string;
    travelType: string;     // 'driving' | 'walking' | 'transit'
  }> = [];

  // Walk each day's entries in sort_order
  for (const day of daysRes.results) {
    const entries = await db
      .prepare(
        `SELECT e.id, e.day_id, e.sort_order, e.time, p.lat, p.lng
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
      if (prev.lat == null || prev.lng == null || curr.lat == null || curr.lng == null) continue;

      const currDt = entryDateTime(day.date, curr.time);

      // 決定 mode：self-drive window 內 → DRIVE；否則 WALK 試算後決定 WALK / TRANSIT
      let chosenTravelType = 'driving';
      let result: { distance_meters: number; duration_seconds: number } | null = null;

      const inWindow = selfDriveEnabled && isInSelfDriveWindow(currDt, pickupAt, returnAt);

      try {
        if (inWindow) {
          chosenTravelType = 'driving';
          result = await computeRoute(
            apiKey,
            { lat: prev.lat, lng: prev.lng },
            { lat: curr.lat, lng: curr.lng },
            'DRIVE',
          );
        } else {
          // try WALK first
          const walkResult = await computeRoute(
            apiKey,
            { lat: prev.lat, lng: prev.lng },
            { lat: curr.lat, lng: curr.lng },
            'WALK',
          );
          const walkMin = walkResult.duration_seconds / 60;
          if (walkMin <= WALK_THRESHOLD_MIN) {
            chosenTravelType = 'walking';
            result = walkResult;
          } else {
            // walk >10min → 試 TRANSIT；失敗（region 沒 transit 資料 / API 限制）→ fallback walking
            // (v2.23.10：Routes API TRANSIT 對 Tokyo 主站都吐 empty {}，可能需 enable
            //  Directions API 或專屬 TRANSIT SKU。先 fallback walking 不擋 recompute。)
            const departureTime = currDt
              ? new Date(currDt).toISOString()
              : new Date().toISOString();
            try {
              result = await computeRoute(
                apiKey,
                { lat: prev.lat, lng: prev.lng },
                { lat: curr.lat, lng: curr.lng },
                'TRANSIT',
                departureTime,
              );
              chosenTravelType = 'transit';
            } catch {
              // TRANSIT not available — use walk result with walking type
              result = walkResult;
              chosenTravelType = 'walking';
            }
          }
        }

        if (!result) continue;
        updates.push({
          entryId: curr.id,
          distance_m: result.distance_meters,
          duration_s: result.duration_seconds,
          source: 'google',
          travelType: chosenTravelType,
        });
        sourceBreakdown['google'] = (sourceBreakdown['google'] ?? 0) + 1;
        modeBreakdown[chosenTravelType] = (modeBreakdown[chosenTravelType] ?? 0) + 1;
        pairsComputed++;
      } catch (err) {
        sourceBreakdown['error'] = (sourceBreakdown['error'] ?? 0) + 1;
        if (err instanceof AppError && err.code === 'MAPS_LOCKED') throw err;
        // Other errors → swallow per pair, continue
      }
    }
  }

  // Batch UPDATE trip_entries — 每 pair 寫 travel_type per chosen mode
  // (覆蓋 prior NULL，保留 user 手動 override：若 entry.travel_type 已是非 'driving'/'walking'/'transit'
  // 字串例「火車」/「徒步 5min」，視為人工註記，COALESCE 保留 — 但這條件無法在 SQL 直接 expr。
  // 妥協：v2.23.8 起 recompute 強制覆寫 travel_type 為自動模式。人工註記用 travel_desc 欄位。)
  const now = Date.now();
  if (updates.length > 0) {
    const stmts = updates.map((u) =>
      db
        .prepare(
          `UPDATE trip_entries
           SET travel_distance_m = ?, travel_min = ?, travel_computed_at = ?,
               travel_source = ?, travel_type = ?
           WHERE id = ?`,
        )
        .bind(u.distance_m, Math.round(u.duration_s / 60), now, u.source, u.travelType, u.entryId),
    );
    await db.batch(stmts);
  }

  return json({
    ok: true,
    trip_id: tripId,
    days_processed: daysRes.results.length,
    pairs_computed: pairsComputed,
    source_breakdown: sourceBreakdown,
    mode_breakdown: modeBreakdown,
    self_drive: selfDriveEnabled
      ? { enabled: true, pickup_at: pickupAt, return_at: returnAt }
      : { enabled: false },
    default_mode: tripDefaultMode,
  });
};
