/**
 * SheetModeContext — 標記「當前 subtree 在一個 sheet overlay 內」。
 *
 * W1 IA（HIG 4-tab + 帳號 sheet）：帳號頁改由 header 圓圈開成覆蓋當前頁的 Account sheet
 * （自有 nav stack、關閉回原頁）。account 頁本身都經 `AppShell` render 全站 chrome
 * （sidebar / 底部 nav / grid）；sheet 內不該再出現這些。
 *
 * 作法：AppShell 是**單一 choke point** —— 它讀本 context，`inSheet=true` 時只 render
 * `{main}`（跳過 sidebar / bottomNav / grid），於是把 account 路由包一層
 * `<SheetModeProvider>` 就能讓**所有** account 頁 shell-less，零 per-page 改動。
 * deep-link（直接打 /account，無 provider）→ inSheet=false → 全頁 fallback。
 */
import { createContext, useContext, type ReactNode } from 'react';

interface SheetModeValue {
  /** 當前 subtree 是否在 sheet overlay 內（true → AppShell 抑制全站 chrome）。 */
  inSheet: boolean;
}

const SheetModeContext = createContext<SheetModeValue>({ inSheet: false });

/** 包住要以 sheet 形態呈現的 subtree（其內的 AppShell 只 render main）。 */
export function SheetModeProvider({ children }: { children: ReactNode }) {
  return <SheetModeContext.Provider value={{ inSheet: true }}>{children}</SheetModeContext.Provider>;
}

/** AppShell（與任何需要知道自己在不在 sheet 內的元件）用。 */
export function useSheetMode(): SheetModeValue {
  return useContext(SheetModeContext);
}
