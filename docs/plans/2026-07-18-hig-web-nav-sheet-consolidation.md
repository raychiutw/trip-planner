# HIG Navigation / Sheet Semantics — Web 完整重寫 Plan

> Spec 來源:Flutter plan `trip-planner.flutter/docs/superpowers/plans/2026-07-18-hig-navigation-sheet-semantics.md`(當 HIG 語意 SoT)+ macOS HIG(桌機)+ iOS HIG(手機)+ 本專案 `DESIGN.md`。
> 稽核明細:scratchpad `hig-audit.md`(四方對照,4 個 Explore agent 測繪)。
> 分支:`feat/rev2-hig-nav-sheet`(疊 `feat/rev2-shell`,桌機=rev2)。

## Goal

讓 web app(手機 web + rev2 桌機 web)的每個 navigation/sheet 語意角色都用**正確 HIG 語意 + 單一共用實作源**。HIG = source of truth 全力遵守,只在 web 平台真的做不到時讓步。不受 ponytail 限制,做最完整重寫。終點:本機 `/qa` 截圖測試完成。

## User 決策(已拍板)

1. **總覽 tab**:行程(TripPage DayNav)移除總覽=現況已符;地圖(MapPage)保留總覽。→ **免動**。
2. **Modal 收斂**:**全面收斂到單一 sheet/modal 引擎**(8 portal modal + 2 頁面自畫 overlay 全併)。

## 現況架構(from 稽核)

- **OperationShell**(route-based,6 操作頁):手機全頁 / 桌機右欄 panel,靠 `inStack`@1024 切;用 **StackPanelHeader**(‹+✕);「堆疊」是虛擬旗標 `location.state.opStacked`,**無真 stack**;完成走 `.tp-page-bottom-bar`。
- **SheetStackContext**:只有 `{inStack, closeStack}`。
- **8 個 portal modal**:ConfirmModal / InputModal / ConflictModal / ShareLinkModal / TripPickerPopover / TravelPillDialog / TripCardMenu / TripDatePicker,各自 createPortal。
- **InfoSheet**:手機底部 sheet,用 `useSheetBehavior`(scroll-lock/focus-trap/Esc/barrier/swipe/detent)——唯一用者。
- **AiConsentSheet**:自建 portal 底部 sheet(barrier+Esc,無 scroll-lock,裝飾 grabber)。
- **頁面自畫 overlay**:EditTripPage 平移日期 modal、TripsListPage portal 下拉、DeveloperAppNewPage secret modal、EditEntryPage 內嵌 ConfirmModal。
- **useSheetBehavior**:好 primitive(scroll-lock/focus-trap/Esc/barrier)但只 InfoSheet 用。

## 目標架構:一引擎 + 語意 wrapper

### 1. 行為引擎(headless)
擴充 `useSheetBehavior` 成**唯一**行為引擎:scroll-lock(`useBodyScrollLock`)、focus-trap + focus-restore、Esc、barrier-dismiss、swipe-to-dismiss(手機)、detent。所有 sheet/modal 走它。

### 2. 呈現 host(依 form-factor × 語意角色決定形態)
- 手機:bottom sheet(content/selection/consent)或 full-page(form)。
- 桌機:置中 modal(confirm/input)或右欄 stack panel(form/operation)或 anchored popover(chooser)。← macOS HIG。

### 3. 語意 wrapper — **3 核心 + 變體 + 1 anchored**(F8 YAGNI:不開 6 個)
| Wrapper | 角色 | 取代 | HIG 要點 |
|---|---|---|---|
| `ConfirmSheet`(alertdialog) | destructive 確認 | ConfirmModal(**16 consumer**)+ ConflictModal + EditEntry 內嵌 discard + EditTrip 平移 | 置中兩平台;Esc=取消 / Enter=預設;確認鈕右、取消左。**+ input 變體取代 InputModal(1 consumer,不另開 InputSheet)** |
| `ContentSheet` | 唯讀/明細/consent | InfoSheet(**引擎金絲雀**)/ AiConsentSheet / DeveloperApp secret / TripsList 下拉 | 手機 bottom sheet(可 resize→grabber);桌機 panel/popover;header ✕(+‹ if nested);**固定高→無 grabber**。**consent = `scrollLock+noGrabber` props,不另開 ConsentSheet** |
| `FormPanel`(=OperationShell 角色) | 建立/編輯 form | 6 操作頁 + AddCustomStop | 手機全頁 / 桌機右欄;**depth-gated back stack**;header ‹+✕、完成走 bottom bar;dirty 攔截 |
| `ChooserPopover`(anchored,**與 sheet 引擎分開**) | 選擇→即時 | TripPickerPopover / Date/Time/Category picker | anchored 定位 + light-dismiss;**無「完成」**、當前值打勾、即點生效。**現況多已合規(audit ✅)→ 只統一 Esc/light-dismiss/focus,輕量** |

