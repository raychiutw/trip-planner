/**
 * AppShell — B-P2 §2 layout primitive
 *
 * 桌機 ≥1024px：CSS Grid 三欄（3-pane）或兩欄（2-pane，無 sheet）
 *   3-pane: var(--grid-3pane-desktop) = 240px sidebar | 1fr main | min(780px, 40vw) sheet
 *   2-pane: var(--grid-2pane-desktop) = 240px sidebar | 1fr main
 *
 * 手機 <1024px：單欄 main + sticky bottom nav
 *   sidebar / sheet 仍 render 在 DOM（CSS display:none 隱藏）— 避免 unmount/mount 副作用
 *   main 自動加 padding-bottom: var(--nav-height-mobile) 讓內容不被 nav 蓋
 *
 * 視覺對應：docs/design-sessions/mockup-trip-v2.html
 */
import type { ReactNode } from 'react';

export const APP_SHELL_STYLES = `
.app-shell {
  display: grid;
  min-height: 100dvh;
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

/* Mobile <1024px：單欄 + bottom nav 常駐 */
@media (max-width: 1023px) {
  .app-shell-sidebar {
    display: none;
  }
  .app-shell-sheet {
    display: none;
  }
  .app-shell-main {
    padding-bottom: var(--nav-height-mobile);
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
  const layout = sheet ? '3pane' : '2pane';
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
