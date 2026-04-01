/**
 * API 共用工具函式
 */

import type { AuthData } from './_types';
import { AppError } from './_errors';

export function json(data: unknown, status = 200) {
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
