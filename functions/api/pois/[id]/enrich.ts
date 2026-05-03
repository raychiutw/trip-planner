/**
 * POST /api/pois/:id/enrich — backfill rating + OSM cols for a single POI.
 *
 * Wraps src/server/poi/enrich.ts orchestrator (Nominatim → Overpass →
 * OpenTripMap → Wikidata). Uses 90-day cache via pois.data_fetched_at;
 * caller can pass `?force=1` to bypass.
 *
 * Auth: same as PATCH /pois/:id — admin OR trip owner with this POI in
 * one of their trips. Non-admin must pass `?tripId=...` for the link check.
 */

import { enrichPoi } from '../../../../src/server/poi/enrich';
import { hasWritePermission } from '../../_auth';
import { AppError } from '../../_errors';
import { json, getAuth, parseIntParam } from '../../_utils';
import type { Env } from '../../_types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const poiId = parseIntParam(context.params.id as string);
  if (!poiId) throw new AppError('DATA_VALIDATION', 'POI ID 格式錯誤');

  const db = context.env.DB;
  const url = new URL(context.request.url);
  const force = url.searchParams.get('force') === '1';
  const tripId = url.searchParams.get('tripId');

  // Permission: admin bypasses; non-admin needs tripId + write perm + POI link
  if (!auth.isAdmin) {
    if (!tripId) throw new AppError('DATA_VALIDATION', '非 admin 必須提供 tripId 參數');
    if (!await hasWritePermission(db, auth, tripId, false)) {
      throw new AppError('PERM_DENIED');
    }
    const link = await db
      .prepare('SELECT 1 FROM trip_pois WHERE poi_id = ? AND trip_id = ?')
      .bind(poiId, tripId)
      .first();
    if (!link) throw new AppError('PERM_DENIED', '此 POI 不屬於該行程');
  }

  const result = await enrichPoi({
    db,
    poiId,
    openTripMapApiKey: context.env.OPENTRIPMAP_API_KEY,
    forceRefresh: force,
    // No throttle on single on-demand POI — caller is human waiting for response.
  });

  return json(result);
};
