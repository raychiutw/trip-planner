/**
 * AppShell — app-wide layout primitive.
 *
 * Why hide sidebar/sheet via CSS instead of conditionally rendering on mobile:
 *   keeps component state alive across breakpoints (avoids unmount/mount side effects
 *   when users rotate device or resize viewport).
 */
import { useRef, type ReactNode } from 'react';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useRefreshRunner } from '../../contexts/RefreshContext';
import { useSheetMode } from '../../contexts/SheetModeContext';

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

/* W1 Account sheet：sheet 內只 render 主內容（AppShell inSheet 短路），這是它的容器。
 * 外層 scroll / box 由 AccountSheet panel 提供，這裡只保證 flex column 撐滿。 */
.app-shell-in-sheet {
  display: flex;
  flex-direction: column;
  min-height: 100%;
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

/* 2026-07-21 dark-mode elevation audit（PR #1102 修 .trip-content 透明壓在
 * .app-shell 底色上的同型問題）：第三欄 sheet 應比中欄內容再高一階，讓三欄讀得出
 * 層次 —— .app-shell base = --color-background，中欄內容 = --color-secondary
 * （見 .trip-content / .tp-trips-shell 等），第三欄 = --color-tertiary。
 * 這是 base/fallback；個別 sheet content（TripSheet / OperationShell 面板）若自己
 * 畫了不透明背景會覆蓋這層，需各自對齊（見 CollabPage/TripHealthCheckPage/
 * TripNotesPage 的 .app-shell-sheet .tp-*-shell override）。 */
.app-shell-sheet {
  background: var(--color-tertiary);
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
/* W14 soft-refetch 失敗提示 pill。 */
.app-shell-ptr-failed {
  position: absolute;
  top: 8px; left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  background: var(--color-priority-high-bg, #fde2e2);
  color: var(--color-priority-high-text, #8b2828);
  font-size: var(--font-size-caption1);
  pointer-events: none;
  white-space: nowrap;
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
/* rev2「手機也做」：底部 nav 是**浮動玻璃膠囊**（非滿版 bar）→ fixed 置中浮在底部
 * 上方（手機 bottom:12+safe；桌機 @≥1024 覆蓋為置中中欄+右欄、bottom:18）。膠囊視覺
 * 在 GlobalBottomNav。捲動隱藏往下滑出。 */
.app-shell-bottom-nav {
  position: fixed;
  left: 50%;
  bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  z-index: var(--z-sticky-nav);
  transform: translateX(-50%);
  transition: transform var(--transition-duration-normal, 250ms) var(--transition-timing-function-apple, cubic-bezier(0.2, 0.8, 0.2, 1));
  /* v2.56.12：tab 改透明（⑥）+ 功能頁全版鋪到底（v2.56.9）後，這個 fixed overlay 直接壓在
   * 內容上 → **整塊攔截點擊**（e2e 實證：地圖頁底部 POI 卡按不動，
   * "<a class=tp-global-bottom-nav-btn> from <nav class=app-shell-bottom-nav> subtree
   * intercepts pointer events"）。與本檔上方記載的舊事故（form confirm 被 bottom-nav 攔截，
   * 22+ master CI runs）同型。
   * 修法：容器不吃指標事件，只有 tab 按鈕本身吃 → 透明處的點擊穿透到下方內容，icon 仍可按。
   * （按鈕的 pointer-events:auto 在 GlobalBottomNav .tp-global-bottom-nav-btn。） */
  pointer-events: none;
}

/* #1140 item 10（Apple HIG）：手機軟鍵盤彈出時收起 root tab —— useKeyboardInset 偵測到鍵盤
 * （inset 超門檻）在 documentElement 掛 data-kb-open，這裡把浮動膠囊往下滑出畫面。打字時把
 * 螢幕讓給內容＋鍵盤；鍵盤收起 attribute 移除、膠囊沿既有 transition 滑回。捲動不受影響
 * （root tab 常駐，只有鍵盤才收）。translateX(-50%) 保持水平置中。 */
:root[data-kb-open="1"] .app-shell-bottom-nav {
  transform: translate(-50%, calc(100% + 24px));
  pointer-events: none;
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
  .app-shell[data-has-bottom-nav="true"] {
    --nav-overlay-h: var(--nav-height-mobile, 88px);
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

/* PR-VV 2026-04-27 的 scroll-direction-aware bottom-nav（向下捲隱藏、向上捲顯示）
 * 已於 2026-07-21 整個移除 —— owner 兩次要求底部 tab 常駐（7/20「保持常駐 滾動
 * 不隱藏」、7/21「下捲動不要讓 function tab 消失」）。閾值常數一併拔掉。 */

export default function AppShell({ sidebar, main, sheet, sheetPortalId, bottomNav }: AppShellProps) {
  const { inSheet } = useSheetMode();
  const layout: AppShellLayout = (sheet || sheetPortalId) ? APP_SHELL_LAYOUT_3PANE : APP_SHELL_LAYOUT_2PANE;
  const mainRef = useRef<HTMLElement>(null);
  // owner 2026-07-20 起要求底部 tab「保持常駐，滾動不隱藏」——
  // 捲動隱藏的 navHidden / lastYRef 與其 scroll listener 已整個移除。

  // Pull-to-refresh：scrollTop=0 時拖下 80px+ → per-view soft-refetch（W14）。
  // 目前頁 useRegisterRefresh 登記了 refetch → 就地重抓、位置保留；沒登記 → fall back reload。
  const runRefresh = useRefreshRunner();
  const { pullPx, refreshing, failed } = usePullToRefresh(mainRef, runRefresh);

  // 2026-07-21：捲動隱藏底部 tab 的 scroll listener 整個移除
  // （owner：「下捲動不要讓 function tab 消失」，2026-07-20 已提過一次）。
  // 連帶少一個 per-scroll 的 handler —— 它每次捲動都要讀 scrollTop 並比對，
  // 而膠囊本來就是常駐的。

  // W1 Account sheet：sheet overlay 內只 render 主內容，跳過 sidebar / 底部 nav / grid
  // chrome（見 SheetModeContext）。上方所有 hooks 已呼叫完，此 early-return 不違反 Rules of Hooks。
  if (inSheet) {
    return (
      <>
        <style>{APP_SHELL_STYLES}</style>
        <div className="app-shell-in-sheet" data-testid="app-shell">{main}</div>
      </>
    );
  }

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
          {/* W14：soft-refetch 失敗 → 小 pill 提示重試（下次下拉會重置 failed）。 */}
          {failed && !refreshing && (
            <div
              className="app-shell-ptr-failed"
              role="status"
              data-testid="app-shell-ptr-failed"
            >
              更新失敗，請再下拉重試
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
