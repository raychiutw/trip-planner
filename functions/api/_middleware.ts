/**
 * API Middleware — JWT 驗證 + Service Token 辨識
 *
 * 從 CF_Authorization cookie 解析 JWT 取得 email，
 * 或從 CF-Access-Client-Id header 辨識 Service Token（視為 admin）。
 */

import type { Env } from './_types';
import { detectGarbledText } from './_validate';
import { getSessionUser } from './_session';
import { D1Adapter, type AdapterPayload } from '../../src/server/oauth-d1-adapter';

import { AppError, errorResponse } from './_errors';

interface AccessTokenPayload extends AdapterPayload {
  client_id: string;
  /** null for client_credentials grants (service-to-service) */
  user_id: string | null;
  scopes: string[];
  grantId: string;
}

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.split('=');
    if (key?.trim() === name) return valueParts.join('=');
  }
  return null;
}

/**
 * 偵測 request source，用於 api_logs.source 欄位。
 * 優先順序: scheduler > companion > service_token > user_jwt > anonymous
 *
 * 此函式不驗 token — Cloudflare Access 已在邊緣驗過。
 * 只做 request shape 的分類，給 daily-check 做錯誤來源統計。
 *
 * ⚠️ Trust boundary: source 值是 **self-reported telemetry**，不是 auth decision。
 * X-Tripline-Source 跟 X-Request-Scope 都可被 anonymous 呼叫端偽造。消費端
 * (daily-check) 對 scheduler/companion 做 escalation 時必須結合 path / error
 * code 等 secondary signal，不能單憑 source 來 gate。
 */
/** @internal — exported for unit testing */
export function detectSource(
  request: Request,
): 'scheduler' | 'companion' | 'service_token' | 'user_jwt' | 'anonymous' {
  if (request.headers.get('X-Tripline-Source') === 'scheduler') return 'scheduler';
  if (request.headers.get('X-Request-Scope') === 'companion') return 'companion';
  const clientId = request.headers.get('CF-Access-Client-Id');
  const clientSecret = request.headers.get('CF-Access-Client-Secret');
  if (clientId && clientSecret) return 'service_token';
  if (getCookie(request, 'CF_Authorization')) return 'user_jwt';
  return 'anonymous';
}

/** Decodes a JWT payload without signature verification. Cloudflare Access validates the JWT at the edge. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payload);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const start = Date.now();
  const { request, env } = context;
  const url = new URL(request.url);
  // Lazy: 只在寫 api_logs 時才算 source（2xx 成功路徑完全跳過 detectSource 的 header/cookie 讀取）
  let cachedSource: ReturnType<typeof detectSource> | undefined;
  const getSource = () => (cachedSource ??= detectSource(request));

  try {
    const response = await handleAuth(context);

    // Log 4xx/5xx responses
    const duration = Date.now() - start;
    if (response.status >= 400) {
      context.waitUntil(
        env.DB.prepare(
          'INSERT INTO api_logs (method, path, status, duration, source) VALUES (?, ?, ?, ?, ?)',
        )
          .bind(request.method, url.pathname, response.status, duration, getSource())
          .run(),
      );
    }
    return response;
  } catch (err) {
    const duration = Date.now() - start;

    // AppError = 預期錯誤（handler throw）→ 結構化回應
    if (err instanceof AppError) {
      context.waitUntil(
        env.DB.prepare(
          'INSERT INTO api_logs (method, path, status, error, duration, source) VALUES (?, ?, ?, ?, ?, ?)',
        )
          .bind(request.method, url.pathname, err.status, err.detail ? `${err.code}: ${err.detail}` : err.code, duration, getSource())
          .run(),
      );
      return errorResponse(err);
    }

    // 非預期錯誤 → 500 + log
    context.waitUntil(
      env.DB.prepare(
        'INSERT INTO api_logs (method, path, status, error, duration, source) VALUES (?, ?, ?, ?, ?, ?)',
      )
        .bind(
          request.method,
          url.pathname,
          500,
          err instanceof Error ? err.message : String(err),
          duration,
          getSource(),
        )
        .run(),
    );
    return errorResponse(new AppError('SYS_INTERNAL'));
  }
};

/**
 * 原有的認證邏輯，抽成獨立函式以便被錯誤記錄 wrapper 包裹。
 */
