/**
 * Companion mapping helper — poi-favorites-rename §4.
 *
 * Spec: openspec/changes/poi-favorites-rename/specs/tp-companion-mapping/spec.md
 *
 * Failure path is fail-closed: client always sees 401 `AUTH_REQUIRED`; the
 * specific reason lives in audit_log.companion_failure_reason so prod can
 * distinguish root cause without leaking gate semantics to attackers.
 */
import { AppError } from './_errors';
import { logAudit, type CompanionFailureReason } from './_audit';
import type { Env, AuthData } from './_types';

// --------------------------------------------------------------------------
// Types + Sentinels
// --------------------------------------------------------------------------

export type FavoriteAction = 'favorite_create' | 'favorite_delete' | 'add_to_trip' | 'favorite_list';

/** companion_request_actions.action CHECK 限制 — favorite_list 不寫此 table（read-only） */
const ACTIONS_RECORDED: ReadonlySet<FavoriteAction> = new Set([
  'favorite_create',
  'favorite_delete',
  'add_to_trip',
]);

export type { CompanionFailureReason };

/** audit_log.trip_id sentinel for companion-path writes (D5) */
export const COMPANION_AUDIT_TRIP_ID = 'system:companion';

/** audit_log.changed_by builder for companion-path writes */
export const companionChangedBy = (requestId: number | string | null): string =>
  `companion:${requestId ?? 'unknown'}`;

export interface FavoriteActor {
  /** Effective user_id：companion 模式為 trip_requests.submitted_by 對映之 users.id；V2 user 為 auth.userId */
  userId: string;
  /** companion 模式為 true，V2 user 模式為 false */
  isCompanion: boolean;
  /** companion 模式攜帶 trip_requests.id；V2 user 為 null */
  requestId: number | null;
  /** audit_log INSERT 用的兩個 sentinel 字串 */
  audit: {
    changedBy: string;
    tripId: string;
  };
}

interface FavoriteBody {
  companionRequestId?: unknown;
  poiId?: unknown;
}

// --------------------------------------------------------------------------
// resolveCompanionUserId — pure auth resolver
// --------------------------------------------------------------------------

/**
 * 解析 companion 模式的 effective user_id。三 gate 全過 + valid requestId +
 * status=processing + submitter 對映 users 才回成功；否則回 null。
 *
 * @param requestId  body.companionRequestId 或 query string ?companionRequestId=N
 *                   解析後傳入；helper 內部會驗 type 與正整數性質。
 */
export async function resolveCompanionUserId(
  env: Env,
  request: Request,
  auth: AuthData | null,
  requestId: number | null,
): Promise<{ userId: string; requestId: number } | null> {
  const scopeHeader = request.headers.get('X-Request-Scope');

  // Case B: scope ≠ companion → V2 user 路徑，不寫 audit
  if (scopeHeader !== 'companion') return null;

  // Case C: scopes 不含 companion（self-reported header without OAuth gate）
  if (!auth?.scopes?.includes('companion')) {
    await writeFailureAudit(env, requestId, 'self_reported_scope');
    return null;
  }

  // Case D: clientId ≠ TP_REQUEST_CLIENT_ID
  const expectedClientId = env.TP_REQUEST_CLIENT_ID;
  if (!expectedClientId || auth.clientId !== expectedClientId) {
    await writeFailureAudit(env, requestId, 'client_unauthorized');
    return null;
  }

  // Case E/G: requestId 型別錯誤（null / 非整數 / 非正數）
  if (requestId === null || !Number.isInteger(requestId) || requestId <= 0) {
    await writeFailureAudit(env, requestId, 'invalid_request_id');
    return null;
  }

  // Guarded claim：UPDATE atomic 取走 processing row（防 TOCTOU race，case I）
  const claimed = await env.DB
    .prepare(
      `UPDATE trip_requests SET status = 'processing'
       WHERE id = ? AND status = 'processing'
       RETURNING submitted_by`,
    )
    .bind(requestId)
    .first<{ submitted_by: string | null }>();

  if (!claimed) {
    // 0 rows updated：(1) row 不存在 OR (2) status 不是 processing
    // 用一次補充 SELECT 區分（best-effort，race 不影響 fail-closed 行為）
    const exists = await env.DB
      .prepare('SELECT id FROM trip_requests WHERE id = ?')
      .bind(requestId)
      .first<{ id: number }>();
    const reason: CompanionFailureReason = exists ? 'status_completed' : 'invalid_request_id';
    await writeFailureAudit(env, requestId, reason);
    return null;
  }

  // Case H: submitted_by 為 null
  if (!claimed.submitted_by) {
    await writeFailureAudit(env, requestId, 'submitter_unknown');
    return null;
  }

  // 對映 users.id（email LOWER 比對）
  const user = await env.DB
    .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1')
    .bind(claimed.submitted_by)
    .first<{ id: string }>();

  if (!user?.id) {
    await writeFailureAudit(env, requestId, 'submitter_unknown');
    return null;
  }

  return { userId: user.id, requestId };
}

// --------------------------------------------------------------------------
// requireFavoriteActor — high-level helper for 4 endpoints
// --------------------------------------------------------------------------

/**
 * 4 個 poi-favorites endpoint 統一進入點。先試 companion 解析；成功則寫
 * companion_request_actions（UNIQUE 衝突 → 409）；不成功則 fallback V2 user
 * （auth.userId 缺 → 401）。
 *
 * @param body GET 路徑 body 為 null，helper 從 query string `?companionRequestId=N`
 *             取 requestId；POST/DELETE/PATCH 從 body.companionRequestId 取。
 * @param action 'favorite_list' 不寫 companion_request_actions（read-only）；其他三個
 *               寫一筆，第二次同 (requestId, action) 撞 UNIQUE → 409。
 */
