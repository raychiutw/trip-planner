/**
 * AccountSheetContext — 「帳號 sheet 是否開啟」的 app-root 狀態（W1 IA）。
 *
 * HIG 4-tab：帳號移出 tab → header 圓圈開成**覆蓋當前頁**的 Account sheet，自有 nav stack
 * （子頁 appearance/sessions 在 sheet 內 push、關閉回原頁原狀態）。
 *
 * 用 flag（非每次導覽塞 location.state）承載「開啟中」，這樣 account 子頁的普通 `<Link>`
 * 不需帶背景 location 就能留在 sheet 內（`AccountModalRoutes` 判定 `open && path 以 /account 開頭`）。
 * `bg` 記住開啟時的背景 location，關閉時回到它（背景頁全程 mounted 在 overlay 之下 → 即時、保留狀態）。
 * deep-link（直接打 /account，flag=false）→ 全頁 fallback。
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Location } from 'react-router-dom';

interface AccountSheetValue {
  /** sheet 是否開啟中。 */
  open: boolean;
  /** 開啟時記住的背景 location（關閉時回到這裡）。 */
  bg: Location | null;
  /** 開 sheet：記住背景、設 open。呼叫後應 navigate('/account')。 */
  openSheet: (background: Location) => void;
  /** 關 sheet（清 flag）。呼叫者負責把 URL 導回背景。 */
  closeSheet: () => void;
}

// 預設值：無 provider 時 graceful degrade —— openSheet no-op，圓圈的 <Link> 直接走 /account
// 全頁（fallback）。讓不包 provider 的單元測試 / 獨立 render 不會 throw。
const DEFAULT_VALUE: AccountSheetValue = { open: false, bg: null, openSheet: () => {}, closeSheet: () => {} };
const AccountSheetContext = createContext<AccountSheetValue>(DEFAULT_VALUE);

export function AccountSheetProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [bg, setBg] = useState<Location | null>(null);
  const openSheet = useCallback((background: Location) => {
    setBg(background);
    setOpen(true);
  }, []);
  const closeSheet = useCallback(() => {
    setOpen(false);
  }, []);
  return (
    <AccountSheetContext.Provider value={{ open, bg, openSheet, closeSheet }}>
      {children}
    </AccountSheetContext.Provider>
  );
}

export function useAccountSheet(): AccountSheetValue {
  return useContext(AccountSheetContext);
}
