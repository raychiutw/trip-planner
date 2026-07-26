/**
 * AccountSheet — Account sheet 的 overlay 容器（W1 IA）。
 *
 * 覆蓋當前頁的側邊 sheet（桌機右側 480px form sheet / 手機全寬），內容＝帳號路由
 * （由 `AccountModalRoutes` 傳入的 `<Routes>`）。包 `<SheetModeProvider>` → 內部 account
 * 頁的 `AppShell` 只 render 主內容（無 sidebar / 底部 nav / grid）。
 *
 * 關閉（✕ / backdrop / Esc）→ closeSheet + navigate 回背景 location（背景全程 mounted，
 * 即時回到原狀態）。
 */
import { useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { SheetModeProvider } from '../../contexts/SheetModeContext';
import { useAccountSheet } from '../../contexts/AccountSheetContext';
import { useSheetBehavior } from '../../hooks/useSheetBehavior';

export const ACCOUNT_SHEET_STYLES = `
.account-sheet-root { position: fixed; inset: 0; z-index: var(--z-modal, 1000); }
.account-sheet-backdrop {
  position: absolute; inset: 0;
  background: var(--color-overlay, rgba(0,0,0,0.4));
  animation: account-sheet-fade var(--transition-duration-normal, 250ms) ease-out;
}
.account-sheet-panel {
  position: absolute; top: 0; bottom: 0; right: 0;
  width: min(480px, 100vw); max-width: 100vw;
  background: var(--color-background); color: var(--color-foreground);
  box-shadow: var(--shadow-lg);
  display: flex; flex-direction: column;
  overflow-y: auto; overscroll-behavior: contain;
  animation: account-sheet-slide var(--transition-duration-normal, 250ms) var(--transition-timing-function-apple, cubic-bezier(0.2,0.8,0.2,1));
}
@media (max-width: 1023px) {
  .account-sheet-panel { width: 100vw; }
  /* item A（owner 2026-07-24「帳號沒關閉，只手機版，桌機正常不改」）：手機是全螢幕 sheet，內部
     AccountPage 的 sticky TitleBar（z-index: --z-sticky-nav=200）在空間上蓋住 sheet 右上的 ✕
     （原 z-index:1）→ elementFromPoint 命中 titlebar、✕ 點不到。把 ✕ 拉到 titlebar 之上即可點。
     桌機 sheet 是較窄右側面板、✕ 本就可點，故此修正只限手機（不動桌機）。
     用 .account-sheet-panel 加一層 specificity (0,2,0)，蓋過下方 base .account-sheet-close
     的 z-index:1（同 specificity 下 base 在後、否則會贏）。 */
  .account-sheet-panel .account-sheet-close { z-index: calc(var(--z-sticky-nav, 200) + 10); }
}
.account-sheet-close {
  position: absolute; top: calc(8px + env(safe-area-inset-top, 0px)); right: 12px; z-index: 1;
  width: 44px; height: 44px; display: grid; place-items: center;
  background: transparent; border: none; cursor: pointer;
  color: var(--color-muted); font-size: 1.25rem; line-height: 1; border-radius: var(--radius-full);
}
.account-sheet-close:hover { background: var(--color-hover); color: var(--color-foreground); }
.account-sheet-close:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 2px var(--color-background); }
.account-sheet-body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
@keyframes account-sheet-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes account-sheet-slide { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .account-sheet-backdrop, .account-sheet-panel { animation: none; }
}
`;

export default function AccountSheet({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { bg, closeSheet } = useAccountSheet();

  const close = useCallback(() => {
    closeSheet();
    const to = bg ? bg.pathname + bg.search + bg.hash : '/trips';
    // replace：把 /account URL 換回背景（背景 component 全程 mounted → 同 route 不 remount、保留狀態）。
    navigate(to, { replace: true });
  }, [closeSheet, navigate, bg]);

  /*
   * 統一 sheet 引擎（#1150 story 6）：原本這裡只有一個 window keydown 監聽 Escape ——
   * **沒有 focus trap**，而元件宣告了 `aria-modal="true"`。那個屬性是對輔助技術的承諾
   * （底下的內容不可及），瀏覽器不會替你實現：鍵盤使用者一路 Tab 就會跑到被遮住的頁面上，
   * 螢幕閱讀器卻已經照 aria-modal 把底下藏起來了。宣告了卻沒做，比不宣告更糟。
   *
   * 換成 useSheetBehavior 一次拿到 Escape（含 IME／巢狀 guard，巢狀時只關最上層 ——
   * 原本的 window 監聽會讓 sheet 內開的確認框按 Escape 時連 sheet 一起關掉）、
   * focus trap、body scroll-lock、關閉後焦點還原到開啟前的觸發元素。
   */
  const { panelRef, backdropRef, handlePanelKeyDown } = useSheetBehavior(true, close);

  return (
    <SheetModeProvider>
      <style>{ACCOUNT_SHEET_STYLES}</style>
      <div className="account-sheet-root" role="dialog" aria-modal="true" aria-label="帳號">
        <div ref={backdropRef} className="account-sheet-backdrop" onClick={close} />
        <div
          ref={panelRef}
          tabIndex={-1}
          className="account-sheet-panel"
          onKeyDown={handlePanelKeyDown}
        >
          <button type="button" className="account-sheet-close" aria-label="關閉" onClick={close}>✕</button>
          <div className="account-sheet-body">{children}</div>
        </div>
      </div>
    </SheetModeProvider>
  );
}