**SheetHeader**(併 5 角色 none/back/close/back+close/cancel,44pt)合理低風險,保留。

### 4. 共用 header primitive `<SheetHeader>`
併 StackPanelHeader + modal 標題 + InfoSheet header。角色:none / back(‹) / close(✕) / back+close / cancel(取消)。**44pt**。標準化 aria + 命名。

### 5. 真 Back stack(修 G-S1)——定案:depth-gated `navigate(-1)`(eng review F1/F4)
現況 route-based(每操作頁一 URL,rev2 刻意保留 deep-link,**不可破 URL**)。技術棧 react-router 7 但用 `<BrowserRouter>`(非 data router)。

**用 `navigate(-1)` + depth gate,不用 URL 陣列**(eng F4):`navigate(-1)` 委派瀏覽器 history(權威、與 back/forward 同步、forward 自然清);URL 陣列冷啟一樣空且不同步 browser back/forward = 反而差。v2.33.139 的 footgun(-1 可能跳外站)用 **depth gate 避開**——只在確定 in-app push 過(depth>1)才 -1。

**depth 機制(F1:目前為零,要從建)**:
- `depth = location.state?.depth ?? 1`(OperationShell 讀)。
- L3 push(只 3 點:EditEntry→ChangePoi,`EditEntryPage.tsx:1742/1860/1869`,已有 `opStacked:true`)→ 加 `depth:(location.state?.depth ?? 1)+1`。→ ChangePoi-from-EditEntry depth=2。
- 其餘 op-entry(從 trip 進的 L2)無 state → depth 預設 1。**冷啟 deep-link 進 op 一律無 state → depth=1**。
- **`‹`(Back,G-S1 核心修正)**:過 dirty gate 後 → `depth>1 ? navigate(-1) : pageExplicitBack()`。
  - depth>1(L3,已 in-app push)→ `navigate(-1)` pop 回上一操作頁(ChangePoi ‹ → EditEntry)。
  - depth≤1(手機 L2 / 冷啟)→ 頁自帶 explicit `back`(useNavigateBack → trip)。**不 navigate(-1) → 不踢出 app**(F1 修)。
  - showBack 續 `!inStack || depth>1`(桌機只 L3+;手機恆顯,L2 走 explicit back = 正確 drill-down)。
- **`✕`(Close)**:過 dirty gate 後 → `closeStack`(explicit navigate trip,現況)。
- 保留每頁 URL / deep-link 不破。
- **⚠ 已知 P2 deviation(F2,pre-existing)**:✕ 用 replace 後按瀏覽器上一頁可能復活面板。乾淨修需 navigate(-depth) unwind + 全 op-entry 標記(broad instrumentation),成本高、屬罕見邊角 → 先記錄不修,‹ 的 G-S1 已完整解。

### 5b. Dirty 攔截無 useBlocker 替代(G-H3,eng 確認)
`<BrowserRouter>`(main.tsx:173)→ **`useBlocker` 不可用**(react-router 7 需 data router)。改:Cancel/‹/✕ **都過自有 handler → 內含 dirty 檢查 + discard ConfirmSheet**;`navigate(-1)` pop 也必過此 gate(F3:別讓 SheetStackContext 盲 -1 繞過);`beforeunload` 補 tab-close(useAutosave 已註明 caller 自 wire)。browser-back 硬案先不完美攔(P2)。

## 引擎必備 options(eng review — 不做這些 B1/B2 必回歸)
B0 擴充 `useSheetBehavior` 時**一次設計進去**:
- `initialFocusRef?`(F6):預設 focus panel 容器,但可指定初始 focus 元素。confirm-modal-a11y 測試斷言 `activeElement===confirmBtn` → ConfirmSheet 傳確認鈕 ref,否則測試紅。
- `canDismiss?` / `escapeDisabled?`(F6):AiConsent busy 時鎖 Esc/barrier(避免看似取消卻仍送出)。預設可關,busy 時傳 false。
- `modal?`(F11):**scroll-lock 條件化**。手機 bottom sheet / 桌機置中 modal = `modal:true` 鎖捲;**桌機 non-modal 右欄 FormPanel = `modal:false` 不鎖**(否則凍結中欄詳情)。
- layer counter(F7):open 時遞增派 z-index,別全部吃同一 `--z-modal:9000`(否則 nested discard/conflict 疊層靠 DOM 順序,脆弱)。新增 `--z-sheet-base` + counter;InfoSheet 維持 <modal 層級。
- ref-count global class(F10):`.container.sheet-open` 改開啟計數,別最後一個 unmount 就移除(收斂後多 sheet 併存會互踩)。
- Esc 巢狀/IME guard(F12):window Esc 需複製 EditEntryPage:1604-1616 現有 guard(inner modal 開著→關那個非整 panel;target 是 INPUT/TEXTAREA→return 讓 IME cancel)。桌機 Esc 語意 = 取消當前 = 關最上層 panel(等同 ✕)+ 過 dirty gate。
- additive swipe/detent(F9):swipe/detent 當**可選** option 加入,InfoSheet 先當金絲雀遷移證明,別在證明前拆它 InfoSheet.tsx:97-184 的手勢碼。

