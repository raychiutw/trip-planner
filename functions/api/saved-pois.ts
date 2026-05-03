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
import { bumpRateLimit, RATE_LIMITS } from './_rate_limit';
import type { Env } from './_types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = requireAuth(context);
  if (!auth.userId) return json([]); // V2 cutover: 沒 user_id 沒收藏

  // usages 只回傳「user 自己有 read 權限的 trip」 — 防 POI cross-user data leak。
  // 沒做這個 filter 時，如果 user A 與 user B 都收藏同一個 POI、B 在私人 trip 裡用了
  // 這個 POI，A 會看到 B 的 tripId/tripName/dayDate。EXISTS subquery 收緊到 user
  // 的 owner trip + 自己有 trip_permissions row 的 trip。
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
                WHERE tp.poi_id = sp.poi_id
                  AND (
                    t.owner_user_id = ?1
                    OR EXISTS (
                      SELECT 1 FROM trip_permissions perm
                      WHERE perm.trip_id = tp.trip_id AND perm.user_id = ?1
                    )
                  )
              ),
              '[]'
            ) AS usages_json
     FROM saved_pois sp
     JOIN pois p ON p.id = sp.poi_id
     WHERE sp.user_id = ?1
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
  if (!auth.userId) throw new AppError('AUTH_REQUIRED', '需 V2 OAuth 登入才能收藏');

  // Rate limit: 10/min per user (admin bypasses). Defends POI enumeration oracle —
  // attacker POSTs many random poiId's; 404 vs 409 vs 201 reveals existence.
  // bump-first pattern: every attempt counts (POSTs are not auth-failure-gated like
  // login)；bumpRateLimit reject 自帶 ok=false + retryAfter，省一次 D1 query。
  if (!auth.isAdmin) {
    const bucket = `saved-pois-post:${auth.userId}`;
    const bump = await bumpRateLimit(context.env.DB, bucket, RATE_LIMITS.SAVED_POIS_WRITE);
    if (!bump.ok) {
      return new Response(JSON.stringify({ error: 'RATE_LIMITED' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(bump.retryAfter ?? 60),
        },
      });
    }
  }

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
