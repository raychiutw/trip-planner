/**
 * PageErrorState — generic page-level error block (full-area replacement).
 *
 * 對齊 DESIGN.md 「Error & Status Messaging」：persistent surface（不用 toast）+
 * role="alert" + retry CTA。內部 child class 用 BEM-style derived from root className：
 * `<root>-title / <root>-desc / <root>-btn`，caller 提供 root class 即可（如 `favorites-error`
 * → 自動對應既有 `.favorites-error-title` / `.favorites-error-desc` / `.favorites-error-btn` CSS）。
 *
 * 與 ErrorPlaceholder 區別：後者是 trip-specific（含「回報問題」+ ApiError 物件），
 * 本 component 是 generic page-level（任何 page 都可用，不綁 ApiError class）。
 */
import type { ReactNode } from 'react';

export interface PageErrorStateProps {
  title?: string;
  message?: ReactNode;
  /** retry button label；傳 null 隱藏 button */
  retryLabel?: string | null;
  /** retry callback；不傳則不顯示 button */
  onRetry?: () => void;
  /** root className，預設 `tp-page-error`；child class 由此自動衍生 */
  className?: string;
  /** wrapper data-testid */
  testId?: string;
  /** retry button data-testid */
  retryTestId?: string;
}

export default function PageErrorState({
  title = '載入失敗',
  message = '資料暫時無法取得。你的內容仍在伺服器上。',
  retryLabel = '重試',
  onRetry,
  className = 'tp-page-error',
  testId,
  retryTestId,
}: PageErrorStateProps) {
  return (
    <div className={className} data-testid={testId} role="alert">
      <p className={`${className}-title`}>{title}</p>
      <p className={`${className}-desc`}>{message}</p>
      {onRetry && retryLabel !== null && (
        <button
          type="button"
          className={`${className}-btn`}
          onClick={onRetry}
          data-testid={retryTestId}
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
