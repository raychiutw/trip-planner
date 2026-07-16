/**
 * API 共用工具函式
 */

import type { AuthData } from './_types';
import { AppError } from './_errors';

/** snake_case → camelCase key conversion */
function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Recursively convert all object keys from snake_case to camelCase */
function deepCamel(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(deepCamel);
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      result[snakeToCamel(key)] = deepCamel(val);
    }
    return result;
  }
  return obj;
}

/** JSON response with automatic deep snake_case → camelCase key conversion */
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(deepCamel(data)), { status, headers: { 'Content-Type': 'application/json' } });
}

/** JSON response WITHOUT key conversion — for OAuth wire format that requires
 *  snake_case keys (RFC 6749 access_token / client_id etc.) */
export function rawJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

/** 型別安全的 auth 擷取 */
export function getAuth(context: { data: unknown }): AuthData | null {
  return ((context.data as Record<string, unknown>)?.auth as AuthData) ?? null;
}

/** 解析 JSON body，失敗 throw AppError('DATA_VALIDATION') */
export async function parseJsonBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new AppError('DATA_VALIDATION', 'JSON 格式無效');
  }
}

/** 驗證數值 URL 參數，回傳正整數或 null */
export function parseIntParam(s: string): number | null {
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

/**
 * Generate a base64url opaque token from `byteLen` random bytes (default 32 = ~256 bits).
 * Used for session cookies, OAuth state, authorization codes, refresh tokens, email
 * verification tokens, password reset tokens — anything that needs an unguessable
 * URL-safe identifier. Centralised here so a single bug fix (e.g. unfilled bytes)
 * applies everywhere.
 */
/**
 * v2.33.59 round 13: Return trusted origin for outbound email links / OIDC issuer。
 *
 * 之前 `new URL(context.request.url).origin` 信 attacker-spoofable Host header —
 * CF Pages edge 通常會 normalise，但 zero-trust 不假設。
 *
 * Prefer `env.PUBLIC_ORIGIN` if set (prod: `https://trip-planner-dby.pages.dev`)。
 * Fallback to `request.url.origin` if 未設（dev 漸進採用，wrangler.toml 補完即可拔）。
 */
export function getPublicOrigin(env: { PUBLIC_ORIGIN?: string }, request: Request): string {
  if (env.PUBLIC_ORIGIN && env.PUBLIC_ORIGIN.length > 0) {
    return env.PUBLIC_ORIGIN.replace(/\/+$/, '');
  }
  return new URL(request.url).origin;
}

/**
 * OIDC issuer identifier — 單一真相，discovery doc 與 id_token 的 `iss` 共用。
 *
 * **必須由這裡集中產生。** 兩邊各自組字串會 drift：v2.55.84 以前
 * `openid-configuration.ts` 宣告 `<origin>/api/oauth`、`_id_token.ts` 卻簽
 * `<origin>`（無後綴），任何照 OIDC Core 3.1.3.7 #2 驗 `iss` 的 client 都會把
 * 合法 token 判為無效。該檔的註解甚至預言了要 cross-check 卻漏了 issuer 本身。
 *
 * 後綴不可省：OIDC Discovery §4 規定 discovery doc 必須位於
 * `{issuer}/.well-known/openid-configuration` —— 我們的 doc 掛在
 * `/api/oauth/.well-known/openid-configuration`，所以 issuer 就是 `/api/oauth`。
 * 拔掉後綴會讓 doc 的位置變成不合規（根路徑回的是 SPA HTML）。
 */
export function getOidcIssuer(env: { PUBLIC_ORIGIN?: string }, request: Request): string {
  return `${getPublicOrigin(env, request)}/api/oauth`;
}

export function generateOpaqueToken(byteLen = 32): string {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]!);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * SHA-256(input) base64 — used by _auth_audit, _session, etc. for IP hashing.
 * Centralised so a single hash-algorithm change applies everywhere.
 */
export async function sha256Base64(input: string): Promise<string> {
  // v2.33.101 CR-6: crypto.subtle.digest 接受 BufferSource (= ArrayBuffer |
  // ArrayBufferView)。Uint8Array 是 ArrayBufferView，可直接傳；之前 `as unknown
  // as ArrayBuffer` 是 unsound double-cast (lying about type to silence TS)。
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const arr = new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i]!);
  return btoa(str);
}

/**
 * Parse request body as form-urlencoded OR JSON. Returns flat record. Used by
 * OAuth endpoints that accept both content types per RFC 6749 §3.2.
 */
export async function parseFormOrJson<T = Record<string, string>>(
  request: Request,
): Promise<T> {
  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    const out: Record<string, string> = {};
    for (const [k, v] of params) out[k] = v;
    return out as unknown as T;
  }
  if (ct.includes('application/json')) {
    return (await request.json()) as T;
  }
  return {} as T;
}

/**
 * Parse HTTP Basic auth header for client credentials (RFC 6749 §2.3.1).
 * Returns null if the header is missing or malformed.
 */
export function parseBasicAuth(request: Request): { id: string; secret: string } | null {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Basic ')) return null;
  try {
    const decoded = atob(auth.slice(6));
    const idx = decoded.indexOf(':');
    if (idx < 0) return null;
    return { id: decoded.slice(0, idx), secret: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

/** 動態 SQL UPDATE clause builder */
export function buildUpdateClause(
  body: Record<string, unknown>,
  allowedFields: readonly string[],
): { fields: string[]; setClauses: string; values: unknown[] } | null {
  const fields = Object.keys(body).filter(k => (allowedFields as readonly string[]).includes(k));
  if (fields.length === 0) return null;
  const setClauses = [...fields.map(f => `${f} = ?`), 'updated_at = CURRENT_TIMESTAMP'].join(', ');
  const values = fields.map(f => body[f]);
  return { fields, setClauses, values };
}
