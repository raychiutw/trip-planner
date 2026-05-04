/**
 * Companion mapping helper — poi-favorites-rename §4
 *
 * 提供兩個函式給 4 個 poi-favorites endpoint 統一使用：
 *
 *   - resolveCompanionUserId(env, request, auth, requestId)
 *       純解析：跑 companion 三 gate（X-Request-Scope header / OAuth scopes /
 *       clientId）→ 若全過則 guarded UPDATE trip_requests SET status=processing
 *       WHERE id=? AND status='processing' RETURNING submitted_by → 對映 users.id。
 *       任一步失敗回 null + 寫 audit_log.companion_failure_reason；非 companion
 *       header 直接回 null（V2 user 路徑，不寫 audit）。
 *
 *   - requireFavoriteActor(context, body, action)
 *       高階 helper：先試 companion，成功則 INSERT companion_request_actions
 *       (requestId, action, poiId)（UNIQUE 衝突 → throw 409 COMPANION_QUOTA_EXCEEDED）。
 *       不成功且非 companion header 則 fallback V2 user。auth.userId 缺則 401。
 *       回 `{ userId, isCompanion, requestId, audit: { changedBy, tripId } }` 統一結構。
 *
 * Spec 對映：openspec/changes/poi-favorites-rename/specs/tp-companion-mapping/spec.md
 *
 * 失敗結構化 log（D10）：client 統一 401 `AUTH_REQUIRED`（fail-closed oracle 防護），
 * server 端透過 audit_log.companion_failure_reason 區分 root cause（dev 從 D1 query）。
 */
import { AppError } from './_errors';
import type { Env, AuthData } from './_types';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type FavoriteAction = 'favorite_create' | 'favorite_delete' | 'add_to_trip' | 'favorite_list';

/** companion_request_actions.action CHECK 限制 — favorite_list 不寫此 table（read-only） */
const ACTIONS_RECORDED: ReadonlySet<FavoriteAction> = new Set([
  'favorite_create',
  'favorite_delete',
  'add_to_trip',
]);

export type CompanionFailureReason =
  | 'invalid_request_id'
  | 'status_completed'
  | 'submitter_unknown'
  | 'self_reported_scope'
  | 'client_unauthorized'
  | 'quota_exceeded';

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
  if (
    requestId === null
    || typeof requestId !== 'number'
    || !Number.isInteger(requestId)
    || requestId <= 0
  ) {
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
        changedBy: `companion:${companion.requestId}`,
        tripId: 'system:companion',
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
// Internal — failure audit log
// --------------------------------------------------------------------------

/**
 * companion path 失敗時統一 server-side log。Client 維持 401 + uniform
 * message（fail-closed oracle 防護），dev 透過 D1 query 此 table 區分根因。
 *
 * audit_log.action 受 CHECK 限制 ('insert'/'update'/'delete')，failure log
 * 用 'insert' 作 sentinel（代表「嘗試新增/操作但 fail-closed」）。
 */
async function writeFailureAudit(
  env: Env,
  requestId: number | null,
  reason: CompanionFailureReason,
): Promise<void> {
  await env.DB
    .prepare(
      `INSERT INTO audit_log
         (trip_id, table_name, action, changed_by, request_id, companion_failure_reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      'system:companion',
      'poi_favorites',
      'insert',
      `companion:${requestId ?? 'unknown'}`,
      requestId,
      reason,
    )
    .run();
}
