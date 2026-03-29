/**
 * POST /api/reports — 使用者錯誤回報（公開端點）
 * 不需認證，但有 rate limit + 蜜罐欄位防護
 */
import { json } from './_utils';
import { AppError } from './_errors';
import type { Env } from './_types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const db = env.DB;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    throw new AppError('DATA_VALIDATION', 'JSON 格式無效');
  }

  // 蜜罐欄位 — bot 會填這個欄位
  if (body.website || body.email_confirm) {
    return json({ ok: true }); // 假裝成功，不存
  }

  const tripId = body.tripId as string;
  if (!tripId || typeof tripId !== 'string') {
    throw new AppError('DATA_VALIDATION', '缺少 tripId');
  }

  // 簡易 rate limit — 同 tripId + URL 30 秒內不可重複
  const url = (body.url as string) || '';
  const recent = await db.prepare(
    "SELECT 1 FROM error_reports WHERE trip_id = ? AND url = ? AND created_at > datetime('now', '-30 seconds')"
  ).bind(tripId, url).first();
  if (recent) {
    throw new AppError('SYS_RATE_LIMIT');
  }

  await db.prepare(
    'INSERT INTO error_reports (trip_id, url, error_code, error_message, user_agent, context) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(
    tripId,
    (body.url as string) || null,
    (body.errorCode as string) || null,
    (body.errorMessage as string) || null,
    (body.userAgent as string) || null,
    (body.context as string) || null,
  ).run();

  return json({ ok: true }, 201);
};
