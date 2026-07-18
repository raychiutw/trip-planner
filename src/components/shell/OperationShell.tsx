/**
 * OperationShell — rev2 操作頁雙形態外殼（owner「6 條全接」+「手機也做」2026-07-18）。
 *
 * 取代操作頁（加景點/換景點/編輯 entry/複製移動/新增/編輯行程）各自 hardcode 的
 * `<AppShell> + <TitleBar>` 外殼。**兩形態都用共用 drill-down header**（`StackPanelHeader`
 * = `‹` 前一頁 / `✕` 整個關閉，mockup `.layer-h`/`.dd-top` 同一套）：
 *
 *   - 桌機（inStack）：bare panel 塞右欄 sheet，中欄仍顯行程詳情。
 *   - 手機（!inStack）：整頁 `<AppShell>` 包同一 panel（drill-down 全頁下鑽）。
 *
 * children / shellClassName / scopedStyles 兩形態共用；只有外層（bare vs AppShell）不同。
 * 完成鈕一律由 children 內的 `.tp-page-bottom-bar` 提供（header 不放 action）。
 * `closeStack` 由 TripStackLayout 於桌機+手機兩支都注入（回行程詳情）。
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppShell from './AppShell';
import DesktopSidebarConnected from './DesktopSidebarConnected';
import StackPanelHeader from './StackPanelHeader';
import { useSheetStack } from '../../contexts/SheetStackContext';

export interface OperationShellProps {
  /** 各頁 scroll 容器 class（e.g. "tp-add-stop-page-shell"）— 兩形態共用。 */
  shellClassName: string;
  /** page-shell div 的 data-testid（既有測試沿用）。 */
  testId?: string;
  /** 頁標題。 */
  title: ReactNode;
  /** ‹「前一頁」callback（各頁既有 handleBack）。 */
  back: () => void;
  /** @deprecated 保留讓呼叫端相容；rev2 drill-down header 無 titlebar action（完成由 bottom bar 提供）。 */
  backLabel?: string;
  /** @deprecated 同上；header 不放 action。 */
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
  scopedStyles,
  children,
}: OperationShellProps) {
  const { inStack, closeStack } = useSheetStack();
  const location = useLocation();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  // rev2 Section 01 堆疊語意（mockup 桌機 .layer.l2/.l3）：
  //   桌機第一層（從 timeline 進的操作，如 ⋯「編輯景點」）= L2 → depth 1 → 右上「✕」only、不給「‹」。
  //   從另一操作 push 進來（如 編輯景點 →「變更景點」）= L3+ → push 時帶 state.depth=+1 →「‹」+「✕」。
  //   手機全頁下鑽（!inStack，mockup Section 03 .dd-top）一律顯「‹」，但 L2 的 ‹ 走 explicit back（回 trip）。
  //
  // G-S1（Back moves one level）：depth 由 push 端存 location.state（route-swap 無真 component stack）。
  //   depth>1（確定 in-app push 過）→ ‹ = navigate(-1) 委派瀏覽器 history 退回上一操作頁（ChangePoi ‹ → EditEntry）。
  //   depth≤1（手機 L2 / deep-link 冷啟）→ ‹ = 頁自帶 explicit back（回 trip），**不** navigate(-1) → 不踢出 app。
  //   （v2.33.139 曾因無條件 navigate(-1) 有 footgun 而移除；此處用 depth gate 只在確定 in-app 時才 -1。）
  const depth = (location.state as { depth?: number } | null)?.depth ?? 1;
  const showBack = !inStack || depth > 1;
  const handleBack = depth > 1 ? () => navigate(-1) : back;

  // a11y：桌機面板從側邊開時把焦點移進面板（非 modal sheet 的 APG 慣例），讓鍵盤/螢幕
  // 閱讀器不卡在中欄觸發鈕。手機是整頁 route 切換（focus 自然重置）+ 面板在 app-shell-main
  // （無 outline 抑制）→ 不自動搶焦避免整頁描框。若操作頁自己已 autofocus 欄位則不搶。
  useEffect(() => {
    if (!inStack) return;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      panel.focus();
    }
  }, [inStack]);

  // 共用 drill-down panel（‹ 前一頁 / ✕ 整個關閉）— 桌機右欄 + 手機全頁同一套。
  const panel = (
    <div className={shellClassName} data-testid={testId} ref={panelRef} tabIndex={-1}>
      {scopedStyles && <style>{scopedStyles}</style>}
      <StackPanelHeader title={title} onBack={showBack ? handleBack : undefined} onClose={closeStack} />
      {children}
    </div>
  );

  // 桌機：bare panel 塞右欄 sheet（中欄詳情由 TripStackLayout 保留）。
  if (inStack) return panel;

  // 手機：整頁 drill-down（focused task）— **不顯底部 nav**（比照 mockup .dd-top 全頁下鑽
  // 與 iOS pushed-detail 隱藏 tab bar；避免浮動膠囊壓在操作 bottom bar「完成」上）。
  return (
    <AppShell
      sidebar={<DesktopSidebarConnected />}
      main={panel}
    />
  );
}
