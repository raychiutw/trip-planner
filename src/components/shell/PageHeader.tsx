/**
 * PageHeader — unified app-wide page heading primitive.
 *
 * Hybrid design (settled 2026-04-27 after mockup-page-header-v1.html review):
 *   - Desktop ≥761px: Variant A "Editorial Hairline" — large title (28px standalone /
 *     17px sticky), eyebrow above, hairline bottom border, no shadow on standalone.
 *   - Mobile ≤760px: Variant B "Mockup Canonical 56px" — every header collapses to
 *     a 56px glass strip with 17px headline. Eyebrow + meta hidden to save space;
 *     the title carries the page identity. Mirrors `.mobile-topbar` in
 *     mockup-trip-v2.html line 438.
 *
 * Variants:
 *   - standalone: inline at top of page (default)
 *   - sticky:     position: sticky top 0, glass blur, hairline
 *   - floating:   absolute floating card overlay (e.g. GlobalMap trip switcher)
 *
 * align="center" supported for splash-style pages (Consent).
 *
 * CSS lives in css/tokens.css under the "===== PageHeader =====" block —
 * single source of truth per CLAUDE.md「唯一 CSS」convention.
 */
import type { ReactNode } from 'react';
import Icon from '../shared/Icon';

export type PageHeaderVariant = 'standalone' | 'sticky' | 'floating';
export type PageHeaderAlign = 'left' | 'center';

export interface PageHeaderProps {
  /** Layout variant. Default "standalone". */
  variant?: PageHeaderVariant;
  /** Text alignment. "center" used for splash-style hero pages (Consent). */
  align?: PageHeaderAlign;
  /** Uppercase letterspaced label above the title. Hidden on mobile (variants 1+2). */
  eyebrow?: string;
  /** Page title — primary identity. Always shown. ReactNode allows inline accent
   *  spans / `<br/>` for hero-style pages（e.g. ConsentPage）. Plain string is the
   *  common case; JSX children must respect the parent ellipsis styling. */
  title: ReactNode;
  /** Subtitle / count line below title. Hidden on mobile. */
  meta?: ReactNode;
  /** When provided, shows a 36×36 back button left of the title. */
  back?: () => void;
  /** Right-side action slot (buttons, dropdowns, picker). */
  actions?: ReactNode;
  /** aria-label for the back button. Default 「返回」. */
  backLabel?: string;
}

export default function PageHeader({
  variant = 'standalone',
  align = 'left',
  eyebrow,
  title,
  meta,
  back,
  actions,
  backLabel = '返回',
}: PageHeaderProps) {
  return (
    <header className="tp-page-header" data-variant={variant} data-align={align}>
      {back && (
        <button
          type="button"
          className="tp-page-header-back"
          onClick={back}
          aria-label={backLabel}
        >
          <Icon name="arrow-left" />
        </button>
      )}
      <div className="tp-page-header-text">
        {eyebrow && <div className="tp-page-header-eyebrow">{eyebrow}</div>}
        <h1 className="tp-page-header-h1">{title}</h1>
        {meta && <div className="tp-page-header-meta">{meta}</div>}
      </div>
      {actions && <div className="tp-page-header-actions">{actions}</div>}
    </header>
  );
}
