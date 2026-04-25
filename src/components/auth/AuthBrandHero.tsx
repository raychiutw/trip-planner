/**
 * AuthBrandHero — desktop right-pane brand hero for auth pages
 *
 * Shows on ≥1024px only (display:none below). Mirrors mockup-{login|signup|
 * forgot}-v2.html aside-* pattern. Used by SignupPage / ForgotPasswordPage /
 * ResetPasswordPage / EmailVerifyPendingPage. (LoginPage uses an inline copy
 * of this pattern — folded into shared component in a future cleanup PR.)
 *
 * Layout responsibility split:
 *   - This component: brand hero <aside> + its scoped styles
 *   - Caller page: shell-level grid (1fr/1fr ≥1024px) and form-side wrapper.
 *     See `AUTH_LAYOUT_STYLES` for the snippet pages embed in their SCOPED_STYLES.
 */
import type { ReactNode } from 'react';

/**
 * Styles a page must include in its SCOPED_STYLES so the brand hero sits
 * correctly next to the form card. Pages already define `.tp-{ns}-shell` and
 * a `tp-{ns}-form-side` wrapper — `ns` is `auth` or `verify` depending on the
 * page's existing class prefix.
 */
export const AUTH_LAYOUT_STYLES = `
.tp-auth-form-side, .tp-verify-form-side {
  width: 100%;
  display: flex; align-items: center; justify-content: center;
}
@media (min-width: 1024px) {
  .tp-auth-shell, .tp-verify-shell {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: stretch;
    padding: 0;
  }
  .tp-auth-form-side, .tp-verify-form-side {
    padding: 48px;
  }
}
`;

const HERO_STYLES = `
.tp-auth-brand-hero {
  display: none;
  background: linear-gradient(135deg, var(--color-foreground) 0%, var(--color-accent-deep, #B85C2E) 100%);
  color: var(--color-background);
  padding: 56px 48px;
  position: relative;
  overflow: hidden;
  flex-direction: column;
  justify-content: space-between;
}
@media (min-width: 1024px) {
  .tp-auth-brand-hero { display: flex; }
}
.tp-auth-brand-hero::before {
  content: '';
  position: absolute;
  top: -100px; right: -100px;
  width: 400px; height: 400px;
  border-radius: 50%;
  background: rgba(247, 223, 203, 0.1);
  pointer-events: none;
}
.tp-auth-brand-hero::after {
  content: '';
  position: absolute;
  bottom: -80px; left: -80px;
  width: 300px; height: 300px;
  border-radius: 50%;
  background: rgba(217, 120, 72, 0.18);
  pointer-events: none;
}
.tp-bs-eyebrow {
  font-size: var(--font-size-eyebrow);
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  opacity: 0.7;
  position: relative; z-index: 2;
}
.tp-bs-display {
  font-size: 38px; font-weight: 900;
  letter-spacing: -0.03em; line-height: 1.1;
  margin: 16px 0 24px;
  position: relative; z-index: 2;
  max-width: 400px;
}
.tp-bs-sub {
  font-size: 15px; line-height: 1.6;
  opacity: 0.85;
  max-width: 380px;
  margin-bottom: 24px;
  position: relative; z-index: 2;
}
.tp-bs-features {
  display: flex; flex-direction: column;
  gap: 18px;
  position: relative; z-index: 2;
}
.tp-bs-feature {
  display: flex; gap: 14px;
  align-items: flex-start;
}
.tp-bs-feature .tp-feat-icon {
  width: 36px; height: 36px;
  border-radius: 8px;
  background: rgba(255, 251, 245, 0.12);
  display: grid; place-items: center;
  flex-shrink: 0;
  color: var(--color-background);
}
.tp-bs-feature .tp-feat-icon svg {
  width: 18px; height: 18px;
  stroke: currentColor; fill: none;
  stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
}
.tp-bs-feature .tp-feat-body { padding-top: 4px; }
.tp-bs-feature .tp-feat-title {
  font-size: 15px; font-weight: 700;
  letter-spacing: -0.005em;
}
.tp-bs-feature .tp-feat-desc {
  font-size: 13px; opacity: 0.78;
  margin-top: 2px; line-height: 1.5;
}
.tp-bs-footnote {
  font-size: 11px;
  opacity: 0.6;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 600;
  position: relative; z-index: 2;
}
`;

export interface HeroItem {
  /** Inner SVG content (paths/circles) — the wrapper svg + viewBox is provided */
  icon: ReactNode;
  title: string;
  desc: string;
}

export interface AuthBrandHeroProps {
  eyebrow: string;
  headline: ReactNode;
  sub?: string;
  items: HeroItem[];
  footnote?: string;
}

export default function AuthBrandHero({ eyebrow, headline, sub, items, footnote }: AuthBrandHeroProps) {
  return (
    <>
      <style>{HERO_STYLES}</style>
      <aside className="tp-auth-brand-hero" data-testid="auth-brand-hero" aria-hidden="true">
        <div className="tp-bs-eyebrow">{eyebrow}</div>
        <div>
          <h2 className="tp-bs-display">{headline}</h2>
          {sub && <p className="tp-bs-sub">{sub}</p>}
          <div className="tp-bs-features">
            {items.map((item, i) => (
              <div className="tp-bs-feature" key={i}>
                <div className="tp-feat-icon">
                  <svg viewBox="0 0 24 24">{item.icon}</svg>
                </div>
                <div className="tp-feat-body">
                  <div className="tp-feat-title">{item.title}</div>
                  <div className="tp-feat-desc">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {footnote && <div className="tp-bs-footnote">{footnote}</div>}
      </aside>
    </>
  );
}
