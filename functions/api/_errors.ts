/**
 * _errors.ts — 結構化錯誤處理
 * handler 用 throw new AppError('CODE') 取代手動 json({error}, status)
 * middleware catch 用 instanceof AppError 判斷
 *
 * ## Error response shape conventions
 *
 * Two shapes coexist by design — pick based on who consumes the response:
 *
 * **RFC 6749 / 7009 OAuth wire endpoints** (`/oauth/authorize`, `/oauth/token`,
 * `/oauth/revoke`, `/oauth/consent`): use the flat `{ error, error_description }`
 * shape mandated by spec. Use `oauthErrorResponse(error, description, status)`.
 *
 * **Tripline user-facing endpoints** (signup / login / verify / forgot / reset /
 * connected-apps / dev-apps / sessions): use the nested
 * `{ error: { code, message } }` shape so the client can branch on a stable
 * machine code. `AppError` + `errorResponse(err)` produces this shape.
 *
 * `buildRateLimitResponse(status, retryAfter, ...)` exists below for the
 * cross-cutting "429 Retry-After" case.
 */
import { ERROR_MESSAGES } from '../../src/types/api';
import type { ErrorCodeType } from '../../src/types/api';

const STATUS_MAP: Partial<Record<ErrorCodeType, number>> = {
  AUTH_REQUIRED: 401,
  AUTH_EXPIRED: 401,
  AUTH_INVALID: 401,
  PERM_DENIED: 403,
  PERM_ADMIN_ONLY: 403,
  PERM_NOT_OWNER: 403,
  DATA_NOT_FOUND: 404,
  DATA_VALIDATION: 400,
  DATA_CONFLICT: 409,
  DATA_ENCODING: 400,
  DATA_SAVE_FAILED: 500,
  SYS_INTERNAL: 500,
  SYS_DB_ERROR: 503,
  SYS_RATE_LIMIT: 429,
  COMPANION_QUOTA_EXCEEDED: 409,
};

export class AppError extends Error {
  readonly code: ErrorCodeType;
  readonly status: number;
  readonly detail?: string;

  constructor(code: ErrorCodeType, detail?: string) {
    super(ERROR_MESSAGES[code] || code);
    this.code = code;
    this.status = STATUS_MAP[code] ?? 500;
    this.detail = detail;
  }
}

/** 將 AppError 轉為 JSON Response（user-facing nested shape） */
export function errorResponse(err: AppError): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: err.code,
        message: err.message,
        detail: err.detail || undefined,
      },
    }),
    {
      status: err.status,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

/**
 * RFC 6749 / 7009 OAuth wire endpoints emit `{error, error_description}` flat —
 * use this helper instead of inline `new Response(JSON.stringify(...))`.
 */
export function oauthErrorResponse(
  error: string,
  description: string,
  status = 400,
): Response {
  return new Response(
    JSON.stringify({ error, error_description: description }),
    {
      status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    },
  );
}

/**
 * 429 rate-limit response. Used by signup / login / forgot-password / token —
 * adds Retry-After header. `code` follows whichever shape the calling endpoint
 * uses (tripline-style `LOGIN_RATE_LIMITED` vs OAuth-style `rate_limited`).
 */
export function buildRateLimitResponse(
  retryAfterSeconds: number,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status: 429,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'Retry-After': String(retryAfterSeconds),
    },
  });
}
