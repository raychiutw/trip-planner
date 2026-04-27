/**
 * POST /api/oauth/consent
 *
 * V2-P5 — Record user consent for client_id + scopes，then redirect back to
 * /api/oauth/authorize（this time will skip consent check + issue code）。
 *
 * Body (form-urlencoded or JSON):
 *   client_id
 *   redirect_uri
 *   scope (space-separated)
 *   state
 *   response_type
 *   code_challenge?
 *   code_challenge_method?
 *   decision: 'allow' | 'deny'
 *
 * Auth required (session)。
 *
 * Behavior:
 *   - decision='allow' + session: store Consent in D1 oauth_models + 302 to
 *     /api/oauth/authorize?... (authorize 下次跑時 see consent + issue code)
 *   - decision='deny' + redirect_uri: 302 to redirect_uri?error=access_denied&state=
 *   - No session: 302 to /login?redirect_after=...
 */
import { D1Adapter } from '../../../src/server/oauth-d1-adapter';
import { getSessionUser } from '../_session';
import { recordAuthEvent } from '../_auth_audit';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../_types';

const CONSENT_TTL_SEC = 365 * 24 * 60 * 60; // 1 year — user manually revokes via 帳號設定

interface ConsentBody {
  client_id?: string;
  redirect_uri?: string;
  scope?: string;
  state?: string;
  response_type?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  decision?: string;
}

async function parseBody(request: Request): Promise<ConsentBody> {
  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    const out: ConsentBody = {};
    for (const [k, v] of params) (out as Record<string, string>)[k] = v;
    return out;
  }
  if (ct.includes('application/json')) {
    return (await request.json()) as ConsentBody;
  }
  return {};
}

/**
 * Lookup client + verify redirect_uri is in the client's exact-match allowlist.
 * Prevents open redirect (attacker-supplied redirect_uri spoofing the deny path).
 */
async function isAllowedRedirectUri(
  db: D1Database,
  clientId: string,
  redirectUri: string,
): Promise<boolean> {
  const row = await db
    .prepare('SELECT redirect_uris FROM client_apps WHERE client_id = ? AND status = ?')
    .bind(clientId, 'active')
    .first<{ redirect_uris: string }>();
  if (!row) return false;
  try {
    const parsed: unknown = JSON.parse(row.redirect_uris);
    if (!Array.isArray(parsed)) return false;
    return parsed.some((x) => typeof x === 'string' && x === redirectUri);
  } catch {
    return false;
  }
}

async function safeRedirect(
  db: D1Database,
  clientId: string | undefined,
  redirectUri: string | undefined,
  errorCode: string,
  state?: string,
): Promise<Response> {
  if (!clientId || !redirectUri) {
    return new Response(
      JSON.stringify({ error: 'invalid_request' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }
  if (!(await isAllowedRedirectUri(db, clientId, redirectUri))) {
    // Open-redirect guard — never reflect attacker-supplied redirect_uri.
    return new Response(
      JSON.stringify({ error: 'invalid_request', error_description: 'redirect_uri not registered for this client' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }
  const params = new URLSearchParams({ error: errorCode });
  if (state) params.set('state', state);
  return new Response(null, {
    status: 302,
    headers: { Location: `${redirectUri}?${params.toString()}` },
  });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const session = await getSessionUser(context.request, context.env);
  const body = await parseBody(context.request);

  if (!session) {
    // 302 to login，preserve full original authorize URL via redirect_after
    const params = new URLSearchParams();
    if (body.client_id) params.set('client_id', body.client_id);
    if (body.redirect_uri) params.set('redirect_uri', body.redirect_uri);
    if (body.response_type) params.set('response_type', body.response_type);
    if (body.scope) params.set('scope', body.scope);
    if (body.state) params.set('state', body.state);
    if (body.code_challenge) params.set('code_challenge', body.code_challenge);
    if (body.code_challenge_method) params.set('code_challenge_method', body.code_challenge_method);
    const consentUrl = `/oauth/consent?${params.toString()}`;
    return new Response(null, {
      status: 302,
      headers: { Location: `/login?redirect_after=${encodeURIComponent(consentUrl)}` },
    });
  }

  if (body.decision === 'deny') {
    return safeRedirect(context.env.DB, body.client_id, body.redirect_uri, 'access_denied', body.state);
  }

  if (body.decision !== 'allow') {
    return new Response(
      JSON.stringify({ error: 'invalid_request', error_description: 'decision must be allow or deny' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  // decision='allow'
  if (!body.client_id) {
    return new Response(
      JSON.stringify({ error: 'invalid_request', error_description: 'Missing client_id' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  const scopes = (body.scope ?? '').split(/\s+/).filter(Boolean);

  // Store consent (idempotent upsert)
  const consentKey = `${session.uid}:${body.client_id}`;
  const adapter = new D1Adapter(context.env.DB, 'Consent');
  await adapter.upsert(
    consentKey,
    { user_id: session.uid, client_id: body.client_id, scopes, grantedAt: Date.now() },
    CONSENT_TTL_SEC,
  );

  await recordAuthEvent(context.env.DB, context.request, {
    eventType: 'oauth_consent',
    outcome: 'success',
    userId: session.uid,
    clientId: body.client_id,
    metadata: { scopes, decision: 'allow' },
  });

  // Redirect back to authorize with original params — this time will
  // pick up consent and proceed to code gen
  const params = new URLSearchParams();
  if (body.client_id) params.set('client_id', body.client_id);
  if (body.redirect_uri) params.set('redirect_uri', body.redirect_uri);
  if (body.response_type) params.set('response_type', body.response_type);
  if (body.scope) params.set('scope', body.scope);
  if (body.state) params.set('state', body.state);
  if (body.code_challenge) params.set('code_challenge', body.code_challenge);
  if (body.code_challenge_method) params.set('code_challenge_method', body.code_challenge_method);

  return new Response(null, {
    status: 302,
    headers: { Location: `/api/oauth/authorize?${params.toString()}` },
  });
};
