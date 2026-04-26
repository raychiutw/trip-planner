/**
 * ThemeToggle — 3-way 深淺模式 segmented control（淺 / 自動 / 深）.
 *
 * Used by DesktopSidebar (bottom CTA) and SessionsPage (mobile 帳號 entry).
 * Backed by useDarkMode — writes to localStorage('color-mode'), toggles
 * `body.dark`, and updates <meta name="theme-color">.
 */
import { useDarkMode } from '../../hooks/useDarkMode';

const SCOPED_STYLES = `
.tp-theme-toggle {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 4px;
  background: var(--color-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
}
.tp-theme-toggle-btn {
  border: none; background: transparent;
  font: inherit; font-size: var(--font-size-caption2); font-weight: 600;
  padding: 6px 8px; border-radius: var(--radius-full);
  cursor: pointer; color: var(--color-muted);
  transition: background 120ms, color 120ms;
  min-height: 32px;
}
.tp-theme-toggle-btn:hover:not([aria-pressed="true"]) { color: var(--color-foreground); }
.tp-theme-toggle-btn[aria-pressed="true"] {
  /* QA 2026-04-26 BUG-006：跟 NewTripModal segmented 一致 — accent border +
   * shadow-md，active 一眼看得出。原 shadow-sm 對比度不足。 */
  background: var(--color-background);
  color: var(--color-accent-deep);
  box-shadow: var(--shadow-md), inset 0 0 0 1.5px var(--color-accent);
}
`;

const OPTIONS: Array<{ key: 'light' | 'auto' | 'dark'; label: string }> = [
  { key: 'light', label: '淺' },
  { key: 'auto', label: '自動' },
  { key: 'dark', label: '深' },
];

export interface ThemeToggleProps {
  /** Optional testId prefix; defaults to "theme". */
  testId?: string;
}

export default function ThemeToggle({ testId = 'theme' }: ThemeToggleProps = {}) {
  const { colorMode, setColorMode } = useDarkMode();
  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <div className="tp-theme-toggle" role="group" aria-label="深淺模式" data-testid={`${testId}-toggle`}>
        {OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            className="tp-theme-toggle-btn"
            aria-pressed={colorMode === o.key}
            onClick={() => setColorMode(o.key)}
            data-testid={`${testId}-${o.key}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </>
  );
}
