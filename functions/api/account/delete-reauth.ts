import { requireAuth } from '../_auth';
import { AppError } from '../_errors';
import { getPublicOrigin, rawJson } from '../_utils';
import { mobileOAuthContract } from '../_mobileOAuth';
import { createMobileDeleteChallenge, mobileCallbackUrl, readMobileDeleteChallenge, transitionMobileDeleteChallenge } from './_deleteReauth';
import type { Env } from '../_types';

type Context = Parameters<PagesFunction<Env>>[0];

function mobileActor(context: Context): { uid: string; grantId: string; clientId: string } {
  const auth = requireAuth(context);
  const contract = mobileOAuthContract(context.env, context.request);
  if (!contract || auth.isServiceToken || auth.clientId !== contract.clientId || !auth.userId || !auth.grantId || auth.restrictTrip) {
    throw new AppError('PERM_DENIED');
  }
  return { uid: auth.userId, grantId: auth.grantId, clientId: auth.clientId };
}

async function ownedChallenge(context: Context) {
  const actor = mobileActor(context);
  const id = new URL(context.request.url).searchParams.get('challenge_id');
  if (!id) throw new AppError('DATA_VALIDATION', 'challenge_id 必填');
  const challenge = await readMobileDeleteChallenge(context.env.DB, id);
  if (!challenge || challenge.uid !== actor.uid || challenge.grantId !== actor.grantId || challenge.clientId !== actor.clientId) {
    throw new AppError('DATA_NOT_FOUND');
  }
  return { id, challenge, actor };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const actor = mobileActor(context);
  if (mobileCallbackUrl(context.env).toString() !== mobileOAuthContract(context.env, context.request)?.redirectUri) {
    throw new AppError('SERVER_MISCONFIG', 'Mobile OAuth callback 與環境不符');
  }
  const identity = await context.env.DB.prepare("SELECT 1 FROM auth_identities WHERE user_id = ? AND provider = 'google'")
    .bind(actor.uid).first();
  if (!identity) throw new AppError('ACCOUNT_DELETE_REAUTH_REQUIRED', '此帳號沒有可用的重新驗證方式');
  const challengeId = await createMobileDeleteChallenge(context.env.DB, actor.uid, actor.grantId, actor.clientId);
  const authorizeUrl = new URL('/api/oauth/login/google', getPublicOrigin(context.env, context.request));
  authorizeUrl.searchParams.set('purpose', 'account-delete');
  authorizeUrl.searchParams.set('challenge', challengeId);
  const response = rawJson({ challengeId, authorizeUrl: authorizeUrl.toString(), expiresIn: 300 });
  response.headers.set('Cache-Control', 'no-store');
  return response;
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { challenge } = await ownedChallenge(context);
  const response = rawJson({ status: challenge.expired ? 'expired' : challenge.status, expiresIn: challenge.expired ? 0 : undefined });
  response.headers.set('Cache-Control', 'no-store');
  return response;
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { id, challenge, actor } = await ownedChallenge(context);
  if (challenge.status === 'used') throw new AppError('DATA_CONFLICT', '驗證已使用');
  if (challenge.expired) throw new AppError('ACCOUNT_DELETE_REAUTH_REQUIRED', '驗證已過期');
  if (challenge.status !== 'cancelled') {
    let cancelled = false;
    for (const status of ['pending', 'started', 'verified'] as const) {
      cancelled ||= await transitionMobileDeleteChallenge(context.env.DB, id, actor.uid, actor.grantId, status, 'cancelled');
    }
    if (!cancelled) throw new AppError('DATA_CONFLICT', '驗證狀態已變更');
  }
  return rawJson({ status: 'cancelled' });
};
