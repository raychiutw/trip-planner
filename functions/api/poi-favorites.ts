/**
 * GET  /api/poi-favorites            — 列出當前使用者的 POI 收藏（JOIN pois + usages）
 * POST /api/poi-favorites { poiId, note?, companionRequestId? } — 新增收藏
 *
 * Companion path: see functions/api/_companion.ts (requireFavoriteActor +
 * pickFavoriteBucketForActor). 所有寫入皆限流（Phase 3：無 admin 豁免）。
 *
 * v2.33.105 SEC-2: pre-gate per-IP throttle 在 actor resolve 之前；post-gate
 * bucket 用 resolved actor 而非 claimed body 防 bucket-spoof DoS。
 */
import { AppError } from './_errors';
import { buildRateLimitResponse } from './_errors';
import { logAudit } from './_audit';
import { json, parseJsonBody } from './_utils';
import { bumpRateLimit, RATE_LIMITS } from './_rate_limit';
import {
  pickFavoriteBucketForActor,
  preGateFavoriteThrottle,
  requireFavoriteActor,
} from './_companion';
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
    // v2.33.105 SEC-2: pre-gate per-IP throttle 防 actor resolve DB hammering
    const preGate = await preGateFavoriteThrottle(context.env, context.request);
    if (preGate) return preGate;
    const actor = await requireFavoriteActor(context, null, 'favorite_list');
    effectiveUserId = actor.userId;
  } else if (auth?.userId) {
    effectiveUserId = auth.userId;
  } else {
    return json([]); // anonymous / service-token without resolution → empty
  }

  const { results } = await context.env.DB.prepare(
    // v2.31.17: 補 p.rating 進 SELECT，讓 AddStopPage / ChangePoiPage favorites
    // card 可以顯 ★ N.N（之前是孤兒 star icon 拔掉，現在 backend 有 data 可補回）。
    `SELECT pf.id, pf.user_id, pf.poi_id, pf.favorited_at, pf.note,
            p.name AS poi_name, p.address AS poi_address,
            p.lat AS poi_lat, p.lng AS poi_lng, p.type AS poi_type,
            p.rating AS poi_rating,
            COALESCE(
              (SELECT json_group_array(json_object(
                  'tripId', usage.trip_id,
                  'tripName', usage.trip_name,
                  'dayNum', usage.day_num,
                  'dayDate', usage.day_date,
                  'entryId', usage.entry_id
                ))
                FROM (
                  SELECT t.id AS trip_id, t.name AS trip_name, td.day_num, td.date AS day_date, e.id AS entry_id
                  FROM trip_entry_pois tep
                  JOIN trip_entries e ON e.id = tep.entry_id
                  JOIN trip_days td ON td.id = e.day_id
                  JOIN trips t ON t.id = td.trip_id
                  WHERE tep.poi_id = pf.poi_id
                    AND (
                      t.owner_user_id = ?1
                      OR EXISTS (
                        SELECT 1 FROM trip_permissions perm
                        WHERE perm.trip_id = t.id AND perm.user_id = ?1
                      )
                    )
                  UNION
                  -- v2.29.0: trip_pois DROPPED. Hotel usage 從 trip_days.hotel_poi_id 取。
                  SELECT t.id AS trip_id, t.name AS trip_name, td.day_num, td.date AS day_date, NULL AS entry_id
                  FROM trip_days td
                  JOIN trips t ON t.id = td.trip_id
                  WHERE td.hotel_poi_id = pf.poi_id
                    AND (
                      t.owner_user_id = ?1
                      OR EXISTS (
                        SELECT 1 FROM trip_permissions perm
                        WHERE perm.trip_id = t.id AND perm.user_id = ?1
                      )
                    )
                ) usage
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

  // v2.33.105 SEC-2: pre-gate per-IP throttle 在 actor resolve 之前。寬鬆
  // 200/5min/IP，正常 user 不會打中；攻擊者 hammer 才會觸 lock。
  const preGate = await preGateFavoriteThrottle(context.env, context.request);
  if (preGate) return preGate;

  // 解析 body。malformed body 直接 400。
  const body = await parseJsonBody<PoiFavoritePostBody>(context.request);

  // 先驗 poiId 早 reject 不浪費 actor resolve（companion 與 V2 user 共用）
  if (!body.poiId || !Number.isInteger(body.poiId) || body.poiId <= 0) {
    throw new AppError('DATA_VALIDATION', '缺少或無效的 poiId');
  }

  // 真正解 effective userId。companion gate 失敗 → V2 user fallback；
  // V2 user fallback userId null → 拋 401。
  // 同時為 companion 模式寫 companion_request_actions（UNIQUE 衝突 → 409 COMPANION_QUOTA_EXCEEDED）。
  const actor = await requireFavoriteActor(context, body, 'favorite_create');

  // v2.33.105 SEC-2: post-gate bucket 用 RESOLVED actor，而非 claimed body。
  // Phase 3（移除全域 admin）：無 admin rate-limit 豁免，所有寫入皆限流。
  const bucket = pickFavoriteBucketForActor(actor, 'poi-favorites-post');
  const bump = await bumpRateLimit(context.env.DB, bucket, RATE_LIMITS.POI_FAVORITES_WRITE);
  if (!bump.ok) return buildRateLimitResponse(bump.retryAfter ?? 60, { error: 'RATE_LIMITED' });

  // INSERT poi_favorites — FK 失敗（POI 不存在）轉 404；UNIQUE 違反 → 409
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
    if (err instanceof Error) {
      if (err.message.includes('UNIQUE')) throw new AppError('DATA_CONFLICT', '該 POI 已收藏');
      if (err.message.includes('FOREIGN KEY')) throw new AppError('DATA_NOT_FOUND', 'POI 不存在');
    }
    throw err;
  }

  // companion 模式寫 audit_log（D5 sentinel）— fire-and-forget 不阻塞 response
  if (actor.isCompanion) {
    context.waitUntil(
      logAudit(context.env.DB, {
        tripId: actor.audit.tripId,
        tableName: 'poi_favorites',
        recordId: row.id as number,
        action: 'insert',
        changedBy: actor.audit.changedBy,
        requestId: actor.requestId,
      }),
    );
  }

  return json(row, 201);
};
