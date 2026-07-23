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
import { useCallback, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { SheetModeProvider } from '../../contexts/SheetModeContext';
import { useAccountSheet } from '../../contexts/AccountSheetContext';

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
@media (max-width: 1023px) { .account-sheet-panel { width: 100vw; } }
.account-sheet-close {
  position: absolute; top: calc(8px + env(safe-area-inset-top, 0px)); right: 12px; z-index: 1;
  width: 44px; height: 44px; display: grid; place-items: center;
  background: transparent; border: none; cursor: pointer;
  color: var(--color-muted); font-size: 20px; line-height: 1; border-radius: var(--radius-full);
}
.account-sheet-close:hover { background: var(--color-hover); color: var(--color-foreground); }
.account-sheet-close:focus-visible { outline: none; box-shadow: var(--shadow-ring); }
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <SheetModeProvider>
      <style>{ACCOUNT_SHEET_STYLES}</style>
      <div className="account-sheet-root" role="dialog" aria-modal="true" aria-label="帳號">
        <div className="account-sheet-backdrop" onClick={close} />
        <div className="account-sheet-panel">
          <button type="button" className="account-sheet-close" aria-label="關閉" onClick={close}>✕</button>
          <div className="account-sheet-body">{children}</div>
        </div>
      </div>
    </SheetModeProvider>
  );
}
