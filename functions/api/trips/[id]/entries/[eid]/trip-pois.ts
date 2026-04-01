/**
 * POST /api/trips/:id/entries/:eid/trip-pois — 新增 POI 到 entry
 * 取代舊的 entries/[eid]/restaurants.ts 和 entries/[eid]/shopping.ts
 */

import { logAudit } from '../../../../_audit';
import { hasPermission, verifyEntryBelongsToTrip } from '../../../../_auth';
import { AppError } from '../../../../_errors';
import { findOrCreatePoi } from '../../../../_poi';
import { json, getAuth, parseJsonBody, parseIntParam } from '../../../../_utils';
import type { Env } from '../../../../_types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, eid } = context.params as { id: string; eid: string };
  const entryId = parseIntParam(eid);
  if (!entryId) throw new AppError('DATA_VALIDATION', 'entry ID 格式錯誤');
  const db = context.env.DB;

  const [hasPerm, belongsToTrip] = await Promise.all([
    hasPermission(db, auth.email, id, auth.isAdmin),
    verifyEntryBelongsToTrip(db, entryId, id),
  ]);
  if (!hasPerm) throw new AppError('PERM_DENIED');
  if (!belongsToTrip) throw new AppError('PERM_DENIED', '此 entry 不屬於該行程');

  type AddPoiBody = {
    name: string;
    type: 'restaurant' | 'shopping';
    context: 'timeline' | 'shopping';
    description?: string;
    note?: string;
    hours?: string;
    google_rating?: number;
    category?: string;
    maps?: string;
    mapcode?: string;
    lat?: number;
    lng?: number;
    // Type-specific
    price?: string;
    reservation?: string;
    reservation_url?: string;
    must_buy?: string;
  };

  const body = await parseJsonBody<AddPoiBody>(context.request);

  if (!body.name || !body.type) {
    throw new AppError('DATA_VALIDATION', '缺少必要欄位：name, type');
  }

  // Find day_id from entry
  const entry = await db.prepare('SELECT day_id FROM trip_entries WHERE id = ?').bind(entryId).first<{ day_id: number }>();
  if (!entry) throw new AppError('DATA_NOT_FOUND', '找不到此 entry');

  // Find or create POI master (shared helper, race-safe with UNIQUE index)
  const poiId = await findOrCreatePoi(db, {
    name: body.name, type: body.type,
    description: body.description as string, hours: body.hours as string,
    google_rating: body.google_rating as number, category: body.category as string,
    maps: body.maps as string, mapcode: body.mapcode as string,
    lat: body.lat as number, lng: body.lng as number, source: 'ai',
  });

  // Get next sort_order
  const maxSort = await db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM trip_pois WHERE entry_id = ? AND context = ?'
  ).bind(entryId, body.context || 'timeline').first<{ max_sort: number }>();

  // Insert trip_pois
  const result = await db.prepare(
    `INSERT INTO trip_pois (poi_id, trip_id, context, entry_id, day_id, sort_order, description, note, hours, price, reservation, reservation_url, must_buy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  ).bind(
    poiId, id, body.context || 'timeline', entryId, entry.day_id,
    (maxSort?.max_sort ?? -1) + 1,
    body.description ?? null, body.note ?? null, body.hours ?? null,
    body.price ?? null, body.reservation ?? null, body.reservation_url ?? null,
    body.must_buy ?? null,
  ).first();

  await logAudit(db, {
    tripId: id, tableName: 'trip_pois', recordId: (result as { id: number }).id,
    action: 'insert', changedBy: auth.email,
    diffJson: JSON.stringify(body),
  });

  return json(result, 201);
};
