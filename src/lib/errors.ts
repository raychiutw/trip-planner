/**
 * 前端錯誤處理 — ApiError class + 錯誤分類引擎
 */
import { ErrorCode, ERROR_MESSAGES } from '../types/api';
import type { ErrorCodeType } from '../types/api';

export type ErrorSeverity = 'minor' | 'moderate' | 'severe' | 'background';

/** 結構化 API 錯誤（新格式 + 舊格式 sniff） */
export class ApiError extends Error {
  readonly code: ErrorCodeType;
  readonly status: number;
  readonly detail?: string;
  readonly severity: ErrorSeverity;
  /** v2.21.0: full response body for structured error payloads (e.g. 409 conflictWith). */
  readonly payload?: unknown;

  constructor(code: ErrorCodeType, status: number, detail?: string, payload?: unknown) {
    super(ERROR_MESSAGES[code] || code);
    // v2.33.38 round 3: cap code length too — malicious server could return
    // `{ error: { code: 'AUTH'.repeat(1e5) } }` and propagate giant string.
    this.code = typeof code === 'string' && code.length > 64
      ? (code.slice(0, 64) as ErrorCodeType)
      : code;
    this.status = status;
    // v2.33.36 security audit round 1: cap backend `detail` so a malicious
    // backend / SQL fragment leak / accidentally long error message can't
    // propagate full payload to Toast / Sentry. Strip newlines for one-line UI.
    this.detail = typeof detail === 'string'
      ? detail.replace(/[\r\n]+/g, ' ').slice(0, 200)
      : detail;
    this.payload = payload;
    this.severity = classifySeverity(this.code);
  }

  /** 從 fetch Response 解析（支援新舊格式） */
  static async fromResponse(res: Response): Promise<ApiError> {
    try {
      const body = await res.json() as Record<string, unknown>;

      // 新格式：{ error: { code, message, detail } }
      // v2.33.33: 後端的人話 message 可能在 `message` 也可能在 `detail` 欄位。
      // 兩個都嘗試 — `detail` 優先 (legacy)，`message` fallback (新後端 _errors.ts pattern)。
      if (body.error && typeof body.error === 'object') {
        const err = body.error as Record<string, unknown>;
        if (err.code && typeof err.code === 'string') {
          const detail = (err.detail as string | undefined) ?? (err.message as string | undefined);
          return new ApiError(
            err.code as ErrorCodeType,
            res.status,
            detail,
            body, // payload preserves full body for structured 409 etc.
          );
        }
      }

      // 舊格式：{ error: "string message" }
      if (typeof body.error === 'string') {
        const code = sniffErrorCode(res.status, body.error);
        return new ApiError(code, res.status, body.error, body);
      }

      return new ApiError(statusToCode(res.status), res.status, undefined, body);
    } catch {
      return new ApiError(statusToCode(res.status), res.status);
    }
  }

  /** 從 fetch 失敗（TypeError / AbortError）產生 */
  static fromNetworkError(err: unknown): ApiError {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return new ApiError('NET_TIMEOUT', 0);
    }
    if (!navigator.onLine) {
      return new ApiError('NET_OFFLINE', 0);
    }
    return new ApiError('NET_TIMEOUT', 0);
  }
}

/** 從 HTTP status 推斷錯誤碼（舊格式 fallback） */
function statusToCode(status: number): ErrorCodeType {
  if (status === 401) return 'AUTH_REQUIRED';
  if (status === 403) return 'PERM_DENIED';
  if (status === 404) return 'DATA_NOT_FOUND';
  if (status === 400) return 'DATA_VALIDATION';
  if (status === 409) return 'DATA_CONFLICT';
  if (status === 429) return 'SYS_RATE_LIMIT';
  return 'SYS_INTERNAL';
}

/**
 * 從舊格式的錯誤訊息 sniff 更精確的錯誤碼。
 * v2.33.38 round 3: 改 specific phrase match 避免「管理」誤命中
 * 「已系統管理員處理過」這類非權限訊息；「administered」誤命中 admin。
 * 不用 `\b` — JS regex word boundary 對 CJK 不適用（CJK 字符非 word char）。
 */
function sniffErrorCode(status: number, message: string): ErrorCodeType {
  const lower = message.toLowerCase();
  if (/\b(encoding|utf-?8)\b/.test(lower) || /亂碼/.test(message)) return 'DATA_ENCODING';
  // 管理員 / 管理者（zh-TW 兩種寫法）+ admin-only English variants。
  // 不用 `\b` — JS regex word boundary 對 CJK 不適用。
  if (/(admin[-\s_]?only|administrator only|僅(限)?管理(員|者)|管理(員|者)[僅只]限)/i.test(message)) {
    return 'PERM_ADMIN_ONLY';
  }
  if (/權限不足|無權限|forbidden|permission denied/i.test(message)) return 'PERM_DENIED';
  if (/已存在|already exists|\bconflict\b/i.test(message)) return 'DATA_CONFLICT';
  return statusToCode(status);
}

/** 錯誤碼 → 嚴重度 */
function classifySeverity(code: ErrorCodeType): ErrorSeverity {
  const prefix = code.split('_')[0];
  if (prefix === 'NET') return 'background';
  if (prefix === 'SYS') return 'severe';
  if (prefix === 'AUTH') return 'moderate';
  if (prefix === 'PERM') return 'moderate';
  if (code === 'DATA_NOT_FOUND') return 'severe';
  return 'minor';
}

export { ErrorCode, ERROR_MESSAGES };
export type { ErrorCodeType };
