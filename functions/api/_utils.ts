/**
 * API 共用工具函式
 */

import type { AuthData } from './_types';

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

/** 型別安全的 auth 擷取 */
export function getAuth(context: { data: unknown }): AuthData | null {
  return ((context.data as Record<string, unknown>)?.auth as AuthData) ?? null;
}

/** 解析 JSON body，失敗回 400 Response */
export async function parseJsonBody<T = Record<string, unknown>>(request: Request): Promise<T | Response> {
  try {
    return await request.json() as T;
  } catch {
    return json({ error: 'JSON 格式無效' }, 400);
  }
}

/** 驗證數值 URL 參數，回傳正整數或 null */
export function parseIntParam(s: string): number | null {
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
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

export const ANONYMOUS_USER = 'anonymous';
