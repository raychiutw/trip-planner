/**
 * POST /api/trips/:id/recompute-travel?day=N|all
 *
 * v2.24.0 trip-segments：
 *   - 1km gate（Haversine 本地算）：≤1km → walking + WALK API；>1km → driving + DRIVE API
 *   - 永遠 1 Google Routes call/pair（不打 TRANSIT — Japan 無資料）
 *   - 寫 trip_segments（first-class）+ dual-write trip_entries.travel_*（legacy until Phase ε）
 *   - mode_source='user' 既有 segment 不覆寫（保留 user override）
 *
 * Self-drive 窗內也吃 1km gate（短程仍 walking — 找停車位比走路慢）。
 *
 * Subrequest budget（CF Pages Free 50/invocation）：
 *   1 (assertGoogleAvailable) + 1 (trip) + 1 (days) + N day SELECTs
 *     + 1 (existing segments preload) + 47 (Routes calls per pair) + 1 (db.batch)
 *   ~52 for HuiYun 47 pairs；約莫擦邊。day filter recompute 永遠安全。
 *
 * Auth: trip write permission.
 */

import { hasWritePermission } from '../../_auth';
import { AppError } from '../../_errors';
import { json, getAuth } from '../../_utils';
import { assertGoogleAvailable } from '../../_maps_lock';
import { computeRoute } from '../../../../src/server/maps/google-client';
import { haversineMeters } from '../../../../src/lib/geo';
import type { Env } from '../../_types';

const WALK_GATE_M = 1000;

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

interface ExistingSegment {
  id: number;
  from_entry_id: number;
  to_entry_id: number;
  mode_source: string;
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

  const trip = await db.prepare('SELECT id FROM trips WHERE id = ?').bind(tripId).first();
  if (!trip) throw new AppError('DATA_NOT_FOUND', '找不到該行程');

  const apiKey = context.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new AppError('MAPS_UPSTREAM_FAILED', 'GOOGLE_MAPS_API_KEY not configured');
  await assertGoogleAvailable(db);

  const url = new URL(context.request.url);
  const dayParam = url.searchParams.get('day');
  let dayNumFilter: number | null = null;
  if (dayParam && dayParam !== 'all') {
    const n = parseInt(dayParam, 10);
    if (!Number.isFinite(n) || n < 1) {
      throw new AppError('DATA_VALIDATION', 'day 必須為正整數或 all');
    }
    dayNumFilter = n;
  }

  const daysSql = dayNumFilter !== null
    ? 'SELECT id, day_num FROM trip_days WHERE trip_id = ? AND day_num = ? ORDER BY day_num'
    : 'SELECT id, day_num FROM trip_days WHERE trip_id = ? ORDER BY day_num';
  const daysBind = dayNumFilter !== null ? [tripId, dayNumFilter] : [tripId];
  const daysRes = await db.prepare(daysSql).bind(...daysBind).all<TripDay>();

  // Pre-load 既有 segments（單一 SELECT 省 N 次 per-pair query）
  const existingRes = await db
    .prepare('SELECT id, from_entry_id, to_entry_id, mode_source FROM trip_segments WHERE trip_id = ?')
    .bind(tripId)
    .all<ExistingSegment>();
  const existingMap = new Map<string, ExistingSegment>();
  for (const s of existingRes.results) {
    existingMap.set(`${s.from_entry_id}-${s.to_entry_id}`, s);
  }

  let pairsComputed = 0;
  let pairsSkippedUser = 0;
  const sourceBreakdown: Record<string, number> = {};
  const modeBreakdown: Record<string, number> = {};
  const errorsDetail: Array<{ entryId: number; message: string }> = [];

  // 收集 batch statements 最後一次 db.batch 寫入（單一 subrequest）
  const segmentInserts: Array<{ tripId: string; from: number; to: number; mode: string; min: number; distM: number; now: number }> = [];
  const segmentUpdates: Array<{ id: number; mode: string; min: number; distM: number; now: number }> = [];
  const legacyEntryUpdates: Array<{ entryId: number; distM: number; min: number; now: number; mode: string }> = [];

