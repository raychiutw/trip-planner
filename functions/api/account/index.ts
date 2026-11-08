/**
 * GET    /api/account — 刪除前的影響預覽（確認對話框要用）
 * DELETE /api/account — 刪除自己的帳號
 *
 * Google Play 對「可建立帳號的 app」**強制要求**帳號刪除路徑，且要求 app 內與網頁
 * 各有一條。這支是兩條路徑共用的後端。
 *
 * Auth：瀏覽器 session，或與環境相符的 mobile OAuth grant
 *
 * Body: { password: string } — 二次確認只走密碼（ADR-0009 已被取代，Google 重新驗證已移除，#1643）。
 *   沒有 local 密碼身分的帳號 fail-closed：一律 403 ACCOUNT_DELETE_REAUTH_REQUIRED，資料不動。
 *
 * Response 200: { ok: true, tripsDeleted, auditRowsAnonymized, tablesCleared }
 *   瀏覽器回應同時清除 session cookie；OAuth token 由 erasure 一併撤銷。
 *
 * ⚠ 這是**不可逆**操作。二次確認不是形式：owner 決策為「擁有的行程一併刪除，
 *   含共編者的」，誤觸的代價是別人的資料也沒了。
 *
 * ⚠ 實際抹除邏輯在 `_erasure.ts`（單一 D1 batch 顯式刪除）。
 *   本檔只負責驗證與回應，不重複實作刪除順序。
 */
import { buildClearSessionSetCookie } from '../_cookies';
import { AppError } from '../_errors';
import { rawJson } from '../_utils';
import { verifyPassword } from '../../../src/server/password';
import { eraseUserAccount } from '../_erasure';
import { requireAccountActor } from './_accountActor';
import type { Env } from '../_types';

interface DeleteAccountBody {
  password?: unknown;
}

/** 該帳號有沒有 local 密碼身分。GET 與 DELETE 共用，避免兩處判斷漂移。 */
async function findLocalPasswordHash(env: Env, userId: string): Promise<string | null> {
  const row = await env.DB
    .prepare(
      `SELECT password_hash FROM auth_identities
        WHERE user_id = ? AND provider = 'local' AND password_hash IS NOT NULL`,
    )
    .bind(userId)
    .first<{ password_hash: string }>();
  return row?.password_hash ?? null;
}

/**
 * GET /api/account — 刪除影響預覽。
 *
 * 確認對話框必須誠實顯示「按下去會發生什麼」。owner 決策是**行程一併刪除，含共編者的**，
 * 所以受影響的共編人數一定要先讓使用者看到 —— 這個數字前端算不出來，只能後端查。
 *
 * Response: { hasPassword, tripsOwned, collaboratorsAffected }
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const actor = await requireAccountActor(context);
  const userId = actor.uid;

  const hasPassword = (await findLocalPasswordHash(context.env, userId)) !== null;

  const owned = await context.env.DB
    .prepare('SELECT count(*) AS n FROM trips WHERE owner_user_id = ?')
    .bind(userId)
    .first<{ n: number }>();

  // 受影響的共編者 = 這些行程上「不是自己」的 distinct user。
  // DISTINCT 是必要的：同一人可能出現在多個行程，不能重複計數。
  const collab = await context.env.DB
    .prepare(
      `SELECT count(DISTINCT tp.user_id) AS n
         FROM trip_permissions tp
         JOIN trips t ON t.id = tp.trip_id
        WHERE t.owner_user_id = ? AND tp.user_id != ?`,
    )
    .bind(userId, userId)
    .first<{ n: number }>();

  return rawJson({
    hasPassword,
    tripsOwned: owned?.n ?? 0,
    collaboratorsAffected: collab?.n ?? 0,
  });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const actor = await requireAccountActor(context);
  const userId = actor.uid;

  let body: DeleteAccountBody = {};
  try {
    body = (await context.request.json()) as DeleteAccountBody;
  } catch {
    // 空 body / 非 JSON —— 當作沒帶確認，交給下方統一擋。
  }

  const passwordHash = await findLocalPasswordHash(context.env, userId);

  // 只走密碼確認；沒有密碼身分一律拒絕（fail-closed）。這是不可逆操作，不接受只按按鈕或只送確認字串。
  if (!passwordHash) {
    throw new AppError('ACCOUNT_DELETE_REAUTH_REQUIRED', '此帳號沒有設定密碼，無法刪除帳號');
  }
  if (typeof body.password !== 'string' || body.password.length === 0) {
    throw new AppError('ACCOUNT_DELETE_CONFIRM_REQUIRED', '請輸入密碼以確認刪除');
  }
  // ⚠ 密碼錯時**不得**動到任何資料 —— 在呼叫 eraseUserAccount 之前就返回。
  if (!(await verifyPassword(body.password, passwordHash))) {
    throw new AppError('ACCOUNT_DELETE_PASSWORD_INVALID');
  }

  const summary = await eraseUserAccount(context.env.DB, userId);

  const res = rawJson({
    ok: true,
    tripsDeleted: summary.tripsDeleted,
    auditRowsAnonymized: summary.auditRowsAnonymized,
    tablesCleared: summary.tablesCleared,
  });
  // 帳號已不存在，手上的 cookie 不該還能用。
  res.headers.append('Set-Cookie', buildClearSessionSetCookie());
  return res;
};
