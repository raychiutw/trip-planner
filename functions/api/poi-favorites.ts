/**
 * GET  /api/poi-favorites            — 列出當前使用者的 POI 收藏（JOIN pois + usages）
 * POST /api/poi-favorites { poiId, note?, companionRequestId? } — 新增收藏
 *
 * Rename：原 saved_pois → poi_favorites + saved_at → favorited_at
 *
 * 驗證：auth 必要；重複收藏 → 409；POI 不存在 → 404。
 *
 * Companion 分支（poi-favorites-rename §6）：
 *   - 透過 functions/api/_companion.ts requireFavoriteActor 統一 effective userId
 *   - companion 模式：actor.userId 對映 trip_requests.submitted_by → users.id；
 *     寫 audit_log（changedBy=`companion:<id>`, tripId='system:companion'）；
 *     寫 companion_request_actions（UNIQUE 衝突 → 409 COMPANION_QUOTA_EXCEEDED）。
 *   - V2 user 模式：actor.userId === auth.userId；handler 行為與 cutover 前一致。
 *
 * Rate limit：bucket key 由 isClaimedCompanion 決定
 *   user：`poi-favorites-post:user:${userId}`
 *   companion：`poi-favorites-post:companion:${requestId}`
 *   admin V2 user 仍 bypass；companion 一律 rate-limit（防 enumeration / abuse）。
 */
import { AppError } from './_errors';
import { json, parseJsonBody } from './_utils';
import { bumpRateLimit, RATE_LIMITS } from './_rate_limit';
import { requireFavoriteActor } from './_companion';
import type { Env, AuthData } from './_types';

interface PoiFavoritePostBody {
  poiId?: number;
  note?: string;
  companionRequestId?: number;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = (context.data as { auth?: AuthData }).auth ?? null;

  // poi-favorites-rename §7：companion 模式從 ?companionRequestId=N query string 取
  // requestId、走 requireFavoriteActor 三 gate；gate 失敗 → 401。
  // 非 companion header 維持既有行為：anonymous / service-token without userId → []
  let effectiveUserId: string;
  const headerScope = context.request.headers.get('X-Request-Scope');
  if (headerScope === 'companion') {
    const actor = await requireFavoriteActor(context, null, 'favorite_list');
    effectiveUserId = actor.userId;
  } else if (auth?.userId) {
    effectiveUserId = auth.userId;
  } else {
    return json([]); // anonymous / service-token without resolution → empty
  }

  const { results } = await context.env.DB.prepare(
    `SELECT pf.id, pf.user_id, pf.poi_id, pf.favorited_at, pf.note,
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
                WHERE tp.poi_id = pf.poi_id
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
     FROM poi_favorites pf
     JOIN pois p ON p.id = pf.poi_id
     WHERE pf.user_id = ?1
     ORDER BY pf.favorited_at DESC, pf.id DESC`,
  ).bind(effectiveUserId).all();

  const enriched = (results ?? []).map((r) => {
    const { usages_json, ...rest } = r as Record<string, unknown> & { usages_json?: string };
    return { ...rest, usages: usages_json ? JSON.parse(usages_json) : [] };
  });

  return json(enriched);
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = (context.data as { auth?: AuthData }).auth ?? null;

  // 解析 body 第一步（要 companionRequestId 算 bucket key）。malformed body 直接 400。
  const body = await parseJsonBody<PoiFavoritePostBody>(context.request);

  // 預判 isClaimedCompanion：header + body.companionRequestId。
  // 真正的 gate 由 requireFavoriteActor 內部 resolveCompanionUserId 套（三 gate）。
  const headerScope = context.request.headers.get('X-Request-Scope');
  const claimedRequestId =
    typeof body.companionRequestId === 'number'
    && Number.isInteger(body.companionRequestId)
    && body.companionRequestId > 0
      ? body.companionRequestId
      : null;
  const isClaimedCompanion = headerScope === 'companion' && claimedRequestId !== null;

  // Rate limit (poi-favorites-rename §6.1 / §6.7 / D16)：
  //   - companion 一律 rate-limit（防 enumeration + 配合 companion_request_actions UNIQUE 雙重防護）
  //   - V2 user 非 admin → rate-limit；admin → bypass
  if (isClaimedCompanion) {
    const bucket = `poi-favorites-post:companion:${claimedRequestId}`;
    const bump = await bumpRateLimit(
      context.env.DB,
      bucket,
      RATE_LIMITS.POI_FAVORITES_WRITE,
    );
    if (!bump.ok) {
      return new Response(JSON.stringify({ error: 'RATE_LIMITED' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(bump.retryAfter ?? 60),
        },
      });
    }
  } else if (auth?.userId && !auth.isAdmin) {
    const bucket = `poi-favorites-post:user:${auth.userId}`;
    const bump = await bumpRateLimit(
      context.env.DB,
      bucket,
      RATE_LIMITS.POI_FAVORITES_WRITE,
    );
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

  // 真正解 effective userId。companion gate 失敗 → V2 user fallback；
  // V2 user fallback userId null → 拋 401。
  // 同時為 companion 模式寫 companion_request_actions（UNIQUE 衝突 → 409 COMPANION_QUOTA_EXCEEDED）。
  const actor = await requireFavoriteActor(context, body, 'favorite_create');

  // 驗 poiId（companion 與 V2 user 共用）
  if (!body.poiId || !Number.isInteger(body.poiId) || body.poiId <= 0) {
    throw new AppError('DATA_VALIDATION', '缺少或無效的 poiId');
  }

  // POI 是否存在
  const poi = await context.env.DB
    .prepare('SELECT id FROM pois WHERE id = ?')
    .bind(body.poiId)
    .first();
  if (!poi) throw new AppError('DATA_NOT_FOUND', 'POI 不存在');

  // INSERT poi_favorites
  let row: Record<string, unknown> | null = null;
  try {
    row = await context.env.DB
      .prepare(
        `INSERT INTO poi_favorites (user_id, poi_id, note) VALUES (?, ?, ?) RETURNING *`,
      )
      .bind(actor.userId, body.poiId, body.note ?? null)
      .first<Record<string, unknown>>();
    if (!row) throw new AppError('SYS_INTERNAL', 'INSERT RETURNING 未回傳資料');
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      throw new AppError('DATA_CONFLICT', '該 POI 已收藏');
    }
    throw err;
  }

  // companion 模式寫 audit_log（D5 sentinel）
  if (actor.isCompanion) {
    await context.env.DB
      .prepare(
        `INSERT INTO audit_log
           (trip_id, table_name, record_id, action, changed_by, request_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        actor.audit.tripId,
        'poi_favorites',
        row.id as number,
        'insert',
        actor.audit.changedBy,
        actor.requestId,
      )
      .run();
  }

  return json(row, 201);
};
