/**
 * API Middleware — JWT 驗證 + Service Token 辨識
 *
 * 從 CF_Authorization cookie 解析 JWT 取得 email，
 * 或從 CF-Access-Client-Id header 辨識 Service Token（視為 admin）。
 */

import type { Env, AuthData } from './_types';

// 擴充 EventContext data
declare module '@cloudflare/workers-types' {
  interface EventContext<Env, P, Data> {
    data: Data & { auth: AuthData };
  }
}

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.split('=');
    if (key.trim() === name) return valueParts.join('=');
  }
  return null;
}

/** Decodes a JWT payload without signature verification. Cloudflare Access validates the JWT at the edge. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
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

  try {
    const response = await handleAuth(context);

    // Log 4xx/5xx responses
    const duration = Date.now() - start;
    if (response.status >= 400) {
      context.waitUntil(
        env.DB.prepare(
          'INSERT INTO api_logs (method, path, status, duration) VALUES (?, ?, ?, ?)',
        )
          .bind(request.method, url.pathname, response.status, duration)
          .run(),
      );
    }
    return response;
  } catch (err) {
    const duration = Date.now() - start;
    context.waitUntil(
      env.DB.prepare(
        'INSERT INTO api_logs (method, path, status, error, duration) VALUES (?, ?, ?, ?, ?)',
      )
        .bind(
          request.method,
          url.pathname,
          500,
          err instanceof Error ? err.message : String(err),
          duration,
        )
        .run(),
    );
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
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
function isAllowedOrigin(origin: string, env: Env): boolean {
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
function checkCsrf(request: Request, env: Env): Response | null {
  const method = request.method.toUpperCase();
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  if (!mutating) return null;

  const origin = request.headers.get('Origin');
  if (!origin) {
    // Allow service-token requests that omit Origin (e.g. CLI / scheduler)
    const hasServiceToken = !!request.headers.get('CF-Access-Client-Id') && !!request.headers.get('CF-Access-Client-Secret');
    if (hasServiceToken) return null;
    return new Response(JSON.stringify({ error: 'Origin header required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!isAllowedOrigin(origin, env)) {
    return new Response(JSON.stringify({ error: 'Forbidden: invalid origin' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null;
}

async function handleAuth(
  context: EventContext<Env, string, Record<string, unknown>>,
): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  // CSRF protection for all mutating requests
  const csrfError = checkCsrf(request, env);
  if (csrfError) return csrfError;

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
    return new Response(JSON.stringify({ error: '未認證' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const payload = decodeJwtPayload(token);
  if (!payload) {
    return new Response(JSON.stringify({ error: '無效的認證 token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
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
    return new Response(JSON.stringify({ error: '無效的認證 token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
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
