/**
 * API Middleware — JWT 驗證 + Service Token 辨識
 *
 * 從 CF_Authorization cookie 解析 JWT 取得 email，
 * 或從 CF-Access-Client-Id header 辨識 Service Token（視為 admin）。
 */

interface Env {
  DB: D1Database;
  CF_API_TOKEN: string;
  CF_ACCOUNT_ID: string;
  CF_ACCESS_APP_ID: string;
  CF_ACCESS_POLICY_ID: string;
  ADMIN_EMAIL: string;
}

interface AuthData {
  email: string;
  isAdmin: boolean;
  isServiceToken: boolean;
}

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

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // 公開讀取：GET /api/trips/** 不需認證
  if (request.method === 'GET' && url.pathname.startsWith('/api/trips')) {
    // 嘗試解析 auth（給 admin 功能用，如 ?all=1），但不強制
    const token = getCookie(request, 'CF_Authorization');
    if (token) {
      const payload = decodeJwtPayload(token);
      if (payload?.email) {
        const email = String(payload.email).toLowerCase();
        (context.data as Record<string, unknown>).auth = {
          email,
          isAdmin: email === env.ADMIN_EMAIL.toLowerCase(),
          isServiceToken: false,
        };
      }
    }
    return context.next();
  }

  // Service Token 辨識（header 未被 Access 消化時）
  const clientId = request.headers.get('CF-Access-Client-Id');
  if (clientId) {
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
};
