/**
 * InlineError — 表單欄位下方 / 小範圍 inline 錯誤訊息（紅色 footnote 字 +
 * `role="alert"`）。Pair with `ErrorBanner` for page-level errors。
 *
 * PR-U 2026-04-26：取代全站零散的 `.tp-error` / `.tp-inline-add-error` /
 * `.tp-new-modal-error` / `.tp-rail-note-error` 等 inline error class。
 *
 * 使用：
 *   {emailError && <InlineError message={emailError} testId="signup-email-error" />}
 */

export interface InlineErrorProps {
  message: string;
  testId?: string;
  className?: string;
}

const SCOPED_STYLES = `
.tp-inline-error-shared {
  margin: 4px 0 0;
  font-size: var(--font-size-footnote);
  color: var(--color-destructive);
  line-height: 1.4;
}
`;

export default function InlineError({ message, testId, className = '' }: InlineErrorProps) {
  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <p
        className={`tp-inline-error-shared ${className}`.trim()}
        role="alert"
        data-testid={testId}
      >
        {message}
      </p>
    </>
  );
}
