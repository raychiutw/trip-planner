/**
 * POST /api/trips/:id/entries/:eid/trip-pois — 新增 POI 到 entry
 * 取代舊的 entries/[eid]/restaurants.ts 和 entries/[eid]/shopping.ts
 */

import { logAudit } from '../../../../_audit';
import { hasPermission, verifyEntryBelongsToTrip } from '../../../../_auth';
import { AppError } from '../../../../_errors';
import { json, getAuth, parseJsonBody } from '../../../../_utils';
import type { Env } from '../../../../_types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, eid } = context.params as { id: string; eid: string };
  const entryId = Number(eid);
  const db = context.env.DB;

  if (!await hasPermission(db, auth.email, id, auth.isAdmin)) {
    throw new AppError('PERM_DENIED');
  }

  if (!await verifyEntryBelongsToTrip(db, entryId, id)) {
    throw new AppError('PERM_DENIED', '此 entry 不屬於該行程');
  }

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

  const bodyOrError = await parseJsonBody<AddPoiBody>(context.request);
  if (bodyOrError instanceof Response) return bodyOrError;
  const body = bodyOrError;

  if (!body.name || !body.type) {
    throw new AppError('DATA_VALIDATION', '缺少必要欄位：name, type');
  }

  // Find day_id from entry
  const entry = await db.prepare('SELECT day_id FROM trip_entries WHERE id = ?').bind(entryId).first<{ day_id: number }>();
  if (!entry) throw new AppError('DATA_NOT_FOUND', '找不到此 entry');

  // Find or create POI master
  let poiId: number;
  const existing = await db.prepare('SELECT id FROM pois WHERE name = ? AND type = ? LIMIT 1')
    .bind(body.name, body.type).first<{ id: number }>();

  if (existing) {
    poiId = existing.id;
  } else {
    const result = await db.prepare(
      'INSERT INTO pois (type, name, description, hours, google_rating, category, maps, mapcode, lat, lng, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id'
    ).bind(
      body.type, body.name, body.description ?? null, body.hours ?? null,
      body.google_rating ?? null, body.category ?? null,
      body.maps ?? null, body.mapcode ?? null,
      body.lat ?? null, body.lng ?? null, 'ai',
    ).first<{ id: number }>();
    poiId = result!.id;
  }

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
