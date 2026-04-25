/**
 * Session helper — V2-P1 整合 cookies + session token module
 *
 * Caller convenience：把 _cookies.ts + src/server/session.ts 包成
 * Pages Function 友善的 API（getSessionUser / requireSessionUser / issueSession /
 * clearSession）。
 *
 * 用 SESSION_SECRET env 簽 token；env 缺少時 throw（fail loud avoid silent
 * security degrade）。
 *
 * V2-P6 multi-device support：
 *   - issueSession 多生 sid (uuid) 嵌進 payload + 寫 session_devices row
 *   - getSessionUser 額外檢查 session_devices.revoked_at（best-effort，DB
 *     失敗不擋 verify — degrade gracefully）
 *   - Legacy session（V2-P1 簽出，無 sid）→ 跳過 revocation check，仍 valid
 */
import type { D1Database } from '@cloudflare/workers-types';
import { AppError } from './_errors';
import {
  getSessionCookie,
  buildSessionSetCookie,
  buildClearSessionSetCookie,
  shouldSetSecure,
} from './_cookies';
import {
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from '../../src/server/session';

/**
 * 任何 env 物件含 SESSION_SECRET 都接受。Caller 通常傳 functions/api/_types.ts 的
 * `Env`（含 SESSION_SECRET? optional）。不用 [key: string]: unknown index sig
 * 否則 Env strict-typed 物件無法直接傳入。
 */
interface EnvWithSession {
  SESSION_SECRET?: string;
  DB?: D1Database;
}

function requireSecret(env: EnvWithSession): string {
  const secret = env.SESSION_SECRET;
  if (!secret) {
    // SESSION_SECRET 缺少是 deployment config 缺失，500 SYS_INTERNAL
    throw new AppError('SYS_INTERNAL', 'SESSION_SECRET env 未設定');
  }
  return secret;
}

/** SHA-256(ip) base64 — same algorithm as auth_audit_log.ts for consistency */
async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(ip) as unknown as ArrayBuffer,
  );
  const arr = new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i]!);
  return btoa(str);
}

/** Lightweight User-Agent → 'Browser · OS' summary（client display 用） */
function summarizeUserAgent(ua: string): string {
  if (!ua) return '';
  let browser = 'Other';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Firefox/.test(ua)) browser = 'Firefox';
  else if (/Chrome/.test(ua)) browser = 'Chrome';
  else if (/Safari/.test(ua)) browser = 'Safari';
  let os = 'Other';
  if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Linux/.test(ua)) os = 'Linux';
  return `${browser} · ${os}`;
}

/**
 * Read session cookie + verify token → return payload or null。
 * 用於不強制 auth 的 endpoint（如 GET /api/trips）。
 *
 * V2-P6: 若 payload 含 sid 且 env.DB 存在 → 額外檢查 session_devices.revoked_at
 * （已 revoke 視為無效）。DB 失敗 silent fallback（cookie 仍 valid）。
 */
export async function getSessionUser(
  request: Request,
  env: EnvWithSession,
): Promise<SessionPayload | null> {
  const token = getSessionCookie(request);
  if (!token) return null;
  const secret = requireSecret(env);
  const payload = await verifySessionToken(token, secret);
  if (!payload) return null;

  // V2-P6 revocation check
  if (payload.sid && env.DB) {
    try {
      const row = await env.DB
        .prepare('SELECT revoked_at FROM session_devices WHERE sid = ?')
        .bind(payload.sid)
        .first<{ revoked_at: string | null }>();
      if (row && row.revoked_at) {
        // Session manually revoked — refuse
        return null;
      }
      // Best-effort touch last_seen_at, throttled to 5min so D1 write churn
      // stays bounded（per-request UPDATE on hot path otherwise ~1 write/click）。
      // Fire-and-forget without ctx.waitUntil — acceptable since miss is just
      // a stale last_seen_at not security-critical。SQL filter pushes the
      // throttle into D1 so most calls become 0-row no-op writes (still cheap)。
      //
      // TODO(V2-P7): thread context.executionCtx + ctx.waitUntil(promise) if
      // last_seen_at accuracy becomes load-bearing for stale-session cleanup。
      // 目前 cron cleanup 用 created_at + 30 天 cap 不依賴 last_seen_at 精度。
      void env.DB
        .prepare(
          `UPDATE session_devices SET last_seen_at = datetime('now')
           WHERE sid = ? AND last_seen_at < datetime('now', '-5 minutes')`,
        )
        .bind(payload.sid)
        .run()
        .catch(() => undefined);
    } catch {
      // DB unavailable — cookie still valid (degrade gracefully)
    }
  }

  return payload;
}

