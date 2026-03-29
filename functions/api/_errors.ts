/**
 * _errors.ts — 結構化錯誤處理
 * handler 用 throw new AppError('CODE') 取代手動 json({error}, status)
 * middleware catch 用 instanceof AppError 判斷
 */
import { ErrorCode, ERROR_MESSAGES } from '../../src/types/api';
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

/** 將 AppError 轉為 JSON Response */
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

export { ErrorCode };
