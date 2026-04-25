/**
 * Auth audit log helper — V2-P6
 *
 * 集中記錄 OAuth / 帳密 / session 事件供 monitoring + forensic。
 * 所有 caller 透過 `recordAuthEvent()` 寫，**best-effort**：audit failure
 * 不該擋 caller 業務流程（例如 audit DB 滿了不能阻止使用者登入）。
 *
 * Schema 詳見 `migrations/0036_auth_audit_log.sql`。
 *
 * ## Usage
 *
 * ```ts
 * await recordAuthEvent(context.env.DB, context.request, {
 *   eventType: 'login',
 *   outcome: 'failure',
 *   failureReason: 'wrong_password',
 *   userId: identity?.user_id,  // optional, undefined if email not found
 * });
 * ```
 */
import type { D1Database } from '@cloudflare/workers-types';

export type AuthEventType =
  | 'signup'
  | 'login'
  | 'logout'
  | 'password_reset_request'
  | 'password_reset_complete'
  | 'oauth_authorize'
  | 'oauth_consent'
  | 'token_issue'
  | 'token_revoke'
  | 'rate_limited';

export type AuthEventOutcome = 'success' | 'failure';

export interface AuthAuditEvent {
  eventType: AuthEventType;
  outcome: AuthEventOutcome;
  userId?: string | null;
  clientId?: string | null;
  failureReason?: string | null;
  /** Free-form event-specific JSON serialised before INSERT. */
  metadata?: Record<string, unknown>;
  /** Correlation ID across multi-step OAuth flow (e.g. authorize → consent → token). */
  traceId?: string | null;
}

const USER_AGENT_MAX_LEN = 200;

/** SHA-256(ip) base64 — used as ip_hash column for privacy. */
async function hashIp(ip: string): Promise<string> {
  const bytes = new TextEncoder().encode(ip);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  const arr = new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i]!);
  return btoa(str);
}

/**
 * Record an auth event。**Never throws** — caller doesn't need try/catch。
 * Audit-write failure is logged via console.error 但不會影響 business flow。
 */
export async function recordAuthEvent(
  db: D1Database,
  request: Request,
  event: AuthAuditEvent,
): Promise<void> {
  try {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const ipHash = await hashIp(ip);
    const userAgent = (request.headers.get('User-Agent') ?? '').slice(0, USER_AGENT_MAX_LEN);

    await db
      .prepare(
        `INSERT INTO auth_audit_log
           (trace_id, event_type, outcome, user_id, client_id, ip_hash, user_agent, failure_reason, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        event.traceId ?? null,
        event.eventType,
        event.outcome,
        event.userId ?? null,
        event.clientId ?? null,
        ipHash,
        userAgent || null,
        event.failureReason ?? null,
        event.metadata ? JSON.stringify(event.metadata) : null,
      )
      .run();
  } catch (err) {
    // best-effort — log but don't propagate
    // eslint-disable-next-line no-console
    console.error('[_auth_audit] recordAuthEvent failed:', (err as Error).message);
  }
}
