/**
 * GET  /api/trip-ideas?tripId=xxx                     — 列出某 trip 的 ideas（JOIN pois）
 * POST /api/trip-ideas { tripId, poiId?, title, note? } — 新增 idea（POI-based 或自由文字）
 *
 * 驗證：auth 必要；需對 trip 有 permission；poiId 若有，POI 須存在。
 * GET 預設 filter 掉 archived_at IS NOT NULL 的 row。
 */
import { AppError } from './_errors';
import { requireAuth, hasPermission, hasWritePermission } from './_auth';
import { json, parseJsonBody } from './_utils';
import type { Env } from './_types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);
  const url = new URL(context.request.url);
  const tripId = url.searchParams.get('tripId');
  if (!tripId) throw new AppError('DATA_VALIDATION', '缺少 tripId');

  if (!(await hasPermission(context.env.DB, auth.email, tripId, auth.isAdmin))) {
    throw new AppError('PERM_DENIED');
  }

  const { results } = await context.env.DB.prepare(
    `SELECT ti.id, ti.trip_id, ti.poi_id, ti.title, ti.note,
            ti.added_at, ti.added_by, ti.promoted_to_entry_id, ti.archived_at,
            p.name AS poi_name, p.address AS poi_address,
            p.lat AS poi_lat, p.lng AS poi_lng, p.type AS poi_type
     FROM trip_ideas ti
     LEFT JOIN pois p ON p.id = ti.poi_id
     WHERE ti.trip_id = ? AND ti.archived_at IS NULL
     ORDER BY ti.added_at DESC, ti.id DESC`,
  ).bind(tripId).all();

  return json(results);
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);
  const body = await parseJsonBody<{
    tripId?: string;
    poiId?: number | null;
    title?: string;
    note?: string;
  }>(context.request);

  if (!body.tripId || !body.title) {
    throw new AppError('DATA_VALIDATION', '缺少必要欄位 tripId / title');
  }

  const trip = await context.env.DB
    .prepare('SELECT id FROM trips WHERE id = ?')
    .bind(body.tripId)
    .first();
  if (!trip) throw new AppError('DATA_NOT_FOUND', 'trip 不存在');

  if (!(await hasWritePermission(context.env.DB, auth.email, body.tripId, auth.isAdmin))) {
    throw new AppError('PERM_DENIED');
  }

  if (body.poiId != null) {
    const poi = await context.env.DB
      .prepare('SELECT id FROM pois WHERE id = ?')
      .bind(body.poiId)
      .first();
    if (!poi) throw new AppError('DATA_NOT_FOUND', 'POI 不存在');
  }

  const row = await context.env.DB
    .prepare(
      `INSERT INTO trip_ideas (trip_id, poi_id, title, note, added_by)
       VALUES (?, ?, ?, ?, ?) RETURNING *`,
    )
    .bind(body.tripId, body.poiId ?? null, body.title, body.note ?? null, auth.email)
    .first();
  if (!row) throw new AppError('SYS_INTERNAL', 'INSERT RETURNING 未回傳資料');

  return json(row, 201);
};
