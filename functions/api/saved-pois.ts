/**
 * GET  /api/saved-pois            — 列出當前使用者的 POI 收藏（JOIN pois + usages）
 * POST /api/saved-pois { poiId, note? } — 新增收藏
 *
 * 驗證：auth 必要；重複收藏 → 409；POI 不存在 → 404。
 *
 * V2 cutover (E-H2 dual-read, E-M1 single-query JOIN):
 *   - SELECT/INSERT 雙寫 email + user_id（auth.userId 可能為 null，nullable column 容忍）
 *   - 過濾條件: WHERE email = ? OR user_id = ? — backfilled row 兩條都對，舊 row 仍 email match
 *   - usages 用 json_group_array 一次查（避免 N+1）回傳每個收藏目前在哪些 trip 出現
 */
import { AppError } from './_errors';
import { requireAuth } from './_auth';
import { json, parseJsonBody } from './_utils';
import type { Env } from './_types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);

  // E-M1 single-query JOIN: usages 透過 LEFT JOIN trip_pois (per saved poi → 0..N usage)
  // GROUP_CONCAT 包成 JSON-ish string 因 SQLite 沒原生 json_group_array 在 D1 全版本。
  // 改用 json_object + group_concat 串成 array 字串，前端 parse。
  // (D1 SQLite 3.35+ 支援 json_group_array — 用之省手動串 JSON。)
  const { results } = await context.env.DB.prepare(
    `SELECT sp.id, sp.email, sp.user_id, sp.poi_id, sp.saved_at, sp.note,
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
     WHERE sp.email = ? OR sp.user_id = ?
     ORDER BY sp.saved_at DESC, sp.id DESC`,
  ).bind(auth.email, auth.userId).all();

  // Parse usages_json client-side-friendly
  const enriched = (results ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    let usages: unknown[] = [];
    try {
      usages = typeof row.usages_json === 'string' ? JSON.parse(row.usages_json) : [];
    } catch {
      usages = [];
    }
    delete row.usages_json;
    return { ...row, usages };
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

  try {
    const row = await context.env.DB
      .prepare(
        // E-H2 dual-write: email + user_id 同時寫，phase 2 drop email column 後改 user_id only
        `INSERT INTO saved_pois (email, user_id, poi_id, note) VALUES (?, ?, ?, ?) RETURNING *`,
      )
      .bind(auth.email, auth.userId, body.poiId, body.note ?? null)
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
