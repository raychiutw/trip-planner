/**
 * POST /api/pois/:id/enrich — refresh rating + status + hours from Google Place Details.
 *
 * v2.23.0 google-maps-migration: 取代舊 src/server/poi/enrich.ts 鏈
 * (Nominatim → Overpass → OpenTripMap → Wikidata)，改直接打 Google Place Details。
 *
 * 觸發條件：
 *   - 手動：POI lightbox「重新檢查」按鈕
 *   - 排程：scripts/google-poi-refresh-30d.ts daily job
 *   - 初始：scripts/google-poi-initial-backfill.ts 一次性 backfill
 *
 * 寫入 pois 欄位：rating / status / status_reason / status_checked_at / last_refreshed_at
 *   - business_status='OPERATIONAL' → status='active'
 *   - business_status='CLOSED_PERMANENTLY' → status='closed' + reason='永久歇業'
 *   - business_status='CLOSED_TEMPORARILY' → status='active'（暫時性，不 banner 警告）
 *   - Place Details 404 → status='missing' + reason='Google Maps 查無資料'
 *
 * Auth: 同 PATCH /pois/:id — admin OR trip owner（passing tripId for link check）。
 */

import { hasWritePermission } from '../../_auth';
import { AppError } from '../../_errors';
import { json, getAuth, parseIntParam } from '../../_utils';
import { assertGoogleAvailable } from '../../_maps_lock';
import { getPlaceDetails } from '../../../../src/server/maps/google-client';
import type { Env } from '../../_types';

interface PoiRow {
  id: number;
  name: string;
  place_id: string | null;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const poiId = parseIntParam(context.params.id as string);
  if (!poiId) throw new AppError('DATA_VALIDATION', 'POI ID 格式錯誤');

  const db = context.env.DB;
  const url = new URL(context.request.url);
  const tripId = url.searchParams.get('tripId');

  if (!auth.isAdmin) {
    if (!tripId) throw new AppError('DATA_VALIDATION', '非 admin 必須提供 tripId 參數');
    if (!(await hasWritePermission(db, auth, tripId, false))) {
      throw new AppError('PERM_DENIED');
    }
    const link = await db
      .prepare('SELECT 1 FROM trip_pois WHERE poi_id = ? AND trip_id = ?')
      .bind(poiId, tripId)
      .first();
    if (!link) throw new AppError('PERM_DENIED', '此 POI 不屬於該行程');
  }

  const apiKey = context.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new AppError('MAPS_UPSTREAM_FAILED', 'GOOGLE_MAPS_API_KEY not configured');
  await assertGoogleAvailable(db);

  const poi = await db
    .prepare('SELECT id, name, place_id FROM pois WHERE id = ?')
    .bind(poiId)
    .first<PoiRow>();
  if (!poi) throw new AppError('DATA_NOT_FOUND', '找不到此 POI');
  if (!poi.place_id) {
    throw new AppError(
      'DATA_VALIDATION',
      'POI 缺 place_id（migration 0051 backfill 未跑完）— 請等 backfill 或先 PATCH place_id',
    );
  }

  const details = await getPlaceDetails(apiKey, poi.place_id);
  const now = new Date().toISOString();

  let status: 'active' | 'closed' | 'missing';
  let statusReason: string | null;
  let rating: number | null = null;

  if (details === null) {
    // Google 404 — POI delisted from Google Maps
    status = 'missing';
    statusReason = 'Google Maps 查無資料';
  } else {
    rating = details.rating ?? null;
    if (details.business_status === 'CLOSED_PERMANENTLY') {
      status = 'closed';
      statusReason = '永久歇業';
    } else {
      status = 'active';
      statusReason = null;
    }
  }

  await db
    .prepare(
      `UPDATE pois SET
         rating = COALESCE(?, rating),
         status = ?, status_reason = ?,
         status_checked_at = ?, last_refreshed_at = ?
       WHERE id = ?`,
    )
    .bind(rating, status, statusReason, now, now, poiId)
    .run();

  return json({
    poi_id: poiId,
    name: poi.name,
    place_id: poi.place_id,
    status,
    status_reason: statusReason,
    rating,
    refreshed_at: now,
  });
};
