/**
 * 表單頁標題列下方的兩個元件（#1559）：
 *   - FormSummaryBar：sticky 摘要列（計數／行程摘要／自動儲存狀態），樣式 `.tp-form-summary`
 *   - FormErrorBanner：標題列正下方的 `role="alert"` 錯誤橫幅，樣式 `.tp-form-error-banner`
 * 樣式都在 css/tokens.css。OperationShell（桌機右欄／手機下鑽）與 NewTripPage（AppShell + TitleBar）共用。
 */
import { useEffect, useRef, type ReactNode } from 'react';

export function FormSummaryBar({ children }: { children: ReactNode }) {
  return (
    <div className="tp-form-summary" data-testid="form-summary">
      <div className="tp-form-summary-text">{children}</div>
    </div>
  );
}

export function FormErrorBanner({ message, testId }: { message: string; testId?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  // 錯誤出現時把橫幅捲進可視範圍，避免使用者捲在下方看不到失敗。
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [message]);
  return (
    <p ref={ref} className="tp-form-error-banner" role="alert" data-testid={testId}>
      {message}
    </p>
  );
}
