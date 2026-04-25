/**
 * Placeholder — shared placeholder page for routes not yet implemented.
 *
 * Consolidates the eyebrow + hero + CTA pattern used by ChatPage / ExplorePage /
 * GlobalMapPage / LoginPage so CSS + markup live in one place.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

const PLACEHOLDER_STYLES = `
.tp-placeholder {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 60vh; padding: 48px 24px; text-align: center;
  color: var(--color-foreground);
}
.tp-placeholder .ph-eyebrow {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--color-muted); margin-bottom: 12px;
}
.tp-placeholder h1 {
  font-size: var(--font-size-title); font-weight: 800;
  letter-spacing: -0.02em; margin-bottom: 12px;
}
.tp-placeholder .ph-sub {
  font-size: var(--font-size-callout); color: var(--color-muted);
  max-width: 480px; margin-bottom: 28px;
}
.tp-placeholder .ph-cta {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 12px 20px; border-radius: var(--radius-full);
  background: var(--color-accent); color: var(--color-accent-foreground);
  text-decoration: none;
  font: inherit; font-size: 14px; font-weight: 600;
  min-height: var(--spacing-tap-min);
}
.tp-placeholder .ph-cta:hover { filter: brightness(var(--hover-brightness)); }
`;

export interface PlaceholderProps {
  /** Small uppercase label above the title (e.g., "Coming soon · Phase 3"). */
  eyebrow: ReactNode;
  /** Page title. */
  title: ReactNode;
  /** One-line description below the title. */
  body: ReactNode;
  /** Primary CTA href (react-router Link). Defaults to `/trips`. */
  ctaHref?: string;
  /** CTA label. Defaults to 「前往我的行程」. */
  ctaLabel?: ReactNode;
  /** `data-testid` on the root for integration tests. */
  testId?: string;
}

export default function Placeholder({
  eyebrow,
  title,
  body,
  ctaHref = '/trips',
  ctaLabel = '前往我的行程',
  testId,
}: PlaceholderProps) {
  return (
    <div className="tp-placeholder" data-testid={testId}>
      <style>{PLACEHOLDER_STYLES}</style>
      <div className="ph-eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p className="ph-sub">{body}</p>
      <Link to={ctaHref} className="ph-cta">{ctaLabel}</Link>
    </div>
  );
}
