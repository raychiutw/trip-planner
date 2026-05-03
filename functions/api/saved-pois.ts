/**
 * GET  /api/saved-pois            — 列出當前使用者的 POI 收藏（JOIN pois + usages）
 * POST /api/saved-pois { poiId, note? } — 新增收藏
 *
 * 驗證：auth 必要；重複收藏 → 409；POI 不存在 → 404。
 *
 * V2 cutover phase 2 (migration 0047): saved_pois.email column dropped。
 *   - 純 user_id query — pre-V2 sessions / service tokens 沒 user_id → 回傳空清單
 *   - usages 用 json_group_array 一次查（避免 N+1）回傳每個收藏目前在哪些 trip 出現
 */
import { AppError } from './_errors';
import { requireAuth } from './_auth';
import { json, parseJsonBody } from './_utils';
import type { Env } from './_types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);
  if (!auth.userId) return json([]); // V2 cutover: 沒 user_id 沒收藏

  // E-M1 single-query JOIN: usages 透過 LEFT JOIN trip_pois (per saved poi → 0..N usage)
  // D1 SQLite 3.35+ 支援 json_group_array + json_object — 一次 query 反查 usages。
  const { results } = await context.env.DB.prepare(
    `SELECT sp.id, sp.user_id, sp.poi_id, sp.saved_at, sp.note,
            p.name AS poi_name, p.address AS poi_address,
            p.lat AS poi_lat, p.lng AS poi_lng, p.type AS poi_type,
            COALESCE(
              (SELECT json_group_array(json_object(
                  'tripId', tp.trip_id,
                  'tripName', t.name,
                  'dayNum', td.day_num,
                  'dayDate', td.date,
                  'entryId', tp.entry_id
                ))
                FROM trip_pois tp
                LEFT JOIN trip_days td ON td.id = tp.day_id
                LEFT JOIN trips t ON t.id = tp.trip_id
                WHERE tp.poi_id = sp.poi_id),
              '[]'
            ) AS usages_json
     FROM saved_pois sp
     JOIN pois p ON p.id = sp.poi_id
     WHERE sp.user_id = ?
     ORDER BY sp.saved_at DESC, sp.id DESC`,
  ).bind(auth.userId).all();

  // SQLite json_group_array 保證輸出合法 JSON；不需 try/catch 兜底（malformed 代表 D1 bug 應顯露）
  const enriched = (results ?? []).map((r) => {
    const { usages_json, ...rest } = r as Record<string, unknown> & { usages_json?: string };
    return { ...rest, usages: usages_json ? JSON.parse(usages_json) : [] };
  });

  return json(enriched);
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

  if (!auth.userId) throw new AppError('AUTH_REQUIRED', '需 V2 OAuth 登入才能收藏');
  try {
    const row = await context.env.DB
      .prepare(
        // V2 cutover phase 2: 純 user_id-keyed insert (email column 已 dropped)
        `INSERT INTO saved_pois (user_id, poi_id, note) VALUES (?, ?, ?) RETURNING *`,
      )
      .bind(auth.userId, body.poiId, body.note ?? null)
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