const PRODUCTION_ORIGIN = 'https://trip-planner-dby.pages.dev';

/**
 * Returns true if the given origin is allowed.
 * Accepts the configured production origin, localhost origins for dev, and
 * any origin override supplied via the ALLOWED_ORIGIN env var.
 */
/** @internal — exported for unit testing */
export function isAllowedOrigin(origin: string, env: Env): boolean {
  // Allow any localhost origin for local development
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  // Allow production origin
  if (origin === PRODUCTION_ORIGIN) return true;
  // Allow Cloudflare Pages preview deployments
  if (/^https:\/\/[a-f0-9]+\.trip-planner-dby\.pages\.dev$/.test(origin)) return true;
  // Allow custom origins from env (comma-separated)
  if (env.ALLOWED_ORIGIN) {
    const allowed = env.ALLOWED_ORIGIN.split(',').map(s => s.trim());
    if (allowed.includes(origin)) return true;
  }
  return false;
}

/**
 * CSRF protection for mutating requests.
 *
 * Validates the Origin header for POST/PUT/PATCH/DELETE requests.
 * Requests without an Origin header are only permitted when they carry a
 * CF-Access-Client-Id header (i.e. service-token CLI calls that don't set
 * Origin).
 */
/** @internal — exported for unit testing */
export function checkCsrf(request: Request, env: Env): Response | null {
  const method = request.method.toUpperCase();
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  if (!mutating) return null;

  const origin = request.headers.get('Origin');
  if (!origin) {
    // Allow service-token requests that omit Origin (e.g. CLI / scheduler)
    const hasServiceToken = !!request.headers.get('CF-Access-Client-Id') && !!request.headers.get('CF-Access-Client-Secret');
    if (hasServiceToken) return null;
    return errorResponse(new AppError('PERM_DENIED', 'Origin header required'));
  }

  if (!isAllowedOrigin(origin, env)) {
    return errorResponse(new AppError('PERM_DENIED', 'Invalid origin'));
  }

  return null;
}

/**
 * Companion scope restriction — limits operations when X-Request-Scope: companion is set.
 * Used by tp-request scheduler to prevent prompt injection from escalating privileges.
 */
