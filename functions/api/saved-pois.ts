/**
 * GET  /api/saved-pois            — 列出當前使用者的 POI 收藏（JOIN pois）
 * POST /api/saved-pois { poiId, note? } — 新增收藏
 *
 * 驗證：auth 必要；重複收藏 → 409；POI 不存在 → 404。
 * 資料所有權以 email 為 key（V2 OAuth ship 前的暫行方案）。
 */
import { AppError } from './_errors';
import { requireAuth } from './_auth';
import { json, parseJsonBody } from './_utils';
import type { Env } from './_types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);

  const { results } = await context.env.DB.prepare(
    `SELECT sp.id, sp.email, sp.poi_id, sp.saved_at, sp.note,
            p.name AS poi_name, p.address AS poi_address,
            p.lat AS poi_lat, p.lng AS poi_lng, p.type AS poi_type
     FROM saved_pois sp
     JOIN pois p ON p.id = sp.poi_id
     WHERE sp.email = ?
     ORDER BY sp.saved_at DESC, sp.id DESC`,
  ).bind(auth.email).all();

  return json(results);
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);
  const body = await parseJsonBody<{ poiId?: number; note?: string }>(context.request);

  if (!body.poiId || !Number.isInteger(body.poiId) || body.poiId <= 0) {
    throw new AppError('DATA_VALIDATION', '缺少或無效的 poiId');
  }

  const poi = await context.env.DB
    .prepare('SELECT id FROM pois WHERE id = ?')
    .bind(body.poiId)
    .first();
  if (!poi) throw new AppError('DATA_NOT_FOUND', 'POI 不存在');

  try {
    const row = await context.env.DB
      .prepare(
        `INSERT INTO saved_pois (email, poi_id, note) VALUES (?, ?, ?) RETURNING *`,
      )
      .bind(auth.email, body.poiId, body.note ?? null)
      .first();
    if (!row) throw new AppError('SYS_INTERNAL', 'INSERT RETURNING 未回傳資料');
    return json(row, 201);
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      throw new AppError('DATA_CONFLICT', '該 POI 已收藏');
    }
    throw err;
  }
};
