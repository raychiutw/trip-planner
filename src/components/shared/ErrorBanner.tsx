/**
 * ErrorBanner — 統一的 page-level / form-level 錯誤訊息 banner。
 *
 * PR-U 2026-04-26：取代全站 12 種 `.tp-banner-error` / `.tp-error-banner` /
 * `.tp-trips-error` / `.tp-consent-error` / 等重複定義。Single source of truth
 * for static error display（非 transient — transient 用 `Toast`）。
 *
 * 使用：
 *   {error && <ErrorBanner message={error} testId="login-banner-error" />}
 *
 * 內建 `<Icon name="warning" />` + accessible `role="alert"` + destructive token
 * background/border。CSS 用 scoped style 注入，呼叫端不用自己定義 class。
 */
import Icon from './Icon';

export interface ErrorBannerProps {
  message: string;
  testId?: string;
  /** Optional className extension（例：自訂 margin / max-width） */
  className?: string;
}

const SCOPED_STYLES = `
.tp-error-banner-shared {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px 14px;
  background: var(--color-destructive-bg);
  border: 1px solid var(--color-destructive);
  border-radius: var(--radius-md);
  color: var(--color-destructive);
  font-size: var(--font-size-subheadline);
  line-height: 1.5;
}
.tp-error-banner-shared .svg-icon {
  width: 18px; height: 18px;
  flex-shrink: 0;
  margin-top: 1px;
}
.tp-error-banner-shared .msg { flex: 1; min-width: 0; }
`;

export default function ErrorBanner({ message, testId, className = '' }: ErrorBannerProps) {
  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div
        className={`tp-error-banner-shared ${className}`.trim()}
        role="alert"
        data-testid={testId}
      >
        <Icon name="warning" />
        <span className="msg">{message}</span>
      </div>
    </>
  );
}