const COMPANION_ALLOWED: Array<{ method: string; pattern: RegExp }> = [
  { method: 'POST',  pattern: /^\/api\/trips\/[^/]+\/days\/\d+\/entries$/ },
  { method: 'PATCH', pattern: /^\/api\/trips\/[^/]+\/entries\/\d+$/ },
  { method: 'POST',  pattern: /^\/api\/trips\/[^/]+\/entries\/\d+\/trip-pois$/ },
  { method: 'PATCH', pattern: /^\/api\/trips\/[^/]+\/trip-pois\/\d+$/ },
  { method: 'DELETE', pattern: /^\/api\/trips\/[^/]+\/trip-pois\/\d+$/ },
  { method: 'PUT',   pattern: /^\/api\/trips\/[^/]+\/docs\/\w+$/ },
  { method: 'PATCH', pattern: /^\/api\/requests\/\d+$/ },
  { method: 'PATCH', pattern: /^\/api\/pois\/\d+$/ },
  { method: 'GET',   pattern: /^\/api\/trips\// },
  { method: 'GET',   pattern: /^\/api\/requests/ },
];

/** @internal — exported for unit testing */
export function checkCompanionScope(request: Request, url: URL): Response | null {
  const scope = request.headers.get('X-Request-Scope');
  if (scope !== 'companion') return null;

  const method = request.method.toUpperCase();
  const path = url.pathname;
  const allowed = COMPANION_ALLOWED.some(r => r.method === method && r.pattern.test(path));
  if (allowed) return null;

  return errorResponse(new AppError('PERM_DENIED', '此操作超出旅伴請求範圍'));
}

async function handleAuth(
  context: EventContext<Env, string, Record<string, unknown>>,
): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  // Mock auth for local development — DEV_MOCK_EMAIL set in .env.local (not in version control)
  if (env.DEV_MOCK_EMAIL) {
    const email = env.DEV_MOCK_EMAIL.toLowerCase();
    (context.data as Record<string, unknown>).auth = {
      email,
      isAdmin: email === (env.ADMIN_EMAIL || '').toLowerCase(),
      isServiceToken: false,
    };
    return context.next();
  }

  // CSRF protection for all mutating requests
  const csrfError = checkCsrf(request, env);
  if (csrfError) return csrfError;

  // Companion scope restriction — tp-request scheduler sends this header
  const scopeError = checkCompanionScope(request, url);
  if (scopeError) return scopeError;

  // UTF-8 body validation for mutating requests
  const method = request.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const cloned = request.clone();
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      const bodyText = decoder.decode(new Uint8Array(await cloned.arrayBuffer()));
      // 亂碼偵測（常見於 CP950/Big5 → UTF-8 誤轉），統一在 middleware 層阻擋
      if (detectGarbledText(bodyText)) {
        return errorResponse(new AppError('DATA_ENCODING', 'Request body 包含疑似亂碼，請確認 encoding 為 UTF-8'));
      }
    } catch {
      return errorResponse(new AppError('DATA_ENCODING', 'Request body is not valid UTF-8'));
    }
  }

  // V2-P1：/api/oauth/* 全部 public — OAuth endpoints 自管 auth
  // (PKCE / client_secret / JWT)，由 oidc-provider 處理。User-session middleware
  // 不該攔截，否則 external client + browser OAuth flow 都被 401。
  // 包含：spike (V2 Day 0) / .well-known/openid-configuration / authorize / token /
  // revoke / par 等所有 OAuth endpoints。
  if (url.pathname.startsWith('/api/oauth/')) {
    (context.data as Record<string, unknown>).auth = null;
    return context.next();
  }

  // V2 公開 capability probe：/api/public-config — login/signup page 需要在沒
  // session 的情況下知道哪些 provider 開了。Side-effect-free，無 secrets exposed。
  if (request.method === 'GET' && url.pathname === '/api/public-config') {
    (context.data as Record<string, unknown>).auth = null;
    return context.next();
  }

  // 公開端點：POST /api/reports（使用者錯誤回報，不需認證）
  if (request.method === 'POST' && url.pathname === '/api/reports') {
    (context.data as Record<string, unknown>).auth = null;
    return context.next();
  }

  // 公開讀取：GET /api/route（Mapbox Directions proxy，只接受座標 query params、不回 user data）
  if (request.method === 'GET' && url.pathname === '/api/route') {
    (context.data as Record<string, unknown>).auth = null;
    return context.next();
  }

  // V2 OAuth — sole auth path (CF Access blocks below are kept transitional during cutover).
  //
  // Order: try V2 session cookie first (browser users), then V2 Bearer token (service
  // calls). If either is present and valid, decorate auth and return next() —
  // skipping the CF Access JWT path entirely. CF Access still works as fallback for
  // sessions issued before the cutover; once `_session.ts` becomes the sole token
  // issuer the CF JWT block below becomes dead code.
  const v2Session = await getSessionUser(request, env);
  if (v2Session) {
    let userEmail = '';
    try {
      const userRow = await env.DB
        .prepare('SELECT email FROM users WHERE id = ?')
        .bind(v2Session.uid)
        .first<{ email: string }>();
      if (userRow?.email) userEmail = userRow.email.toLowerCase();
    } catch {
      // best-effort — DB miss leaves email empty, isAdmin will be false
    }
    (context.data as Record<string, unknown>).auth = {
      email: userEmail,
      isAdmin: env.ADMIN_EMAIL ? userEmail === env.ADMIN_EMAIL.toLowerCase() : false,
      isServiceToken: false,
    };
    return context.next();
  }

  // V2 service-to-service: Authorization: Bearer <access_token> issued via
  // /api/oauth/token grant_type=client_credentials. user_id is null on these tokens
  // (no user — pure client). Admin scope marks the client as service-admin.
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken) {
      try {
        const tokenAdapter = new D1Adapter(env.DB, 'AccessToken');
        const tokenRow = (await tokenAdapter.find(bearerToken)) as AccessTokenPayload | undefined;
        if (tokenRow) {
          // user-bound bearer (authorization_code grant): look up email from users
          // service-bound bearer (client_credentials): user_id null, treat as service token
          let email = '';
          let isAdmin = false;
          let isServiceToken = false;
          if (tokenRow.user_id === null) {
            isServiceToken = true;
            email = env.ADMIN_EMAIL ?? '';
            isAdmin = tokenRow.scopes.includes('admin');
          } else {
            try {
              const userRow = await env.DB
                .prepare('SELECT email FROM users WHERE id = ?')
                .bind(tokenRow.user_id)
                .first<{ email: string }>();
              if (userRow?.email) {
                email = userRow.email.toLowerCase();
                isAdmin = env.ADMIN_EMAIL ? email === env.ADMIN_EMAIL.toLowerCase() : false;
              }
            } catch {
              /* best-effort */
            }
          }
          (context.data as Record<string, unknown>).auth = {
            email,
            isAdmin,
            isServiceToken,
            scopes: tokenRow.scopes,
            clientId: tokenRow.client_id,
          };
          return context.next();
        }
      } catch {
        // best-effort lookup — fall through to CF Access fallback if Bearer invalid
      }
    }
  }

  // 公開讀取：GET /api/trips/** 不需認證
  if (request.method === 'GET' && url.pathname.startsWith('/api/trips')) {
    // Service Token（CLI / scheduler）→ admin
    // Security assumption: Cloudflare Access validates CF-Access-Client-Id and
    // CF-Access-Client-Secret at the edge. We require both headers as
    // defense-in-depth so that a leaked Client-Id alone is not sufficient.
    const stClientId = request.headers.get('CF-Access-Client-Id');
    const stClientSecret = request.headers.get('CF-Access-Client-Secret');
    if (stClientId && stClientSecret) {
      (context.data as Record<string, unknown>).auth = {
        email: env.ADMIN_EMAIL,
        isAdmin: true,
        isServiceToken: true,
      };
      return context.next();
    }
    // 嘗試解析 JWT auth（給 admin 功能用，如 ?all=1），但不強制
    const token = getCookie(request, 'CF_Authorization');
    if (token) {
      const payload = decodeJwtPayload(token);
      if (payload?.email) {
        const email = String(payload.email).toLowerCase();
        (context.data as Record<string, unknown>).auth = {
          email,
          isAdmin: env.ADMIN_EMAIL
            ? email === env.ADMIN_EMAIL.toLowerCase()
            : false,
          isServiceToken: false,
        };
      } else if (payload?.common_name) {
        (context.data as Record<string, unknown>).auth = {
          email: env.ADMIN_EMAIL,
          isAdmin: true,
          isServiceToken: true,
        };
      }
    }
    return context.next();
  }

  // Service Token 辨識（header 未被 Access 消化時）
  // Security assumption: Cloudflare Access validates both headers at the edge.
  // We require both CF-Access-Client-Id AND CF-Access-Client-Secret as
  // defense-in-depth so a leaked Client-Id alone does not grant admin access.
  const clientId = request.headers.get('CF-Access-Client-Id');
  const clientSecret = request.headers.get('CF-Access-Client-Secret');
  if (clientId && clientSecret) {
    (context.data as Record<string, unknown>).auth = {
      email: env.ADMIN_EMAIL,
      isAdmin: true,
      isServiceToken: true,
    };
    return context.next();
  }

  // JWT 認證（Cloudflare Access 設定的 cookie）
  const token = getCookie(request, 'CF_Authorization');
  if (!token) {
    return errorResponse(new AppError('AUTH_REQUIRED'));
  }

  const payload = decodeJwtPayload(token);
  if (!payload) {
    return errorResponse(new AppError('AUTH_INVALID'));
  }

  // Service Token JWT：Access 消化 header 後發 JWT，有 common_name 但無 email
  if (!payload.email && payload.common_name) {
    (context.data as Record<string, unknown>).auth = {
      email: env.ADMIN_EMAIL,
      isAdmin: true,
      isServiceToken: true,
    };
    return context.next();
  }

  if (!payload.email) {
    return errorResponse(new AppError('AUTH_INVALID'));
  }

  const email = String(payload.email).toLowerCase();
  const isAdmin = email === env.ADMIN_EMAIL.toLowerCase();

  (context.data as Record<string, unknown>).auth = {
    email,
    isAdmin,
    isServiceToken: false,
  };

  return context.next();
}