## 批次(依賴序,F9 遷移順序)

- **B0 引擎 foundation**:擴充 `useSheetBehavior`(含上述**全部** options)+ `<SheetHeader>`(44pt/5 角色/命名)+ SheetStackContext depth 機制 + 3 wrapper skeleton(ConfirmSheet/ContentSheet/FormPanel)+ ChooserPopover primitive。測試:引擎各 option、header 角色、depth back gate。
- **B1 低風險 leaf 遷移**:ConfirmModal→ConfirmSheet **只換內部實作、public props + 全 testid 不動**(F5,16 consumer 零改動)+ ConflictModal + InputModal(→ConfirmSheet input 變體)。驗 confirm-modal-a11y 綠(initialFocusRef)+ z layer。
- **B2 InfoSheet 金絲雀**:InfoSheet→ContentSheet,引擎 additive 先證明,detent→grabber only resizable。跑通再往下。
- **B3 高風險 sheet 遷移**:AiConsentSheet→ContentSheet(consent props:scrollLock+noGrabber G-S2/S3;busy canDismiss=false 保留;重驗 ai-consent + chat-consent-gate 測試)+ EditTrip 平移 modal(G-S6)+ DeveloperApp secret + TripsList 下拉 → wrapper。
- **B4 操作殼 + back stack**(自成一批):FormPanel depth-gated ‹(G-S1)+ 移死碼 actions/backLabel(G-H1)+ stack btn 44pt(G-H6a)+ Esc=✕ 過 dirty(G-S4/F12)+ macOS 按鈕序/Enter;AddCustomStop→OperationShell + 桌機堆疊(G-S5)。驗 silent-savestatus-explicit-back-nav 不破。
- **B5 dirty 攔截**(G-H3):非 auto-save form(AddStop/NewTrip/ChangePoi/EntryAction/AddCustomStop)cancel/‹/✕ handler + beforeunload → discard ConfirmSheet(復活 EditEntry 死碼);pop 過同 gate(F3)。
- **B6 命名 + hit target + fallback + stale**:命名規範(G-H5/G-T2)、其他 <44(G-H6b)、root title fallback(G-N2)、stale 註解(G-N6)。
- **B7 timeline**:collapsed row 顯 Google 細分類(G-T4)、大字自適應非截斷(G-T4)、插入指示線(G-T5)。
- **B8 收尾**:DESIGN.md SoT 同步(統一引擎/SheetHeader/back 語意/命名)+ /simplify + /tp-code-verify + /review + /cso --diff + 本機 /qa 截圖。

## 已知 deviation(eng review,記錄不修或後排)
- **F2**:✕ 後瀏覽器上一頁可能復活面板(pre-existing,乾淨修需 broad instrumentation)→ P2 記錄,‹ 的 G-S1 已完整解。
- **F13**:跨 1024px 邊界 remount 會丟未存檔 form state(TripStackLayout:38-40 已自認)→ 罕見(旋轉/縮放跨斷點),known deviation。
- **F14**:跨形態 remount focus restore 落 body → P2 罕見。

## Mockup-first 判定
統一引擎**保留現有視覺**(DESIGN.md 已 spec ConfirmModal/InputModal/InfoSheet/StackPanelHeader),屬 **refactor 非 re-design → mockup-first 免觸發**;改以 DESIGN.md SoT 同步 + Test 階段 `/design-review` before/after 截圖當視覺安全網。若某修正引入**新視覺**才補 mockup。

## 測試
TDD:每個 wrapper + back stack + dirty 攔截 → vitest 單元 + 更新既有 feature test 斷言新控件/回傳路徑。testid 改名必全 codebase grep(unit+e2e+src)。e2e(stack back/close 流程)CI 跑;本機 land 前 vitest + playwright。

## 非-gap / accepted deviation(不動)
weather 已真實資料 · selection popover 即時 · drag handle+完成排序 · full-card 拖曳 · 共用 4-tab nav · 桌機底部玻璃 tab(rev2 SoT) · web 全頁取代 iOS detent · GlobalMapPage full-bleed(DESIGN.md:250 例外) · 總覽(user 拍板)。
