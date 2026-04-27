/**
 * AppShell — app-wide layout primitive.
 *
 * Why hide sidebar/sheet via CSS instead of conditionally rendering on mobile:
 *   keeps component state alive across breakpoints (avoids unmount/mount side effects
 *   when users rotate device or resize viewport).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

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
  grid-template-rows: 1fr;
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

/* PR-VV 2026-04-27：bottom-nav 改 position: fixed overlay（從 grid row）。
 * 原 grid row 結構無法 transform-hide（row 仍佔空間），改 fixed 才能 slide
 * down 完全消失。Main 加 padding-bottom 對應 nav 高度避免 content 被遮。 */
.app-shell-bottom-nav {
  position: fixed;
  inset-block-end: 0;
  inset-inline: 0;
  z-index: var(--z-sticky-nav);
  transform: translateY(0);
  transition: transform var(--transition-duration-normal, 250ms) var(--transition-timing-function-apple, cubic-bezier(0.2, 0.8, 0.2, 1));
}
.app-shell-bottom-nav[data-hidden="true"] {
  transform: translateY(100%);
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
    /* PR-VV：bottom-nav 是 fixed overlay 蓋在 main 底部，加 padding-bottom
     * 對應 --nav-height-mobile 避免 content 被遮（reserve space for nav）。 */
    padding-bottom: var(--nav-height-mobile, 88px);
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

/* PR-VV 2026-04-27：scroll-direction-aware bottom-nav。向下捲 → hide
 * (translateY 100%)，向上捲 → show。8px threshold 避免抖動，60px top 緩衝
 * 避免最頂端就觸發 hide。passive listener (RBP 規定)。 */
const SCROLL_THRESHOLD_PX = 8;
const SCROLL_TOP_BUFFER_PX = 60;

export default function AppShell({ sidebar, main, sheet, bottomNav }: AppShellProps) {
  const layout: AppShellLayout = sheet ? APP_SHELL_LAYOUT_3PANE : APP_SHELL_LAYOUT_2PANE;
  const mainRef = useRef<HTMLElement>(null);
  const [navHidden, setNavHidden] = useState(false);
  const lastYRef = useRef(0);

  useEffect(() => {
    const el = mainRef.current;
    if (!el || !bottomNav) return;
    function onScroll() {
      const target = mainRef.current;
      if (!target) return;
      const y = target.scrollTop;
      const dy = y - lastYRef.current;
      if (Math.abs(dy) < SCROLL_THRESHOLD_PX) return;
      if (dy > 0 && y > SCROLL_TOP_BUFFER_PX) {
        setNavHidden(true);
      } else if (dy < 0) {
        setNavHidden(false);
      }
      lastYRef.current = y;
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [bottomNav]);

  return (
    <>
      <style>{APP_SHELL_STYLES}</style>
      <div className="app-shell" data-layout={layout} data-testid="app-shell">
        <aside className="app-shell-sidebar" data-testid="app-shell-sidebar">
          {sidebar}
        </aside>
        <main ref={mainRef} className="app-shell-main" data-testid="app-shell-main">
          {main}
        </main>
        {sheet && (
          <aside className="app-shell-sheet" data-testid="app-shell-sheet">
            {sheet}
          </aside>
        )}
        {bottomNav && (
          <nav
            className="app-shell-bottom-nav"
            data-testid="app-shell-bottom-nav"
            data-hidden={navHidden ? 'true' : 'false'}
            aria-label="主要功能"
          >
            {bottomNav}
          </nav>
        )}
      </div>
    </>
  );
}
