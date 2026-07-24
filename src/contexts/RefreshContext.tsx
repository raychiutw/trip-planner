import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';

/**
 * RefreshContext — per-view soft-refresh 契約（HIG W14）。
 *
 * 下拉刷新（`usePullToRefresh` in `AppShell`）原本一律 `window.location.reload()`：
 * 整頁重載會清空捲動位置、閃白、丟掉 client state。HIG 要「refresh 保留舊內容、當頁
 * 留原地」。改法：目前顯示的頁面用 `useRegisterRefresh(refetch)` 登記自己的資料 refetch，
 * AppShell 下拉時呼叫它（就地重抓、不 unmount、位置保留）；沒登記的頁面 fall back 回
 * `location.reload()`（維持原行為、零回歸）。
 *
 * registry 用單一 ref（同時只有一個頁面掛載 → last-registrant-wins），不觸發 re-render。
 * 巢狀 shell（TripStackLayout）也只有最內層那頁登記，符合「刷當前頁」語意。
 */
type RefetchFn = () => Promise<void> | void;

interface RefreshContextValue {
  register: (fn: RefetchFn | null) => void;
  /** 執行目前登記的 refetch；無登記則 fall back 整頁 reload。回傳 promise 讓 UI 顯示 spinner 直到完成。 */
  run: () => Promise<void>;
}

const RefreshContext = createContext<RefreshContextValue | null>(null);

function hardReload() {
  if (typeof window !== 'undefined') window.location.reload();
}

export function RefreshProvider({ children }: { children: ReactNode }) {
  const fnRef = useRef<RefetchFn | null>(null);
  const register = useCallback((fn: RefetchFn | null) => {
    fnRef.current = fn;
  }, []);
  const run = useCallback(async () => {
    const fn = fnRef.current;
    if (!fn) {
      hardReload();
      return;
    }
    // refetch 自己處理錯誤（顯示既有 error 態）；這裡只保證 promise settle 讓 spinner 收。
    await fn();
  }, []);
  return <RefreshContext.Provider value={{ register, run }}>{children}</RefreshContext.Provider>;
}

/**
 * 目前顯示的頁面登記自己的 refetch。fn 變動或 unmount 時自動更新/清除。
 * 傳穩定的 callback（`useCallback`）避免每 render 重登記。
 */
export function useRegisterRefresh(fn: RefetchFn): void {
  const ctx = useContext(RefreshContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.register(fn);
    return () => ctx.register(null);
  }, [ctx, fn]);
}

/** AppShell 用：拿到「跑目前頁 refetch（否則 reload）」的執行器。無 Provider 時退回 reload。 */
export function useRefreshRunner(): () => Promise<void> {
  const ctx = useContext(RefreshContext);
  return useCallback(async () => {
    if (ctx) return ctx.run();
    hardReload();
  }, [ctx]);
}
