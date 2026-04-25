/**
 * GET /api/account/sessions  — list current user's active sessions
 * DELETE /api/account/sessions — log out all OTHER devices (not current)
 *
 * V2-P6 multi-device session management。Mockup section 6。
 *
 * Auth: requireSessionUser
 *
 * GET response: {
 *   current_sid: string | null,        -- 當前 session 的 sid (frontend mark "current")
 *   sessions: [
 *     { sid, ua_summary, ip_hash_prefix?, created_at, last_seen_at, is_current },
 *     ...
 *   ]
 * }
 *
 * DELETE response: { ok: true, revoked: <count> }
 *
 * Note: 不 leak 完整 ip_hash（避免 hash 反查）— 只回前 8 char 做 device 區分提示。
 */
import { requireSessionUser, revokeAllOtherSessions } from '../_session';
import { rawJson } from '../_utils';
import type { Env } from '../_types';

interface SessionDeviceRow {
  sid: string;
  ua_summary: string | null;
  ip_hash: string | null;
  created_at: string;
  last_seen_at: string;
}

// LIMIT 100 — UI display cap。Mass revoke (DELETE all-others) 是 unbounded
// server-side，不受此影響。V2-P6 cron cleanup 30 天保留期使「>100 active sessions」
// 在實務上幾乎不可能（除惡意/bug）— 真出現再加 pagination。
const SESSIONS_LIST_LIMIT = 100;

/**
 * SQLite `datetime('now')` 回 `'2026-04-25 07:48:12'` 沒 timezone 標記，
 * frontend `new Date(iso)` 會 interpret 為 local TZ，造成 UTC+8 時區顯示
 * 偏 8 小時。轉成 ISO 8601 with Z suffix（SQLite 已用 UTC 寫入）讓
 * `new Date()` 正確解析為 UTC。
 */
function toIsoUtc(sqliteTs: string): string {
  return sqliteTs.replace(' ', 'T') + 'Z';
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await requireSessionUser(context.request, context.env);

  const result = await context.env.DB
    .prepare(
      `SELECT sid, ua_summary, ip_hash, created_at, last_seen_at
       FROM session_devices
       WHERE user_id = ? AND revoked_at IS NULL
       ORDER BY last_seen_at DESC
       LIMIT ?`,
    )
    .bind(session.uid, SESSIONS_LIST_LIMIT)
    .all<SessionDeviceRow>();

  const currentSid = session.sid ?? null;
  const sessions = (result.results ?? []).map((row) => ({
    sid: row.sid,
    ua_summary: row.ua_summary,
    // Only first 8 chars of ip_hash for "different device" hint, not full reverse-lookup-bait
    ip_hash_prefix: row.ip_hash ? row.ip_hash.slice(0, 8) : null,
    created_at: toIsoUtc(row.created_at),
    last_seen_at: toIsoUtc(row.last_seen_at),
    is_current: row.sid === currentSid,
  }));

  return rawJson({ current_sid: currentSid, sessions });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const session = await requireSessionUser(context.request, context.env);
  const { revoked } = await revokeAllOtherSessions(
    context.env.DB,
    session.uid,
    session.sid ?? null,
  );
  return rawJson({ ok: true, revoked });
};
