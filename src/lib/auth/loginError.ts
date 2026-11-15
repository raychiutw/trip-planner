/**
 * 登入錯誤分類：LoginPage 與授權頁共用；只決定「是哪一種」，文案由各頁自己配。
 */
import { AuthError } from './client';

export type LoginErrorKind =
  | { kind: 'invalid' }
  | { kind: 'rate-limited'; retryAfter: number | undefined }
  | { kind: 'network' }
  | { kind: 'other'; code: string };

/**
 * statusFallback（預設 true，授權頁用）：錯誤碼未知時，再以 HTTP 401／429 判為 invalid／rate-limited。
 * LoginPage 傳 false：它只認錯誤碼（舊行為），狀態碼補判不可滲進去。
 */
export function classifyLoginError(err: unknown, { statusFallback = true }: { statusFallback?: boolean } = {}): LoginErrorKind {
  // 非 AuthError（例如 fetch 丟 TypeError）也是連不上
  if (!(err instanceof AuthError)) return { kind: 'network' };
  if (err.code === 'LOGIN_INVALID' || (statusFallback && err.status === 401)) return { kind: 'invalid' };
  if (err.code === 'LOGIN_RATE_LIMITED' || (statusFallback && err.status === 429)) return { kind: 'rate-limited', retryAfter: err.retryAfter };
  if (err.code === 'AUTH_NETWORK') return { kind: 'network' };
  return { kind: 'other', code: err.code };
}
