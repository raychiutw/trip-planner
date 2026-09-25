/**
 * GET    /api/account — 刪除前的影響預覽（確認對話框要用）
 * DELETE /api/account — 刪除自己的帳號
 *
 * Google Play 對「可建立帳號的 app」**強制要求**帳號刪除路徑，且要求 app 內與網頁
 * 各有一條。這支是兩條路徑共用的後端。
 *
 * Auth: requireSessionUser
 *
 * Body（擇一）:
 *   { password: string }  — 帳號有 local 密碼身分時**必須**帶，做二次確認
 *   { confirm: 'DELETE' } — 純 OAuth 帳號（無 password_hash）沒有密碼可打，改用確認字串
 *
 * Response 200: { ok: true, tripsDeleted, auditRowsAnonymized, tablesCleared }
 *   同時回 Set-Cookie 清除 session —— 帳號都沒了，cookie 不該還能用。
 *
 * ⚠ 這是**不可逆**操作。二次確認不是形式：owner 決策為「擁有的行程一併刪除，
 *   含共編者的」，誤觸的代價是別人的資料也沒了。
 *
 * ⚠ 實際抹除邏輯在 `_erasure.ts`（逐表顯式刪除，不依賴 CASCADE）。
 *   本檔只負責驗證與回應，不重複實作刪除順序。
 */
import { requireSessionUser } from '../_session';
import { requireAuth } from '../_auth';
import { mobileOAuthContract } from '../_mobileOAuth';
import { buildClearSessionSetCookie } from '../_cookies';
import { AppError } from '../_errors';
import { rawJson } from '../_utils';
import { verifyPassword } from '../../../src/server/password';
import { eraseUserAccount } from '../_erasure';
import { consumeDeleteReauth, hasDeleteReauth, readMobileDeleteChallenge, transitionMobileDeleteChallenge } from './_deleteReauth';
import type { Env } from '../_types';

interface DeleteAccountBody {
  password?: unknown;
  confirm?: unknown;
  challengeId?: unknown;
}

/** 純 OAuth 帳號用的確認字串。刻意用英文大寫，避免輸入法誤觸。 */
const CONFIRM_PHRASE = 'DELETE';

async function requireAccountUser(context: Parameters<PagesFunction<Env>>[0]): Promise<{ uid: string; grantId?: string }> {
  if (context.request.headers.get('Authorization')?.startsWith('Bearer ')) {
    const auth = requireAuth(context);
    const contract = mobileOAuthContract(context.env, context.request);
    if (!contract || auth.isServiceToken || auth.clientId !== contract.clientId || !auth.userId || !auth.grantId || auth.restrictTrip) {
      throw new AppError('PERM_DENIED');
    }
    return { uid: auth.userId, grantId: auth.grantId };
  }
  return { uid: (await requireSessionUser(context.request, context.env)).uid };
}

/**
 * 該帳號有沒有 local 密碼身分 —— 決定二次確認要用密碼還是確認字串。
 * GET 與 DELETE 共用，避免兩處判斷漂移。
 */
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
  const actor = await requireAccountUser(context);
  const userId = actor.uid;

  const hasPassword = (await findLocalPasswordHash(context.env, userId)) !== null;
  const googleIdentity = hasPassword ? null : await context.env.DB.prepare("SELECT 1 FROM auth_identities WHERE user_id = ? AND provider = 'google'")
    .bind(userId).first();
  const reauthenticated = hasPassword || actor.grantId ? false : await hasDeleteReauth(context.env.DB, context.request, userId);

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
    reauthProvider: googleIdentity ? 'google' : null,
    reauthenticated,
    tripsOwned: owned?.n ?? 0,
    collaboratorsAffected: collab?.n ?? 0,
  });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const actor = await requireAccountUser(context);
  const userId = actor.uid;

  let body: DeleteAccountBody = {};
  try {
    body = (await context.request.json()) as DeleteAccountBody;
  } catch {
    // 空 body / 非 JSON —— 當作沒帶確認，交給下方統一擋。
  }

  // 這個帳號有沒有 local 密碼身分？決定二次確認要用哪種方式。
  const passwordHash = await findLocalPasswordHash(context.env, userId);

  if (passwordHash) {
    // 有密碼 → 必須用密碼確認。這是不可逆操作，不接受只按按鈕。
    if (typeof body.password !== 'string' || body.password.length === 0) {
      throw new AppError('ACCOUNT_DELETE_CONFIRM_REQUIRED', '請輸入密碼以確認刪除');
    }
    const ok = await verifyPassword(body.password, passwordHash);
    if (!ok) {
      // ⚠ 密碼錯時**不得**動到任何資料 —— 在呼叫 eraseUserAccount 之前就返回。
      throw new AppError('ACCOUNT_DELETE_PASSWORD_INVALID');
    }
  } else {
    // 顯式確認防誤觸；近期 Google 身分驗證才是刪除授權。
    if (body.confirm !== CONFIRM_PHRASE) {
      throw new AppError(
        'ACCOUNT_DELETE_CONFIRM_REQUIRED',
        `請輸入 ${CONFIRM_PHRASE} 以確認刪除`,
      );
    }
    if (actor.grantId) {
      const challengeId = typeof body.challengeId === 'string' ? body.challengeId : '';
      const challenge = challengeId ? await readMobileDeleteChallenge(context.env.DB, challengeId) : null;
      if (!challenge || challenge.uid !== userId || challenge.grantId !== actor.grantId ||
          challenge.clientId !== mobileOAuthContract(context.env, context.request)?.clientId || challenge.expired ||
          !(await transitionMobileDeleteChallenge(context.env.DB, challengeId, userId, actor.grantId, 'verified', 'used'))) {
        throw new AppError('ACCOUNT_DELETE_REAUTH_REQUIRED');
      }
    } else if (!(await consumeDeleteReauth(context.env.DB, context.request, userId))) {
      throw new AppError('ACCOUNT_DELETE_REAUTH_REQUIRED');
    }
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
