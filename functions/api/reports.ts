/**
 * POST /api/reports — 使用者錯誤回報（公開端點）
 * 不需認證，但有 rate limit + 蜜罐欄位防護
 *
 * v2.33.42 security audit: 加 field-length cap + 確認 tripId 存在於 trips
 * （防 attacker spam D1 + per-IP layered rate limit）。
 */
import { json, parseJsonBody } from './_utils';
import { AppError } from './_errors';
import { bumpRateLimit, clientIp, RATE_LIMITS } from './_rate_limit';
import type { Env } from './_types';

const MAX_FIELD_LEN = 2000;

function clampField(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/[\r\n]+/g, ' ').slice(0, MAX_FIELD_LEN);
  return trimmed || null;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const db = env.DB;

  const body = await parseJsonBody<Record<string, unknown>>(request);

  // 蜜罐欄位 — bot 會填這個欄位
  if (body.website || body.email_confirm) {
    return json({ ok: true }); // 假裝成功，不存
  }

  const tripId = body.tripId as string;
  if (!tripId || typeof tripId !== 'string') {
    throw new AppError('DATA_VALIDATION', '缺少 tripId');
  }

  // v2.33.42: tripId 必須存在（防 attacker 拿任意字串 spam D1）
  const tripExists = await db.prepare('SELECT 1 FROM trips WHERE id = ? LIMIT 1').bind(tripId).first();
  if (!tripExists) {
    throw new AppError('DATA_NOT_FOUND', 'trip 不存在');
  }

  // v2.33.42: per-IP layered rate limit — 200/24h per IP（防 anonymous spam）
  const ip = clientIp(request);
  await bumpRateLimit(db, `reports:ip:${ip}`, RATE_LIMITS.REPORTS_PER_IP);

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
    clampField(body.url),
    clampField(body.errorCode),
    clampField(body.errorMessage),
    clampField(body.userAgent),
    clampField(body.context),
  ).run();

  return json({ ok: true }, 201);
};