export async function requireFavoriteActor(
  context: EventContext<Env, string, Record<string, unknown>>,
  body: FavoriteBody | null,
  action: FavoriteAction,
): Promise<FavoriteActor> {
  const auth = ((context.data as Record<string, unknown>).auth ?? null) as AuthData | null;

  // 解析 requestId 來源：body.companionRequestId（POST/DELETE/PATCH）或
  // URL query string（GET）
  let requestId: number | null = null;
  if (body && typeof body.companionRequestId === 'number') {
    requestId = body.companionRequestId;
  } else if (!body) {
    const url = new URL(context.request.url);
    const qs = url.searchParams.get('companionRequestId');
    if (qs && /^-?\d+$/.test(qs)) {
      requestId = Number.parseInt(qs, 10);
    }
  }

  // 試 companion 路徑
  const companion = await resolveCompanionUserId(context.env, context.request, auth, requestId);

  if (companion) {
    // 成功 → 寫 companion_request_actions（UNIQUE 衝突視為 quota）
    if (ACTIONS_RECORDED.has(action)) {
      const poiId = typeof body?.poiId === 'number' ? body.poiId : null;
      try {
        await context.env.DB
          .prepare(
            'INSERT INTO companion_request_actions (request_id, action, poi_id) VALUES (?, ?, ?)',
          )
          .bind(companion.requestId, action, poiId)
          .run();
      } catch (err) {
        if (err instanceof Error && /UNIQUE/i.test(err.message)) {
          await writeFailureAudit(context.env, companion.requestId, 'quota_exceeded');
          throw new AppError('COMPANION_QUOTA_EXCEEDED', '同 request 同 action 不可重複執行');
        }
        throw err;
      }
    }
    return {
      userId: companion.userId,
      isCompanion: true,
      requestId: companion.requestId,
      audit: {
        changedBy: companionChangedBy(companion.requestId),
        tripId: COMPANION_AUDIT_TRIP_ID,
      },
    };
  }

  // 不是 companion 路徑 → fallback V2 user
  if (!auth?.userId) {
    throw new AppError('AUTH_REQUIRED', '需 V2 OAuth 登入才能操作收藏');
  }

  return {
    userId: auth.userId,
    isCompanion: false,
    requestId: null,
    audit: {
      changedBy: auth.email,
      tripId: 'user',
    },
  };
}

// --------------------------------------------------------------------------
// Shared rate-limit + ownership helpers (4 endpoints)
// --------------------------------------------------------------------------

/**
 * Bucket key picker for poi-favorites write endpoints.
 *
 * Companion (header + valid claimed requestId) is always rate-limited even when
 * the underlying service token has admin scope — companion path lives behind
 * separate enumeration / abuse boundary. V2 user is bypassed only for admin.
 *
 * Returns null when no bucket should apply (admin V2 user, or unauthenticated
 * caller — gate will reject downstream).
 */
export function pickFavoriteRateLimitBucket(
  request: Request,
  body: { companionRequestId?: unknown },
  prefix: string,
  auth: AuthData | null,
): string | null {
  const headerScope = request.headers.get('X-Request-Scope');
  const claimedRequestId =
    typeof body.companionRequestId === 'number'
      && Number.isInteger(body.companionRequestId)
      && body.companionRequestId > 0
      ? body.companionRequestId
      : null;
  if (headerScope === 'companion' && claimedRequestId !== null) {
    return `${prefix}:companion:${claimedRequestId}`;
  }
  if (auth?.userId && !auth.isAdmin) {
    return `${prefix}:user:${auth.userId}`;
  }
  return null;
}

/**
 * Ownership gate shared by DELETE / add-to-trip handlers.
 *
 * Companion path is strict: even when the service token carries admin scope it
 * cannot bypass `actor.userId === ownerUserId`. V2 user admin bypasses.
 */
export function assertFavoriteOwnership(
  actor: FavoriteActor,
  auth: AuthData | null,
  ownerUserId: string | null,
  detail?: string,
): void {
  const ownByUid = ownerUserId === actor.userId;
  const adminBypass = !actor.isCompanion && auth?.isAdmin === true;
  if (!ownByUid && !adminBypass) {
    throw new AppError('PERM_DENIED', detail);
  }
}

// --------------------------------------------------------------------------
// Internal — failure audit log
// --------------------------------------------------------------------------

/**
 * companion path 失敗時統一 server-side log。透過 logAudit() 共用 detectGarbledText
 * + 非 fatal try/catch（簡化原因細節塞 diff_json 是合法 fallback；本欄位 columns 1st-class）。
 * audit_log.action 受 CHECK 限制 ('insert'/'update'/'delete')，failure log 用 'insert'
 * 作 sentinel（代表「嘗試新增/操作但 fail-closed」）。
 */
async function writeFailureAudit(
  env: Env,
  requestId: number | null,
  reason: CompanionFailureReason,
): Promise<void> {
  await logAudit(env.DB, {
    tripId: COMPANION_AUDIT_TRIP_ID,
    tableName: 'poi_favorites',
    recordId: null,
    action: 'insert',
    changedBy: companionChangedBy(requestId),
    requestId,
    companionFailureReason: reason,
  });
}
