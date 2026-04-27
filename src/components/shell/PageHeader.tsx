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
 */
import type { ReactNode } from 'react';
import Icon from '../shared/Icon';

export const PAGE_HEADER_STYLES = `
.tp-page-header {
  display: flex; align-items: center; gap: 12px;
  background: var(--color-background);
}
.tp-page-header-text {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column;
  gap: 2px;
  overflow: hidden;
}
.tp-page-header-eyebrow {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--color-muted);
}
.tp-page-header-h1 {
  margin: 0; font-weight: 800; letter-spacing: -0.02em;
  color: var(--color-foreground);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tp-page-header-meta {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}
.tp-page-header-actions {
  display: flex; align-items: center; gap: 6px;
  flex-shrink: 0;
}
.tp-page-header-back {
  width: 36px; height: 36px;
  border-radius: var(--radius-md);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  color: var(--color-foreground);
  display: grid; place-items: center;
  cursor: pointer; font: inherit;
  flex-shrink: 0;
  transition: border-color 120ms var(--transition-timing-function-apple),
              color 120ms var(--transition-timing-function-apple),
              background 120ms var(--transition-timing-function-apple);
}
.tp-page-header-back:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-subtle);
}
.tp-page-header-back:focus-visible {
  outline: 2px solid var(--color-accent); outline-offset: 2px;
}
.tp-page-header-back .svg-icon { width: 18px; height: 18px; }

/* Center align (Consent splash-style) */
.tp-page-header[data-align="center"] {
  flex-direction: column; align-items: center; text-align: center;
}
.tp-page-header[data-align="center"] .tp-page-header-text { align-items: center; }

/* ===== Desktop ≥761px — Variant A "Editorial Hairline" ===== */
@media (min-width: 761px) {
  .tp-page-header[data-variant="standalone"] {
    /* horizontal padding intentionally 0 — inherits from parent wrap (.tp-*-inner / .explore-wrap) */
    padding: 8px 0 20px;
    align-items: flex-end;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 24px;
  }
  .tp-page-header[data-variant="standalone"] .tp-page-header-h1 {
    font-size: var(--font-size-title);
  }
  .tp-page-header[data-variant="sticky"] {
    position: sticky; top: 0; z-index: var(--z-sticky-nav, 200);
    /* Defensive: prevent flex parent (e.g. .tp-embedded-trip = column flex) stretching
     * the sticky child cross-axis, which historically breaks Safari iOS sticky. */
    align-self: flex-start; width: 100%;
    height: 56px; padding: 0 24px;
    border-bottom: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-background) 94%, transparent);
    backdrop-filter: blur(var(--blur-glass, 14px));
    -webkit-backdrop-filter: blur(var(--blur-glass, 14px));
  }
  .tp-page-header[data-variant="sticky"] .tp-page-header-h1 {
    font-size: var(--font-size-headline);
  }
  .tp-page-header[data-variant="floating"] {
    position: absolute; top: 16px; left: 16px;
    max-width: 420px;
    padding: 12px 16px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    background: var(--color-background);
    box-shadow: var(--shadow-md);
  }
  .tp-page-header[data-variant="floating"] .tp-page-header-h1 {
    font-size: var(--font-size-callout);
  }
}

/* ===== Mobile ≤760px — Variant B "Mockup Canonical 56px" ===== */
@media (max-width: 760px) {
  .tp-page-header[data-variant="standalone"],
  .tp-page-header[data-variant="sticky"] {
    height: 56px; padding: 0 16px;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-background) 94%, transparent);
    backdrop-filter: blur(var(--blur-glass, 14px));
    -webkit-backdrop-filter: blur(var(--blur-glass, 14px));
  }
  .tp-page-header[data-variant="sticky"] {
    position: sticky; top: 0; z-index: var(--z-sticky-nav, 200);
  }
  .tp-page-header[data-variant="floating"] {
    position: absolute; top: 16px; left: 16px; right: 16px;
    max-width: 420px; height: 52px;
    padding: 0 14px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-background) 96%, transparent);
    box-shadow: var(--shadow-md);
  }
  .tp-page-header .tp-page-header-h1 {
    font-size: var(--font-size-headline);
  }
  .tp-page-header[data-variant="standalone"] .tp-page-header-text,
  .tp-page-header[data-variant="sticky"] .tp-page-header-text {
    flex-direction: row; align-items: center; gap: 10px;
  }
  /* Mobile actions 防呆：寬 picker（含長行程名）會擠掉 title。max-width 50% +
   * 內部子元素 min-width: 0 + overflow: hidden 讓 picker 自己截字。 */
  .tp-page-header-actions {
    max-width: 60%;
    min-width: 0;
  }
  .tp-page-header-actions > * {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* Mobile saves space: drop secondary text. Keep title as the page identity. */
  .tp-page-header[data-variant="standalone"] .tp-page-header-eyebrow,
  .tp-page-header[data-variant="standalone"] .tp-page-header-meta,
  .tp-page-header[data-variant="sticky"] .tp-page-header-eyebrow,
  .tp-page-header[data-variant="sticky"] .tp-page-header-meta {
    display: none;
  }
  /* center-align hero pages keep block layout even on mobile */
  .tp-page-header[data-align="center"] {
    height: auto; padding: 22px 16px 18px;
  }
  .tp-page-header[data-align="center"] .tp-page-header-text {
    flex-direction: column;
  }
  .tp-page-header[data-align="center"] .tp-page-header-eyebrow,
  .tp-page-header[data-align="center"] .tp-page-header-meta {
    display: block;
  }
}
`;

export type PageHeaderVariant = 'standalone' | 'sticky' | 'floating';
export type PageHeaderAlign = 'left' | 'center';

export interface PageHeaderProps {
  /** Layout variant. Default "standalone". */
  variant?: PageHeaderVariant;
  /** Text alignment. "center" used for splash-style hero pages (Consent). */
  align?: PageHeaderAlign;
  /** Uppercase letterspaced label above the title. Hidden on mobile (variants 1+2). */
  eyebrow?: string;
  /** Page title — primary identity. Always shown. */
  title: string;
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
    <>
      <style>{PAGE_HEADER_STYLES}</style>
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
    </>
  );
}
