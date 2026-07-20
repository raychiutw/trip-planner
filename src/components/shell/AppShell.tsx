/**
 * AppShell — app-wide layout primitive.
 *
 * Why hide sidebar/sheet via CSS instead of conditionally rendering on mobile:
 *   keeps component state alive across breakpoints (avoids unmount/mount side effects
 *   when users rotate device or resize viewport).
 */
import { useCallback, useRef, type ReactNode } from 'react';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

export const APP_SHELL_STYLES = `
.app-shell {
  display: grid;
  /* 透明底部 tab 疊在內容之上的高度（owner 2026-07-20「全版」）。預設 0 —— 桌機（tab 隱藏）
   * 與操作頁 drill-down（不顯 tab）都不需讓位；手機且有 tab 時由下方 media query 覆寫。
   * 只有「底部有互動元件、被 tab 蓋住會壞掉」的頁面才需要 padding-bottom: var(--nav-overlay-h)。 */
  --nav-overlay-h: 0px;
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
/* 底部 nav 是**浮動玻璃膠囊**（非滿版 bar）→ fixed 置中浮在底部上方。膠囊材質在
 * GlobalBottomNav（Regular Glass）。
 *
 * 定位吃 --chrome-inset（HIG iOS 26 的 21pt 膠囊 inset），與 MapPage POI 卡避讓、
 * ChatPage composer 避讓同一來源，不再散落 12px 副本。
 *
 * safe-area 用 max() 不是 calc() 相加：inset 的語意是「離螢幕邊」，而 home indicator
 * 的 34px 已經是那段距離的一部分；calc(21px + 34px) 會讓膠囊在 iPhone 上離底 55px。
 * 相對**舊值** calc(12px + env(...)) 的實際位移：iPhone 46→34（低 12px，貼齊 safe-area
 * 上緣，符合 HIG）；無 safe-area 裝置 12→21（高 9px）。後者與 --nav-overlay-h 一起
 * 收斂了底部淨空，是這次改動要盯的方向。
 *
 * ⚠ 膠囊**常駐**（owner 2026-07-20 決定）—— 不實作 HIG 的 tabBarMinimizeBehavior。
 * 原本的 scroll-direction-aware 隱藏（translateY(180%)）已整套移除。HIG 允許 .never。
 *
 * ⚠ 這裡曾有 pointer-events:none（v2.56.12 為地圖 POI 卡被攔截而加）。
 * 移除的理由**不是**「膠囊變小了」—— 膠囊一直是 shrink-to-fit 藥丸（268×60，
 * left:50% + translateX(-50%)、無 width/right），加了 rim border 後還比當時大 2px。
 * 真正的理由是**膠囊現在不透明**：當時它全透明，使用者看得到底下內容，所以點擊理應
 * 穿透；現在它是實體玻璃，點在膠囊空隙卻觸發看不見的下層元素才是意外行為。
 * 穩態下 .tp-page-bottom-bar(z=210) 仍勝過本層(z=200)，form 送出鍵不受影響。
 * 回歸由 tests/e2e/bottom-nav-clickthrough.spec.js 守住。 */
.app-shell-bottom-nav {
  position: fixed;
  left: 50%;
  bottom: max(var(--chrome-inset), env(safe-area-inset-bottom, 0px));
  z-index: var(--z-sticky-nav);
  transform: translateX(-50%);
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
  /* rev2 §10.1（owner 2026-07-19）：桌機 primary nav 改回 macOS sidebar（DesktopSidebar
   * 頂部 4-tab）→ 桌機**隱藏**底部浮動膠囊。故無需膠囊置中，也無需為膠囊在 main 留
   * padding-bottom。手機（<1024）維持底部膠囊常駐（見下方 max-width:1023px 段）。 */
  .app-shell-bottom-nav {
    display: none;
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
  /* rev2 owner 2026-07-20「功能 tab 下方應該是全版該功能頁面」：底部 tab 已改全透明
   * （v2.56.6 ⑥），再為它保留 88px 就變成「內容被切掉 + 一條空白奶油帶浮著 tab」（實測
   * 收藏頁捲到底最後一張卡被硬切在 y755）。改為**不保留**→ 功能頁全版鋪到螢幕底，透明 tab
   * 浮在內容之上（內容從 tab 之間透出，iOS 慣例）。
   *
   * 底部有互動元件的頁面（如聊天 composer）不能被 tab 蓋住 → 提供 --nav-overlay-h 讓它們
   * 自行讓位（見 ChatPage .tp-chat-shell）。清單頁不讓位，維持全版。
   * 操作頁 drill-down 不顯 nav → data-has-bottom-nav="false"，overlay 高度 0。 */
  /* 由膠囊的實際佔用高度派生，不硬寫。舊值 --nav-height-mobile: 88px 與真實膠囊盒
   * 完全脫鉤 —— 而 MapPage POI 卡與 ChatPage composer 的避讓是唯一擋住「底部互動
   * 元件被膠囊蓋住」的機制，脫鉤就會漏。
   *
   * 60px = 膠囊實高：padding 6*2 + btn min-height 46 + border 1*2。
   * ⚠ border 那 2px 不能省：* { box-sizing: border-box } 只作用於有**明確**
   * width/height 的元素，膠囊是 height:auto，padding 與 border 一定往外加。
   *
   * ⚠ 必須 mirror 上面 bottom 的 max()，不能只寫 var(--chrome-inset)。
   * 只寫 inset 的話 iPhone（safe-area 34）上膠囊實際佔 34+60=94，卻只保留 79 → 短少 15px，
   * ChatPage composer 會被膠囊壓住上緣。 */
  .app-shell[data-has-bottom-nav="true"] {
    --nav-overlay-h: calc(max(var(--chrome-inset), env(safe-area-inset-bottom, 0px)) + 60px);
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

/* rev2：操作面板容器 tabIndex=-1 是「開啟時把焦點移進面板」的 a11y 目標（程式聚焦、
 * 非使用者聚焦的控制項），比照 modal dialog 容器不顯焦點外框；否則整個右欄邊緣會描
 * accent outline。tabIndex=-1 元素本就不可鍵盤聚焦，抑制其 outline 對鍵盤使用者無損。 */
.app-shell-sheet > [tabindex="-1"]:focus,
.app-shell-sheet > [tabindex="-1"]:focus-visible {
  outline: none;
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

/* 底部膠囊**常駐**（owner 2026-07-20）。原本的 scroll-direction-aware 隱藏
 * （PR-VV 2026-04-27：向下捲 hide / 向上捲 show + 8px threshold + 60px top 緩衝）
 * 已整套移除 —— 4-tab 是 global IA 主導覽，常駐比省 58px 垂直空間重要。
 * HIG 的 tabBarMinimizeBehavior 本就允許 .never。
 * mainRef 保留：usePullToRefresh 仍需要它。 */

export default function AppShell({ sidebar, main, sheet, sheetPortalId, bottomNav }: AppShellProps) {
  const layout: AppShellLayout = (sheet || sheetPortalId) ? APP_SHELL_LAYOUT_3PANE : APP_SHELL_LAYOUT_2PANE;
  const mainRef = useRef<HTMLElement>(null);

  // Pull-to-refresh：scrollTop=0 時拖下 80px+ → reload
  const onRefresh = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, []);
  const { pullPx, refreshing } = usePullToRefresh(mainRef, onRefresh);

  return (
    <>
      <style>{APP_SHELL_STYLES}</style>
      <div className="app-shell" data-layout={layout} data-has-bottom-nav={bottomNav ? 'true' : 'false'} data-testid="app-shell">
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
            aria-label="主要功能"
          >
            {bottomNav}
          </nav>
        )}
      </div>
    </>
  );
}
