/**
 * AppShell — app-wide layout primitive.
 *
 * Why hide sidebar/sheet via CSS instead of conditionally rendering on mobile:
 *   keeps component state alive across breakpoints (avoids unmount/mount side effects
 *   when users rotate device or resize viewport).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

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

/* Pull-to-refresh visual indicator. iOS Safari 對 inner scroll container 沒 native
 * pull-to-refresh，自己 implement。indicator 在 main 頂端，translate by pullPx。 */
.app-shell-ptr {
  position: absolute;
  top: 0; left: 50%;
  transform: translate(-50%, calc(-100% + var(--ptr-pull-px, 0px)));
  display: flex; align-items: center; justify-content: center;
  width: 40px; height: 40px;
  border-radius: 50%;
  background: var(--color-background);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  pointer-events: none;
  opacity: calc(var(--ptr-pull-px, 0px) / 80);
  transition: opacity var(--transition-duration-normal) ease-out;
  z-index: 1;
}
.app-shell-ptr-spinner {
  width: 20px; height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  transform: rotate(calc(var(--ptr-pull-px, 0px) * 4.5deg));
  /* 80ms 為 PTR spinner pixel-to-rotation 物理同步速率（pull 距離 × 4.5deg），
     非標準互動 transition；H2 explicit exception。 */
  transition: transform 80ms ease-out;
}
.app-shell-ptr[data-refreshing="true"] .app-shell-ptr-spinner {
  animation: app-shell-ptr-spin 0.8s linear infinite;
}
@keyframes app-shell-ptr-spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .app-shell-ptr[data-refreshing="true"] .app-shell-ptr-spinner { animation: none; }
}

/* main 拉動位移（pull friction）。transform 同時讓 PTR indicator 跟內容一起下拉。
 *
 * will-change: transform 只在 data-pulling="true" 時 enable。全時 enable 會讓
 * main 永遠變 stacking context + containing block for position: fixed descendants,
 * 導致 sibling .app-shell-bottom-nav (z=200) 整個蓋過 main (z auto), 而 main 內
 * .tp-page-bottom-bar (z=210) 被 scope 到 main 內部 stacking context → mobile
 * 上 form confirm button 被 bottom-nav 攔截 pointer events (22+ master CI runs
 * e2e flake root cause)。Pulling 期間才提示瀏覽器把 main 升 GPU layer。 */
.app-shell-main {
  position: relative;
  transition: transform var(--transition-duration-normal) ease-out;
}
.app-shell-main[data-pulling="true"] {
  transition: none;
  will-change: transform;
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
  /* rev2 owner 2026-07-17：桌機底部浮動玻璃膠囊 nav（取代 sidebar primary nav）。
   * 置中於 sidebar+中欄（避開右欄地圖/面板儲存鈕，實測整窗置中會壓右欄鈕）；
   * 桌機為主要導覽，不隨捲動隱藏。膠囊本體樣式在 GlobalBottomNav @≥1024 覆蓋。 */
  .app-shell-bottom-nav {
    inset-inline: auto;
    left: calc((100vw + var(--sidebar-width-desktop, 216px)) / 4);
    transform: translateX(-50%);
    bottom: 18px;
    width: auto;
  }
  .app-shell-bottom-nav[data-hidden="true"] {
    transform: translateX(-50%);
  }
}

/* Mobile <1024px：單欄 + bottom nav 常駐.
 *
 * Why height: 100dvh (not min-height): we need .app-shell-main to be a real
 * scroll container so sticky elements inside (like TitleBar + .tp-map-day-tabs)
 * stick to the top of main, not get carried away by the document scroll. With
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

/* rev2 owner 2026-07-18「6 條全接」：操作頁在右欄 sheet 當 bare panel 時，其
 * .tp-page-bottom-bar 預設是整頁 position:fixed(left:240 → right)，會橫跨中欄。
 * 在 sheet 內改 sticky → 收進 panel 寬度、貼 panel 底（panel 本身即 scroll 容器）。 */
@media (min-width: 1024px) {
  .app-shell-sheet .tp-page-bottom-bar {
    position: sticky;
    left: auto;
    right: auto;
  }
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
  /**
   * 桌機右側 sheet 的 React Portal target ID（v2.31.46 #143）。
   * 設定後即使 `sheet` 為空也 render `<aside id={sheetPortalId}>` 並 layout
   * 用 3-pane，讓 child component（embedded TripPage）可以 createPortal
   * 推內容過來。避開 v2.31.41 callback prop + setState-from-effect 引發的
   * strict mode 雙倍 fire / infinite re-render。
   */
  sheetPortalId?: string;
  /** 手機底部 nav slot（可選；桌機隱藏） */
  bottomNav?: ReactNode;
}

/* PR-VV 2026-04-27：scroll-direction-aware bottom-nav。向下捲 → hide
 * (translateY 100%)，向上捲 → show。8px threshold 避免抖動，60px top 緩衝
 * 避免最頂端就觸發 hide。passive listener (RBP 規定)。 */
const SCROLL_THRESHOLD_PX = 8;
const SCROLL_TOP_BUFFER_PX = 60;

export default function AppShell({ sidebar, main, sheet, sheetPortalId, bottomNav }: AppShellProps) {
  const layout: AppShellLayout = (sheet || sheetPortalId) ? APP_SHELL_LAYOUT_3PANE : APP_SHELL_LAYOUT_2PANE;
  const mainRef = useRef<HTMLElement>(null);
  const [navHidden, setNavHidden] = useState(false);
  const lastYRef = useRef(0);

  // Pull-to-refresh：scrollTop=0 時拖下 80px+ → reload
  const onRefresh = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, []);
  const { pullPx, refreshing } = usePullToRefresh(mainRef, onRefresh);

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
    return () => {
      el.removeEventListener('scroll', onScroll);
      // v2.33.45 round 6b: reset lastYRef on cleanup — bottomNav 切換移除 +
      // 重 mount 時，舊 scrollTop 值會留 staticked。
      lastYRef.current = 0;
    };
  }, [bottomNav]);

  return (
    <>
      <style>{APP_SHELL_STYLES}</style>
      <div className="app-shell" data-layout={layout} data-testid="app-shell">
        <aside className="app-shell-sidebar" data-testid="app-shell-sidebar">
          {sidebar}
        </aside>
        <main
          ref={mainRef}
          className="app-shell-main"
          data-testid="app-shell-main"
          data-pulling={pullPx > 0 && !refreshing ? 'true' : 'false'}
          style={{
            transform: pullPx > 0 ? `translateY(${pullPx}px)` : undefined,
            // Pass pullPx to .app-shell-ptr CSS via custom property
            ['--ptr-pull-px' as string]: `${pullPx}px`,
          }}
        >
          {/* Pull-to-refresh visual indicator — only visible when pulled */}
          {(pullPx > 0 || refreshing) && (
            <div
              className="app-shell-ptr"
              data-testid="app-shell-ptr"
              data-refreshing={refreshing ? 'true' : 'false'}
              aria-hidden={!refreshing}
            >
              <div className="app-shell-ptr-spinner" />
            </div>
          )}
          {main}
        </main>
        {(sheet || sheetPortalId) && (
          <aside className="app-shell-sheet" data-testid="app-shell-sheet" id={sheetPortalId}>
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
