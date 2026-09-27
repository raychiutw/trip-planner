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
  return context.request.headers.get('Authorization')?.startsWith('Bearer ')
    ? requireMobileAccountActor(context)
    : { uid: (await requireSessionUser(context.request, context.env)).uid };
}
