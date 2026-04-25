/**
 * AppShell — app-wide layout primitive.
 *
 * Why hide sidebar/sheet via CSS instead of conditionally rendering on mobile:
 *   keeps component state alive across breakpoints (avoids unmount/mount side effects
 *   when users rotate device or resize viewport).
 */
import type { ReactNode } from 'react';

export const APP_SHELL_STYLES = `
.app-shell {
  display: grid;
  /* Lock to viewport so sidebar / main / sheet are real scroll containers
   * — grid rows can't grow with content, so each cell becomes its own
   * scroller, and one column scrolling doesn't drag the others. */
  height: 100dvh;
  background: var(--color-background);
  color: var(--color-foreground);
  grid-template-columns: 1fr;
  grid-template-rows: 1fr auto;
}

.app-shell-sidebar,
.app-shell-main,
.app-shell-sheet {
  overflow-y: auto;
  min-height: 0;
  /* Prevent scroll-chaining: when one column hits its end, mouse-wheel /
   * touch should not propagate to the other columns or the document. */
  overscroll-behavior: contain;
}

.app-shell-bottom-nav {
  position: sticky;
  inset-block-end: 0;
  z-index: var(--z-sticky-nav);
}

/* Desktop ≥1024px：grid 兩 / 三欄 */
@media (min-width: 1024px) {
  .app-shell[data-layout="3pane"] {
    grid-template-columns: var(--grid-3pane-desktop);
    grid-template-rows: 1fr;
  }
  .app-shell[data-layout="2pane"] {
    grid-template-columns: var(--grid-2pane-desktop);
    grid-template-rows: 1fr;
  }
  .app-shell-bottom-nav {
    display: none;
  }
}

/* Mobile <1024px：單欄 + bottom nav 常駐.
 *
 * Why height: 100dvh (not min-height): we need .app-shell-main to be a real
 * scroll container so sticky elements inside (like .ocean-day-strip) stick
 * to the top of main, not get carried away by the document scroll. With
 * min-height the grid grows with content, main isn't constrained, and the
 * window scrolls instead — breaking sticky inside main. */
@media (max-width: 1023px) {
  .app-shell-sidebar {
    display: none;
  }
  .app-shell-sheet {
    display: none;
  }
  .app-shell-main {
    /* Bottom-nav is in its own grid row, not overlapping main, so no
     * padding-bottom needed (was added previously when bottom-nav was a
     * fixed overlay). */
    padding-bottom: 0;
  }
}

/* Print mode：隱藏所有 shell chrome，main 單欄 */
body.print-mode .app-shell {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
}
body.print-mode .app-shell-sidebar,
body.print-mode .app-shell-sheet,
body.print-mode .app-shell-bottom-nav {
  display: none;
}
body.print-mode .app-shell-main {
  padding-bottom: 0;
}
@media print {
  .app-shell { grid-template-columns: 1fr; grid-template-rows: 1fr; }
  .app-shell-sidebar, .app-shell-sheet, .app-shell-bottom-nav { display: none; }
  .app-shell-main { padding-bottom: 0; }
}
`;

export const APP_SHELL_LAYOUT_3PANE = '3pane';
export const APP_SHELL_LAYOUT_2PANE = '2pane';
export type AppShellLayout = typeof APP_SHELL_LAYOUT_3PANE | typeof APP_SHELL_LAYOUT_2PANE;

export interface AppShellProps {
  /** 桌機左側 sidebar slot（mobile 隱藏） */
  sidebar: ReactNode;
  /** 主要內容區（必填，所有 viewport 都顯示） */
  main: ReactNode;
  /** 桌機右側 sheet slot（可選；不傳即 2-pane；mobile 隱藏） */
  sheet?: ReactNode;
  /** 手機底部 nav slot（可選；桌機隱藏） */
  bottomNav?: ReactNode;
}

export default function AppShell({ sidebar, main, sheet, bottomNav }: AppShellProps) {
  const layout: AppShellLayout = sheet ? APP_SHELL_LAYOUT_3PANE : APP_SHELL_LAYOUT_2PANE;
  return (
    <>
      <style>{APP_SHELL_STYLES}</style>
      <div className="app-shell" data-layout={layout} data-testid="app-shell">
        <aside className="app-shell-sidebar" data-testid="app-shell-sidebar">
          {sidebar}
        </aside>
        <main className="app-shell-main" data-testid="app-shell-main">
          {main}
        </main>
        {sheet && (
          <aside className="app-shell-sheet" data-testid="app-shell-sheet">
            {sheet}
          </aside>
        )}
        {bottomNav && (
          <nav className="app-shell-bottom-nav" data-testid="app-shell-bottom-nav" aria-label="主要功能">
            {bottomNav}
          </nav>
        )}
      </div>
    </>
  );
}
