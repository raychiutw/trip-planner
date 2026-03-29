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

  constructor(code: ErrorCodeType, status: number, detail?: string) {
    super(ERROR_MESSAGES[code] || code);
    this.code = code;
    this.status = status;
    this.detail = detail;
    this.severity = classifySeverity(code);
  }

  /** 從 fetch Response 解析（支援新舊格式） */
  static async fromResponse(res: Response): Promise<ApiError> {
    try {
      const body = await res.json() as Record<string, unknown>;

      // 新格式：{ error: { code, message, detail } }
      if (body.error && typeof body.error === 'object') {
        const err = body.error as Record<string, unknown>;
        if (err.code && typeof err.code === 'string') {
          return new ApiError(
            err.code as ErrorCodeType,
            res.status,
            err.detail as string | undefined,
          );
        }
      }

      // 舊格式：{ error: "string message" }
      if (typeof body.error === 'string') {
        const code = sniffErrorCode(res.status, body.error);
        return new ApiError(code, res.status, body.error);
      }

      return new ApiError(statusToCode(res.status), res.status);
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

/** 從舊格式的錯誤訊息 sniff 更精確的錯誤碼 */
function sniffErrorCode(status: number, message: string): ErrorCodeType {
  const lower = message.toLowerCase();
  if (lower.includes('encoding') || lower.includes('utf')) return 'DATA_ENCODING';
  if (lower.includes('亂碼')) return 'DATA_ENCODING';
  if (lower.includes('管理') || lower.includes('admin')) return 'PERM_ADMIN_ONLY';
  if (lower.includes('權限')) return 'PERM_DENIED';
  if (lower.includes('已存在') || lower.includes('conflict')) return 'DATA_CONFLICT';
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
