import { requireAuth } from '../_auth';
import { AppError } from '../_errors';
import { mobileOAuthContract } from '../_mobileOAuth';
import { requireSessionUser } from '../_session';
import type { Env } from '../_types';

type Context = Parameters<PagesFunction<Env>>[0];

export function requireMobileAccountActor(context: Context): { uid: string; grantId: string; clientId: string } {
  const auth = requireAuth(context);
  const contract = mobileOAuthContract(context.env, context.request);
  if (!contract || auth.isServiceToken || auth.clientId !== contract.clientId || !auth.userId || !auth.grantId || auth.restrictTrip) {
    throw new AppError('PERM_DENIED');
  }
  return { uid: auth.userId, grantId: auth.grantId, clientId: auth.clientId };
}

export async function requireAccountActor(context: Context): Promise<{ uid: string; grantId?: string; clientId?: string }> {
  // 看 middleware 實際認證出來的身分，不是看有沒有 Authorization 標頭：
  // middleware 以 session cookie 優先，同時帶 cookie 與 Bearer 時 auth 來自 cookie（沒有 grantId），
  // 照標頭判斷會把已登入的瀏覽器使用者誤導去 mobile 路徑而拒絕。
  const auth = (context.data as { auth?: { grantId?: string } } | undefined)?.auth;
  return auth?.grantId
    ? requireMobileAccountActor(context)
    : { uid: (await requireSessionUser(context.request, context.env)).uid };
}