  for (const day of daysRes.results) {
    const entriesRes = await db
      .prepare(
        `SELECT e.id, e.day_id, e.sort_order, p.lat, p.lng
         FROM trip_entries e
         LEFT JOIN trip_entry_pois tep ON tep.entry_id = e.id AND tep.sort_order = 1
         LEFT JOIN pois p ON p.id = tep.poi_id
         WHERE e.day_id = ?
         ORDER BY e.sort_order ASC`,
      )
      .bind(day.id)
      .all<EntryWithCoords>();

    const list = entriesRes.results;
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const curr = list[i];
      if (!prev || !curr) continue;
      if (prev.lat == null || prev.lng == null || curr.lat == null || curr.lng == null) continue;

      const existing = existingMap.get(`${prev.id}-${curr.id}`);
      if (existing && existing.mode_source === 'user') {
        pairsSkippedUser++;
        continue;
      }

      // 1km gate（pure local Haversine — 0 API call）
      const distHaversine = haversineMeters(
        { lat: prev.lat, lng: prev.lng },
        { lat: curr.lat, lng: curr.lng },
      );
      const chosenMode: 'walking' | 'driving' = distHaversine <= WALK_GATE_M ? 'walking' : 'driving';
      const apiMode: 'WALK' | 'DRIVE' = chosenMode === 'walking' ? 'WALK' : 'DRIVE';

      try {
        const result = await computeRoute(
          apiKey,
          { lat: prev.lat, lng: prev.lng },
          { lat: curr.lat, lng: curr.lng },
          apiMode,
        );

        const minutes = Math.round(result.duration_seconds / 60);
        const distM = result.distance_meters;
        const now = Date.now();

        if (existing) {
          segmentUpdates.push({ id: existing.id, mode: chosenMode, min: minutes, distM, now });
        } else {
          segmentInserts.push({ tripId, from: prev.id, to: curr.id, mode: chosenMode, min: minutes, distM, now });
        }
        legacyEntryUpdates.push({ entryId: curr.id, distM, min: minutes, now, mode: chosenMode });

        sourceBreakdown['google'] = (sourceBreakdown['google'] ?? 0) + 1;
        modeBreakdown[chosenMode] = (modeBreakdown[chosenMode] ?? 0) + 1;
        pairsComputed++;
      } catch (err) {
        sourceBreakdown['error'] = (sourceBreakdown['error'] ?? 0) + 1;
        const detail = err instanceof AppError ? (err.detail ?? err.message) : (err instanceof Error ? err.message : String(err));
        errorsDetail.push({ entryId: curr.id, message: detail.slice(0, 200) });
        if (err instanceof AppError && err.code === 'MAPS_LOCKED') throw err;
      }
    }
  }

  // 單一 db.batch 寫入所有 upserts + legacy dual-write（1 subrequest 不論 statement 數）
  if (segmentInserts.length > 0 || segmentUpdates.length > 0 || legacyEntryUpdates.length > 0) {
    const stmts = [
      // INSERT 用 ON CONFLICT 防 TOCTOU race：preload 後若另一支 concurrent
      // recompute 已 INSERT 同 (from,to) pair，本 batch 不會炸 UNIQUE → atomic
      // rollback；改成 upsert。WHERE mode_source = 'auto' 防 race PATCH 時 user
      // override 被 auto recompute 蓋（preload→write 之間若 user 改過 mode_source
      // 為 'user'，DO UPDATE 因 WHERE 不成立 → no-op，保留 user 覆寫）。
      ...segmentInserts.map((s) => db.prepare(
        `INSERT INTO trip_segments
         (trip_id, from_entry_id, to_entry_id, mode, mode_source, min, distance_m, source, computed_at, updated_at)
         VALUES (?, ?, ?, ?, 'auto', ?, ?, 'google', ?, ?)
         ON CONFLICT (from_entry_id, to_entry_id) DO UPDATE SET
           mode = excluded.mode,
           mode_source = 'auto',
           min = excluded.min,
           distance_m = excluded.distance_m,
           source = 'google',
           computed_at = excluded.computed_at,
           updated_at = excluded.updated_at
         WHERE trip_segments.mode_source = 'auto'`,
      ).bind(s.tripId, s.from, s.to, s.mode, s.min, s.distM, s.now, s.now)),
      // UPDATE 加 mode_source='auto' guard：preload→write 之間若 user PATCH 過
      // mode_source='user'，本 UPDATE 因 WHERE 不成立 → 0 rows affected (correct)。
      ...segmentUpdates.map((s) => db.prepare(
        `UPDATE trip_segments
         SET mode = ?, mode_source = 'auto', min = ?, distance_m = ?,
             source = 'google', computed_at = ?, updated_at = ?
         WHERE id = ? AND mode_source = 'auto'`,
      ).bind(s.mode, s.min, s.distM, s.now, s.now, s.id)),
      ...legacyEntryUpdates.map((u) => db.prepare(
        `UPDATE trip_entries
         SET travel_distance_m = ?, travel_min = ?, travel_computed_at = ?,
             travel_source = 'google', travel_type = ?
         WHERE id = ?`,
      ).bind(u.distM, u.min, u.now, u.mode, u.entryId)),
    ];
    await db.batch(stmts);
  }

  return json({
    ok: true,
    tripId,
    daysProcessed: daysRes.results.length,
    pairsComputed,
    pairsSkippedUser,
    sourceBreakdown,
    modeBreakdown,
    errorsDetail,
  });
};
