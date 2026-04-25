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
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input) as unknown as ArrayBuffer,
  );
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
