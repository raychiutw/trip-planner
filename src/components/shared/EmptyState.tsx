/**
 * EmptyState — generic empty-pool block with optional CTA.
 *
 * 對齊 DESIGN.md mockup `tp-empty-cta` token：dashed border + accent CTA。
 * 用於「還沒有收藏」「還沒有任何行程」這類 zero-data 狀態。
 *
 * 內部 child class 沿用既有 PoiFavoritesPage convention：
 *   `.empty-eyebrow / .empty-title / .empty-cta-btn`（caller-side CSS 已存在）。
 * AddPoiFavoriteToTripPage 用 generic `.tp-empty-cta`（無 child rule，仍 work）。
 *
 * CTA 可選 href（anchor）或 onCta（button）。href 優先；都沒給就不顯示 CTA。
 */
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** 上方 eyebrow（小寫英文 + letter-spacing），可選 */
  eyebrow?: string;
  /** 主標題（h2 等級） */
  title: string;
  /** 副標題說明 */
  message?: ReactNode;
  /** CTA label；不傳則不顯示 CTA */
  ctaLabel?: string;
  /** CTA href（如 `/explore`），navigate 用 anchor */
  ctaHref?: string;
  /** CTA onClick（如果不用 anchor） */
  onCta?: () => void;
  /** wrapper className，預設 `tp-empty-cta` */
  className?: string;
  /** wrapper data-testid */
  testId?: string;
  /** CTA testid */
  ctaTestId?: string;
}

export default function EmptyState({
  eyebrow,
  title,
  message,
  ctaLabel,
  ctaHref,
  onCta,
  className = 'tp-empty-cta',
  testId,
  ctaTestId,
}: EmptyStateProps) {
  const showCta = ctaLabel && (ctaHref || onCta);
  return (
    <div className={className} data-testid={testId}>
      {eyebrow && <span className="empty-eyebrow">{eyebrow}</span>}
      <h2 className="empty-title">{title}</h2>
      {message && <p className="empty-message">{message}</p>}
      {showCta && (
        ctaHref && !onCta ? (
          <a className="empty-cta-btn" href={ctaHref} data-testid={ctaTestId}>
            {ctaLabel}
          </a>
        ) : (
          <button
            type="button"
            className="empty-cta-btn"
            onClick={onCta}
            data-testid={ctaTestId}
          >
            {ctaLabel}
          </button>
        )
      )}
    </div>
  );
}
