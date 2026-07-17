/**
 * OperationShell — rev2 操作頁雙形態外殼（owner 2026-07-18「一次到位：6 條全接」）。
 *
 * 取代操作頁（加景點/換景點/編輯 entry/複製移動/新增/編輯行程）各自 hardcode 的
 * `<AppShell> + <TitleBar>` 外殼。依 SheetStackContext 決定 render：
 *
 *   - 整頁（手機，或無 host）：<AppShell sidebar main={<div class=shell><TitleBar/>{children}</div>}
 *     bottomNav/> — 與既有行為 100% 相同（零回歸）。
 *   - bare panel（桌機 TripStackLayout 當 host）：<div class=shell><StackPanelHeader/>{children}</div>
 *     塞進右欄 sheet，中欄仍顯行程詳情。
 *
 * children / shellClassName / scopedStyles 兩形態完全共用；只有 header + 外層不同。
 * 因此每頁轉換是機械式：拔掉 <AppShell>/<TitleBar>，把 TitleBar 以下的內容原封當
 * children 傳進來（含各頁自己的 .tp-page-bottom-bar「完成」bar → panel 形態沿用）。
 *
 * ‹「前一頁」= back（各頁既有 handleBack 目標）；✕「整個關閉」= context.closeStack（回詳情）。
 * bare panel 形態不顯 TitleBar actions（完成鈕由 children 內的 bottom-bar 提供）。
 */
import type { ReactNode } from 'react';
import AppShell from './AppShell';
import DesktopSidebarConnected from './DesktopSidebarConnected';
import GlobalBottomNav from './GlobalBottomNav';
import TitleBar from './TitleBar';
import StackPanelHeader from './StackPanelHeader';
import { useSheetStack } from '../../contexts/SheetStackContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';

export interface OperationShellProps {
  /** 各頁 scroll 容器 class（e.g. "tp-add-stop-page-shell"）— 兩形態共用。 */
  shellClassName: string;
  /** page-shell div 的 data-testid（既有測試沿用）。 */
  testId?: string;
  /** 頁標題。 */
  title: ReactNode;
  /** ‹「前一頁」callback（各頁既有 handleBack）。 */
  back: () => void;
  /** 整頁模式 TitleBar 返回鍵 aria-label。 */
  backLabel?: string;
  /** 整頁模式 TitleBar 右側 actions（完成鈕）；panel 模式不顯（由 children bottom-bar 提供）。 */
  actions?: ReactNode;
  /** 各頁 scoped `<style>` 內容（兩形態共用）。 */
  scopedStyles?: string;
  children: ReactNode;
}

export default function OperationShell({
  shellClassName,
  testId,
  title,
  back,
  backLabel,
  actions,
  scopedStyles,
  children,
}: OperationShellProps) {
  const { inStack, closeStack } = useSheetStack();
  const { user } = useCurrentUser();

  if (inStack) {
    // 桌機右欄 bare panel — 中欄行程詳情由 TripStackLayout 保留。
    return (
      <div className={shellClassName} data-testid={testId}>
        {scopedStyles && <style>{scopedStyles}</style>}
        <StackPanelHeader title={title} onBack={back} onClose={closeStack} />
        {children}
      </div>
    );
  }

  // 整頁（手機／無 host）— 既有行為。
  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      main={
        <div className={shellClassName} data-testid={testId}>
          {scopedStyles && <style>{scopedStyles}</style>}
          <TitleBar title={title} back={back} backLabel={backLabel} actions={actions} />
          {children}
        </div>
      }
      bottomNav={<GlobalBottomNav authed={user !== null} />}
    />
  );
}
