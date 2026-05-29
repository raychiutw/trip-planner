/**
 * GET /api/trips/:id/notes — aggregate fetch of all 5 trip notes sections
 *
 * v2.34.x 行程筆記 (Trip Notes) feature PR2 — read endpoints。
 * 一次回 5 個 section 全資料，frontend NotesPage 載入時用，省 5×RTT。
 *
 * 個別 section endpoints（同 PR2 一併建立）：
 *   GET /api/trips/:id/notes/flights
 *   GET /api/trips/:id/notes/lodgings
 *   GET /api/trips/:id/notes/reservations
 *   GET /api/trips/:id/notes/pretrip
 *   GET /api/trips/:id/notes/emergency
 *
 * Response shape (deepCamel via _utils.json)：
 * {
 *   flights: TripFlight[],
 *   lodgings: TripLodging[],
 *   reservations: TripReservation[],
 *   pretripNotes: TripPretripNote[],
 *   emergencyContacts: TripEmergencyContact[],
 * }
 *
 * Empty section = []. Per design doc: 預設 sort_order ASC per section。
 */

import { hasPermission, requireAuth } from '../../_auth';
import { AppError } from '../../_errors';
import { json } from '../../_utils';
import type { Env } from '../../_types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const auth = requireAuth(context);
  const tripId = params.id as string;

  if (!(await hasPermission(env.DB, auth, tripId, auth.isAdmin))) {
    throw new AppError('PERM_DENIED');
  }

  // 5 parallel queries — D1 supports batch but per-table SELECTs 較清晰
  const [flights, lodgings, reservations, pretripNotes, emergencyContacts] = await Promise.all([
    env.DB
      .prepare('SELECT * FROM trip_flights WHERE trip_id = ? ORDER BY sort_order ASC, id ASC')
      .bind(tripId)
      .all(),
    env.DB
      .prepare('SELECT * FROM trip_lodgings WHERE trip_id = ? ORDER BY sort_order ASC, id ASC')
      .bind(tripId)
      .all(),
    env.DB
      .prepare('SELECT * FROM trip_reservations WHERE trip_id = ? ORDER BY sort_order ASC, id ASC')
      .bind(tripId)
      .all(),
    env.DB
      .prepare('SELECT * FROM trip_pretrip_notes WHERE trip_id = ? ORDER BY sort_order ASC, id ASC')
      .bind(tripId)
      .all(),
    env.DB
      .prepare('SELECT * FROM trip_emergency_contacts WHERE trip_id = ? ORDER BY sort_order ASC, id ASC')
      .bind(tripId)
      .all(),
  ]);

  const lodgingRows = (lodgings.results ?? []) as Array<Record<string, unknown> & { id: number }>;
  let lodgingsWithDayIds: Array<Record<string, unknown>> = lodgingRows;
  if (lodgingRows.length > 0) {
    const lodgingIds = lodgingRows.map((r) => r.id);
    const placeholders = lodgingIds.map(() => '?').join(', ');
    const { results: junctionRows } = await env.DB
      .prepare(`SELECT lodging_id, day_id FROM trip_lodging_days WHERE lodging_id IN (${placeholders})`)
      .bind(...lodgingIds)
      .all<{ lodging_id: number; day_id: number }>();
    const byLodgingId = new Map<number, number[]>();
    for (const j of junctionRows ?? []) {
      const arr = byLodgingId.get(j.lodging_id) ?? [];
      arr.push(j.day_id);
      byLodgingId.set(j.lodging_id, arr);
    }
    lodgingsWithDayIds = lodgingRows.map((r) => ({ ...r, day_ids: byLodgingId.get(r.id) ?? [] }));
  }

  return json({
    flights: flights.results ?? [],
    lodgings: lodgingsWithDayIds,
    reservations: reservations.results ?? [],
    pretripNotes: pretripNotes.results ?? [],
    emergencyContacts: emergencyContacts.results ?? [],
  });
};
