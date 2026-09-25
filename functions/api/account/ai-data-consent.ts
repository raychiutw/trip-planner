import { aiDataConsentStatus, decideAiDataConsent } from '../_aiDataConsent';
import { AppError } from '../_errors';
import { rawJson } from '../_utils';
import { requireAccountActor } from './_accountActor';
import type { Env } from '../_types';

type Body = { version?: unknown; decision?: unknown; requestId?: unknown };

async function respond(context: Parameters<PagesFunction<Env>>[0]) {
  const actor = await requireAccountActor(context);
  const response = rawJson(await aiDataConsentStatus(context.env.DB, actor.uid));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

async function decide(context: Parameters<PagesFunction<Env>>[0], expected?: 'revoke') {
  const actor = await requireAccountActor(context);
  let body: Body;
  try { body = await context.request.json() as Body; }
  catch { throw new AppError('DATA_VALIDATION', '請提交版本、決定與 requestId'); }
  const decision = expected ?? body.decision;
  if (typeof body.version !== 'string' || !body.version ||
      typeof body.requestId !== 'string' ||
      (decision !== 'accept' && decision !== 'decline' && decision !== 'revoke') ||
      (!expected && decision === 'revoke') ||
      (expected && body.decision !== undefined && body.decision !== expected)) {
    throw new AppError('DATA_VALIDATION', '版本、決定或 requestId 無效');
  }
  await decideAiDataConsent(context.env.DB, actor.uid, body.version, decision, body.requestId);
  return respond(context);
}

export const onRequestGet: PagesFunction<Env> = respond;
export const onRequestPost: PagesFunction<Env> = (context) => decide(context);
export const onRequestDelete: PagesFunction<Env> = (context) => decide(context, 'revoke');
