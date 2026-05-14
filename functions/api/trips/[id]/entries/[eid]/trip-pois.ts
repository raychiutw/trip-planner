/**
 * POST /api/trips/:id/entries/:eid/trip-pois — 新增 POI 到 entry
 *
 * v2.29.0: trip_pois 整表 DROPPED。不論 POI type（shopping / restaurant / attraction），
 * 全部寫 trip_entry_pois as alternate (sort_order = max + 1)。
 *
 * `body.must_buy`、`body.context` legacy field 不再被處理（schema 已無對應）。
 */

import { logAudit } from '../../../../_audit';
import { hasWritePermission, verifyEntryBelongsToTrip } from '../../../../_auth';
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
    hasWritePermission(db, auth, id, auth.isAdmin),
    verifyEntryBelongsToTrip(db, entryId, id),
  ]);
  if (!hasPerm) throw new AppError('PERM_DENIED');
  if (!belongsToTrip) throw new AppError('PERM_DENIED', '此 entry 不屬於該行程');

  type AddPoiBody = {
    name: string;
    type: 'restaurant' | 'shopping' | 'attraction' | 'activity' | 'transport' | 'other';
    description?: string;
    note?: string;
    hours?: string;
    rating?: number;
    category?: string;
    mapcode?: string;
    lat?: number;
    lng?: number;
    price?: string;
    reservation?: string;
    reservation_url?: string;
  };

  const body = await parseJsonBody<AddPoiBody>(context.request);

  if (!body.name || !body.type) {
    throw new AppError('DATA_VALIDATION', '缺少必要欄位：name, type');
  }

  // Find or create POI master
  // pois.{price, hours} 是客觀屬性，由 findOrCreatePoi 寫入。
  const poiId = await findOrCreatePoi(db, {
    name: body.name, type: body.type,
    description: body.description as string, hours: body.hours as string,
    rating: body.rating as number, category: body.category as string,
    mapcode: body.mapcode as string,
    lat: body.lat as number, lng: body.lng as number, source: 'ai',
    price: body.price as string,
  });

  // v2.29.0: 全 type 統一寫 trip_entry_pois（sort_order = max+1 = alternate）。
  // sort_order subquery atomic with INSERT 縮 race window — concurrent POST 同 entry
  // 由 SQLite 單 writer + UNIQUE(entry_id, sort_order) catch 兜底。
  const now = new Date().toISOString();
  let result;
  try {
    result = await db
      .prepare(
        `INSERT INTO trip_entry_pois (
           entry_id, poi_id, sort_order, added_at, updated_at,
           description, note, reservation, reservation_url
         )
         VALUES (
           ?, ?,
           (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM trip_entry_pois WHERE entry_id = ?),
           ?, ?, ?, ?, ?, ?
         )
         RETURNING *`,
      )
      .bind(
        entryId,
        poiId,
        entryId,
        now,
        now,
        body.description ?? null,
        body.note ?? null,
        body.reservation ?? null,
        body.reservation_url ?? null,
      )
      .first();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE') && msg.includes('entry_id, poi_id')) {
      throw new AppError('DATA_CONFLICT', '此 POI 已存在於該 entry');
    }
    if (msg.includes('UNIQUE') && msg.includes('sort_order')) {
      throw new AppError('SYS_DB_ERROR', '同時新增 POI 衝突，請稍後重試');
    }
    throw err;
  }

  await db
    .prepare('UPDATE trip_entries SET entry_pois_version = entry_pois_version + 1 WHERE id = ?')
    .bind(entryId)
    .run();

  await logAudit(db, {
    tripId: id, tableName: 'trip_entry_pois', recordId: (result as { id: number }).id,
    action: 'insert', changedBy: auth.email,
    diffJson: JSON.stringify(body),
  });

  return json(result, 201);
};
