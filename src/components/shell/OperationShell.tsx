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
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppShell from './AppShell';
import DesktopSidebarConnected from './DesktopSidebarConnected';
import StackPanelHeader from './StackPanelHeader';
import { useSheetStack } from '../../contexts/SheetStackContext';
import { isAnySheetOpen } from '../../hooks/useSheetBehavior';

export interface OperationShellProps {
  /** 各頁 scroll 容器 class（e.g. "tp-add-stop-page-shell"）— 兩形態共用。 */
  shellClassName: string;
  /** page-shell div 的 data-testid（既有測試沿用）。 */
  testId?: string;
  /** 頁標題。 */
  title: ReactNode;
  /** ‹「前一頁」callback（各頁既有 handleBack）。 */
  back: () => void;
  /**
   * W1d：depth>1 時 ‹ 的 pop（navigate(-1)）未存確認 gate。有未存編輯的頁面（被 push 成
   * depth>1）提供此 callback，OperationShell 在 pop 前先呼叫它、由頁面決定要不要跳「丟棄
   * 變更」確認；確認後頁面呼叫傳入的 `proceed()` 才真的 pop。不提供（如 ChangePoiPage 無
   * dirty）→ 維持直接 navigate(-1)。修掉「depth>1 pop 盲目 navigate(-1) 跳過確認 → 靜默
   * 丟資料」的 footgun（原本只是 latent，此 hook 讓它可被關）。
   */
  confirmBeforeBack?: (proceed: () => void) => void;
  /** 各頁 scoped `<style>` 內容（兩形態共用）。 */
  scopedStyles?: string;
  /**
   * 手機全頁 drill-down 時的底部 nav slot（v2.57.x 共編/健檢/筆記 panel 化新增）。
   * 預設 undefined → 沿用既有 6 條操作路由行為（手機也不顯底部 tab，focused-task
   * drill-down 慣例）。共編設定/AI 健檢/行程筆記這 3 頁在改用 OperationShell 前手機版
   * 本來就有 GlobalBottomNav，遷移時保留才不改變既有手機行為（owner 要求「手機版行為
   * 不要改」）。桌機（inStack）不吃此 prop —— 桌機底部 nav 一律由 TripStackLayout 提供。
   */
  bottomNav?: ReactNode;
  children: ReactNode;
}

export default function OperationShell({
  shellClassName,
  testId,
  title,
  back,
  confirmBeforeBack,
  scopedStyles,
  bottomNav,
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
  // depth>1 時 ‹ 走 navigate(-1)（in-app pop，depth-gate 保 navigate(-1) 只在確定 push 過時才
  // 用，避免 deep-link 冷啟 back 踢出 app —— v2.33.139 教訓，勿拆）。
  // W1d（owner 2026-07-24 選 A）：pop 前先過頁面的未存確認 gate（`confirmBeforeBack`）——
  // 有 dirty 的頁面被 push 成 depth>1 時，pop 會先跳「丟棄變更」確認、確認才 navigate(-1)，
  // 不再盲目 -1 靜默丟資料。ChangePoiPage 無 dirty、不傳此 prop → 維持直接 navigate(-1)。
  const handleBack = useMemo(() => {
    if (depth <= 1) return back;
    const pop = () => navigate(-1);
    return confirmBeforeBack ? () => confirmBeforeBack(pop) : pop;
  }, [depth, navigate, back, confirmBeforeBack]);

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

  // G-S4（macOS 鍵盤）：桌機右欄操作面板吃 Escape = 取消當前 = 關最上層（有 ‹ 則退一層、
  //   否則整個關）。只在桌機面板（inStack）；手機是整頁 route 切換不需。
  // nested guard（eng F12）：IME 組字、正在輸入（INPUT/TEXTAREA/SELECT）、或有 open 的
  //   modal / native popover / menu（內層 picker、⋯ 選單、discard ConfirmModal）時 → skip，
  //   讓內層先處理，不誤關整個 panel。走 handleBack/closeStack（既有安全路徑，含 depth pop）。
  useEffect(() => {
    if (!inStack) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      // 內層有 engine modal 開著（含從本 panel 開的 discard ConfirmModal）→ 讓它先吃 Escape。
      // 用 registry 而非掃 DOM：InfoSheet 等元件關閉仍常駐 DOM（role=dialog），registry 只記真開啟的。
      if (isAnySheetOpen()) return;
      // native ⋯ 選單 / picker popover 開著（Popover API）→ 讓它先關（:popover-open 只命中開啟的）。
      try {
        if (document.querySelector(':popover-open')) return;
      } catch {
        /* jsdom 不支援 :popover-open → 視為無 native popover 開啟 */
      }
      e.preventDefault();
      if (showBack) handleBack();
      else closeStack();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [inStack, showBack, handleBack, closeStack]);

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
      bottomNav={bottomNav}
    />
  );
}
