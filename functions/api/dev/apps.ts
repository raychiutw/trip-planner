/**
 * /api/dev/apps — V2-P4 OAuth client_app registration (developer dashboard backend)
 *
 * POST /api/dev/apps
 *   Body: { app_name, redirect_uris[], client_type, app_description?, homepage_url?, allowed_scopes? }
 *   Auth: requireSession
 *   產 client_id (always) + client_secret (confidential only, **一次回傳**)
 *   寫 client_apps with status='pending_review', owner_user_id=current user
 *
 * GET /api/dev/apps
 *   Auth: requireSession
 *   回 current user 擁有的 apps（不含 client_secret_hash）
 *
 * Security:
 *   - client_secret 只在 POST response 出現一次（hash 過後存 DB）
 *   - redirect_uri HTTPS only，localhost 例外（dev compat）
 *   - 新 app status='pending_review'，ops 手動核可才 active
 *   - owner_user_id 用 session uid，不接受 body 指定（防 ownership 偽造）
 */
import { parseJsonBody } from '../_utils';
import { requireSessionUser } from '../_session';
import { hashPassword } from '../../../src/server/password';
import { AppError } from '../_errors';
import type { Env } from '../_types';

// 不用 _utils.json() — 它會把 snake_case key auto-camelCase，破 OAuth wire convention
// (client_id / client_secret / redirect_uris 必須保持 snake_case，per RFC 6749)
function snakeJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_CLIENT_TYPES = ['public', 'confidential'] as const;
const DEFAULT_SCOPES = ['openid', 'profile', 'email'];
const APP_NAME_MIN = 2;
const APP_NAME_MAX = 80;

interface CreateAppBody {
  app_name?: string;
  app_description?: string;
  homepage_url?: string;
  redirect_uris?: string[];
  allowed_scopes?: string[];
  client_type?: 'public' | 'confidential';
}

/** RFC 4648 base32 lowercase encoder for human-readable client_id / client_secret. */
function base32(bytes: Uint8Array): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0;
  let value = 0;
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]!;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) result += alphabet[(value << (5 - bits)) & 31];
  return result;
}

function generateClientId(): string {
  const bytes = new Uint8Array(12); // 96 bits ≈ ~20 base32 chars
  crypto.getRandomValues(bytes);
  return `tp_${base32(bytes)}`;
}

function generateClientSecret(): string {
  const bytes = new Uint8Array(32); // 256 bits
  crypto.getRandomValues(bytes);
  return `tps_${base32(bytes)}`;
}

function validateRedirectUris(uris: unknown): string[] {
  if (!Array.isArray(uris) || uris.length === 0) {
    throw new AppError('DATA_VALIDATION', 'redirect_uris 必填且至少 1 個');
  }
  if (uris.length > 10) {
    throw new AppError('DATA_VALIDATION', 'redirect_uris 最多 10 個');
  }
  return uris.map((u, i) => {
    if (typeof u !== 'string' || u.length === 0) {
      throw new AppError('DATA_VALIDATION', `redirect_uris[${i}] 格式無效`);
    }
    let parsed: URL;
    try {
      parsed = new URL(u);
    } catch {
      throw new AppError('DATA_VALIDATION', `redirect_uris[${i}] 不是合法 URL`);
    }
    const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !isLocalhost) {
      throw new AppError('DATA_VALIDATION', `redirect_uris[${i}] 必須是 HTTPS（localhost 例外）`);
    }
    return u;
  });
}

function validateScopes(scopes: unknown): string[] {
  if (!Array.isArray(scopes)) return DEFAULT_SCOPES;
  if (scopes.length === 0) return DEFAULT_SCOPES;
  const cleaned = scopes
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .map((s) => s.trim());
  return cleaned.length === 0 ? DEFAULT_SCOPES : cleaned;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const session = await requireSessionUser(context.request, context.env);
  const body = (await parseJsonBody<CreateAppBody>(context.request)) ?? {};

  const appName = (body.app_name ?? '').trim();
  if (!appName || appName.length < APP_NAME_MIN || appName.length > APP_NAME_MAX) {
    throw new AppError('DATA_VALIDATION', `app_name 長度需 ${APP_NAME_MIN}-${APP_NAME_MAX} 字`);
  }

  const clientType = body.client_type ?? 'public';
  if (!VALID_CLIENT_TYPES.includes(clientType)) {
    throw new AppError('DATA_VALIDATION', 'client_type 必須是 public 或 confidential');
  }

  const redirectUris = validateRedirectUris(body.redirect_uris);
  const allowedScopes = validateScopes(body.allowed_scopes);

  const clientId = generateClientId();
  let clientSecret: string | null = null;
  let clientSecretHash: string | null = null;
  if (clientType === 'confidential') {
    clientSecret = generateClientSecret();
    clientSecretHash = await hashPassword(clientSecret);
  }

  await context.env.DB
    .prepare(
      `INSERT INTO client_apps
         (client_id, client_secret_hash, client_type, app_name, app_description,
          homepage_url, redirect_uris, allowed_scopes, owner_user_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      clientId,
      clientSecretHash,
      clientType,
      appName,
      body.app_description ?? null,
      body.homepage_url ?? null,
      JSON.stringify(redirectUris),
      JSON.stringify(allowedScopes),
      session.uid,
      'pending_review',
    )
    .run();

  return snakeJson(
    {
      client_id: clientId,
      client_secret: clientSecret,
      app_name: appName,
      client_type: clientType,
      status: 'pending_review',
      redirect_uris: redirectUris,
      allowed_scopes: allowedScopes,
    },
    201,
  );
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await requireSessionUser(context.request, context.env);

  const result = await context.env.DB
    .prepare(
      `SELECT client_id, client_type, app_name, app_description, homepage_url,
              redirect_uris, allowed_scopes, status, created_at, updated_at
       FROM client_apps
       WHERE owner_user_id = ?
       ORDER BY created_at DESC`,
    )
    .bind(session.uid)
    .all<Record<string, unknown>>();

  const apps = (result.results ?? []).map((row) => ({
    ...row,
    redirect_uris: typeof row.redirect_uris === 'string'
      ? JSON.parse(row.redirect_uris) as unknown
      : row.redirect_uris,
    allowed_scopes: typeof row.allowed_scopes === 'string'
      ? JSON.parse(row.allowed_scopes) as unknown
      : row.allowed_scopes,
  }));

  return snakeJson({ apps });
};