/**
 * Read session cookie + verify token → throw AUTH_REQUIRED if missing/invalid。
 * 用於強制 auth 的 endpoint。
 */
export async function requireSessionUser(
  request: Request,
  env: EnvWithSession,
): Promise<SessionPayload> {
  const payload = await getSessionUser(request, env);
  if (!payload) throw new AppError('AUTH_REQUIRED');
  return payload;
}

/**
 * Sign new session token + append Set-Cookie header to response。
 * 用於 OAuth callback / login success path。
 *
 * V2-P6: 若 env.DB 存在 → 產 sid 嵌進 payload + INSERT session_devices row
 * （含 ua_summary + ip_hash 為 /settings/sessions 顯示用）。DB 失敗仍會
 * 簽 token（only without sid），不擋 login。
 */
export async function issueSession(
  request: Request,
  response: Response,
  uid: string,
  env: EnvWithSession,
  ttlSeconds?: number,
): Promise<void> {
  const secret = requireSecret(env);
  let sid: string | undefined;

  if (env.DB) {
    try {
      sid = crypto.randomUUID();
      const ua = (request.headers.get('User-Agent') ?? '').slice(0, 200);
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const ipHash = await hashIp(ip);
      await env.DB
        .prepare(
          `INSERT INTO session_devices (sid, user_id, ua_summary, ip_hash)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(sid, uid, summarizeUserAgent(ua) || null, ipHash)
        .run();
    } catch {
      // DB failure → fall back to legacy (no sid) session — login still succeeds
      sid = undefined;
    }
  }

  const token = await signSessionToken(uid, secret, ttlSeconds, sid);
  const cookie = buildSessionSetCookie(token, { secure: shouldSetSecure(request), maxAge: ttlSeconds });
  response.headers.append('Set-Cookie', cookie);
}

/**
 * Append clear-session Set-Cookie header → logout。
 *
 * V2-P6: mark revoked_at in session_devices（讓 logout 立即生效在 multi-tab
 * scenario）。env 必傳 — caller 一律從 PagesFunction context 拿，沒有「無 env」
 * 的情境。DB 缺或 token 無 sid（legacy）→ silent no-op，cookie 仍會被清。
 */
export async function clearSession(
  request: Request,
  response: Response,
  env: EnvWithSession,
): Promise<void> {
  const cookie = buildClearSessionSetCookie(shouldSetSecure(request));
  response.headers.append('Set-Cookie', cookie);

  if (!env.DB || !env.SESSION_SECRET) return;
  try {
    const token = getSessionCookie(request);
    if (!token) return;
    const payload = await verifySessionToken(token, env.SESSION_SECRET);
    if (!payload?.sid) return;
    await env.DB
      .prepare(
        `UPDATE session_devices SET revoked_at = datetime('now')
         WHERE sid = ? AND revoked_at IS NULL`,
      )
      .bind(payload.sid)
      .run();
  } catch {
    // best-effort — cookie cleared regardless
  }
}

/** Helper for "log out all other devices" feature — used by /api/account/sessions DELETE all */
export async function revokeAllOtherSessions(
  db: D1Database,
  userId: string,
  currentSid: string | null,
): Promise<{ revoked: number }> {
  // 用 (? IS NULL OR sid != ?) 把「current 為 null 撤銷全部」+「current 有值
  // 撤銷除自己外」合成單一 SQL，免 ternary 兩個 prepare branch
  const result = await db
    .prepare(
      `UPDATE session_devices SET revoked_at = datetime('now')
       WHERE user_id = ? AND revoked_at IS NULL AND (? IS NULL OR sid != ?)`,
    )
    .bind(userId, currentSid, currentSid)
    .run();
  const changes = (result.meta as { changes?: number } | undefined)?.changes ?? 0;
  return { revoked: changes };
}
