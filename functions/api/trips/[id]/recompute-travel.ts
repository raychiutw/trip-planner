/**
 * POST /api/trips/:id/recompute-travel?day=N|all
 *
 * v2.24.0 trip-segments：
 *   - 1km gate（Haversine 本地算）：≤1km → walking + WALK API；>1km → driving + DRIVE API
 *   - 永遠 1 Google Routes call/pair（不打 TRANSIT — Japan 無資料）
 *   - 寫 trip_segments（first-class，v2.29.0 為唯一 source，entry.travel_* 已 DROPPED）
 *
 * v2.30.0（mode_source DROPPED）：
 *   - mode='transit' 既有 segment 不覆寫（user 手填 min，recompute 不能蓋）
 *   - 切回 driving / walking 由 PATCH /segments/:sid 觸發 Google Routes 重算
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

import { hasWritePermission, requireAuth} from '../../_auth';
import { logAudit } from '../../_audit';
import { AppError } from '../../_errors';
import { json } from '../../_utils';
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
  mode: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);

  const tripId = context.params.id as string;
  if (!tripId) throw new AppError('DATA_VALIDATION', '缺少 tripId');

  const db = context.env.DB;
  if (!await hasWritePermission(db, auth, tripId)) {
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
    .prepare('SELECT id, from_entry_id, to_entry_id, mode FROM trip_segments WHERE trip_id = ?')
    .bind(tripId)
    .all<ExistingSegment>();
  const existingMap = new Map<string, ExistingSegment>();
  for (const s of existingRes.results) {
    existingMap.set(`${s.from_entry_id}-${s.to_entry_id}`, s);
  }

  let pairsComputed = 0;
  let pairsSkippedTransit = 0;
  let pairsSkippedMissingCoords = 0;
  const sourceBreakdown: Record<string, number> = {};
  const modeBreakdown: Record<string, number> = {};
  const errorsDetail: Array<{ entryId: number; message: string }> = [];

  // 收集 batch statements 最後一次 db.batch 寫入（單一 subrequest）
  const segmentInserts: Array<{ tripId: string; from: number; to: number; mode: string; min: number; distM: number; now: number }> = [];
  const segmentUpdates: Array<{ id: number; mode: string; min: number; distM: number; now: number }> = [];
  // v2.29.0: trip_entries.travel_* DROPPED. trip_segments 為唯一 source.

  // v2.33.32 (simplify PR-5): batch all-days entries lookup into 1 query (was N
  // sequential SELECT WHERE day_id=?). 30-day trip 從 ~30 D1 round trips → 1。
  // 仍 ORDER BY day_id, sort_order；in-memory group。
  const dayIds = daysRes.results.map((d) => d.id);
  const entriesByDay = new Map<number, EntryWithCoords[]>();
  if (dayIds.length > 0) {
    const placeholders = dayIds.map(() => '?').join(',');
    const allEntriesRes = await db
      .prepare(
        `SELECT e.id, e.day_id, e.sort_order, p.lat, p.lng
         FROM trip_entries e
         LEFT JOIN trip_entry_pois tep ON tep.entry_id = e.id AND tep.sort_order = 1
         LEFT JOIN pois p ON p.id = tep.poi_id
         WHERE e.day_id IN (${placeholders})
         ORDER BY e.day_id ASC, e.sort_order ASC`,
      )
      .bind(...dayIds)
      .all<EntryWithCoords>();
    for (const row of allEntriesRes.results) {
      const arr = entriesByDay.get(row.day_id) ?? [];
      arr.push(row);
      entriesByDay.set(row.day_id, arr);
    }
  }

  const now = Date.now();
  for (const day of daysRes.results) {
    const list = entriesByDay.get(day.id) ?? [];
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const curr = list[i];
      if (!prev || !curr) continue;
      if (prev.lat == null || prev.lng == null || curr.lat == null || curr.lng == null) {
        pairsSkippedMissingCoords++;
        continue;
      }

      const existing = existingMap.get(`${prev.id}-${curr.id}`);
      if (existing && existing.mode === 'transit') {
        // transit = user 手填 min（Japan Routes 無 transit 資料），recompute 不覆寫
        pairsSkippedTransit++;
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

        if (existing) {
          segmentUpdates.push({ id: existing.id, mode: chosenMode, min: minutes, distM, now });
        } else {
          segmentInserts.push({ tripId, from: prev.id, to: curr.id, mode: chosenMode, min: minutes, distM, now });
        }
        // v2.29.0: trip_entries.travel_* DROPPED, no dual-write to legacy cols.

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

  // 單一 db.batch 寫入所有 upserts（1 subrequest 不論 statement 數）
  if (segmentInserts.length > 0 || segmentUpdates.length > 0) {
    const stmts = [
      // INSERT 用 ON CONFLICT 防 TOCTOU race：preload 後若另一支 concurrent
      // recompute 已 INSERT 同 (from,to) pair，本 batch 不會炸 UNIQUE → atomic
      // rollback；改成 upsert。WHERE mode != 'transit' 防 race：preload→write
      // 之間若 user PATCH 改成 transit（手填 min），DO UPDATE 不蓋。
      ...segmentInserts.map((s) => db.prepare(
        `INSERT INTO trip_segments
         (trip_id, from_entry_id, to_entry_id, mode, min, distance_m, source, computed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'google', ?, ?)
         ON CONFLICT (from_entry_id, to_entry_id) DO UPDATE SET
           mode = excluded.mode,
           min = excluded.min,
           distance_m = excluded.distance_m,
           source = 'google',
           computed_at = excluded.computed_at,
           updated_at = excluded.updated_at
         WHERE trip_segments.mode != 'transit'`,
      ).bind(s.tripId, s.from, s.to, s.mode, s.min, s.distM, s.now, s.now)),
      // UPDATE 加 mode != 'transit' guard：preload→write 之間若 user PATCH 改 transit，
      // 本 UPDATE 因 WHERE 不成立 → 0 rows affected (correct)。
      ...segmentUpdates.map((s) => db.prepare(
        `UPDATE trip_segments
         SET mode = ?, min = ?, distance_m = ?,
             source = 'google', computed_at = ?, updated_at = ?
         WHERE id = ? AND mode != 'transit'`,
      ).bind(s.mode, s.min, s.distM, s.now, s.now, s.id)),
    ];
    await db.batch(stmts);
  }

  // PR32: audit log for recompute-travel bulk batch（recordId=null + 摘要）
  await logAudit(db, {
    tripId,
    tableName: 'trip_segments',
    recordId: null,
    action: 'update',
    changedBy: auth.email,
    diffJson: JSON.stringify({
      op: 'recompute-travel',
      daysProcessed: daysRes.results.length,
      pairsComputed,
      pairsSkippedTransit,
      pairsSkippedMissingCoords,
      sourceBreakdown,
      modeBreakdown,
    }),
  });

  return json({
    ok: true,
    tripId,
    daysProcessed: daysRes.results.length,
    pairsComputed,
    pairsSkippedTransit,
    pairsSkippedMissingCoords,
    sourceBreakdown,
    modeBreakdown,
    errorsDetail,
  });
};
