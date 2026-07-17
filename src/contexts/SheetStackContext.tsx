/**
 * SheetStackContext — rev2 桌機右欄操作堆疊（owner 2026-07-18「一次到位：6 條全接」）。
 *
 * 由 TripStackLayout 在桌機（≥1024）提供。操作頁（加景點/換景點/編輯 entry/複製移動/
 * 新增/編輯行程）透過 <OperationShell> 讀本 context 決定 render 形態：
 *   - inStack=true（桌機，TripStackLayout 當 host）→ 只 render StackPanelHeader + 內容，
 *     以 bare panel 塞進右欄 sheet，中欄仍顯行程詳情（context 保留）。
 *   - inStack=false（手機，或無 host）→ render 自己整頁 AppShell（既有行為，零變更）。
 *
 * closeStack = ✕「整個關閉」→ 回行程詳情。‹「前一頁」由各頁 back 提供（見 OperationShell）。
 *
 * 預設 { inStack:false } → 無 provider 時操作頁維持整頁，桌機才切 bare panel。
 */
import { createContext, useContext } from 'react';

export interface SheetStackValue {
  /** True 只在桌機 TripStackLayout 當 host 時；操作頁據此切 bare panel。 */
  inStack: boolean;
  /** ✕「整個關閉」— 收整疊回行程詳情。 */
  closeStack: () => void;
}

const SheetStackContext = createContext<SheetStackValue>({
  inStack: false,
  closeStack: () => {},
});

export const SheetStackProvider = SheetStackContext.Provider;

export function useSheetStack(): SheetStackValue {
  return useContext(SheetStackContext);
}
