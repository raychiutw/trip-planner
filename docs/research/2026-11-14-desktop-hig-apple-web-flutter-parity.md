# 桌機版對照 Apple HIG（macOS）、Apple Web 產品與 Flutter App 的一致性研究

日期：2026-11-14　　範圍：只讀研究，未修改任何程式碼

## 問題

1. Tripline 桌機版（≥1024px）對照 Apple HIG 的 macOS 指引，以及 Apple 自家 Web 產品，有哪些 UI/UX 可以調整？建議必須守住既有 owner 決策：柔褐 accent、Inter、timeline editorial no-glass、rev2 三欄、右欄堆疊面板、帳號左下。
2. Web（桌機與手機）和 Flutter App 有哪些不一致？應該以哪一邊為準？
3. 每項附工作量、影響畫面與優先序。新 layout 依 `AGENTS.md` 先過 prototype gate。

**讀取的原始碼**：
- Web：`scratchpad/web`（origin/master）
- Flutter：`scratchpad/flutter`

下文的 `web/…`、`flutter/…` 路徑都相對於這兩個目錄。

**分類標籤**（沿用 2026-11-03 研究筆記）：
- **【網頁要求】**：WCAG 等可測的 Web 標準。
- **【原生建議】**：Apple HIG，是設計參考，不是 CSS 規格。
- **【owner 決策】**：已拍板或需要拍板的事項。
- **【推論】**：我的判斷，不是來源明文。

**驗證限制**：
- prod（https://trip-planner-dby.pages.dev/）要登入，本次**沒有看實際畫面**，全部依原始碼判斷。
- iCloud.com 各 App 也要登入，只能依 Apple Support 文件描述，見第 8 節「未驗證」。

---

## 1. 摘要：前 5 項最值得做的建議

| # | 建議 | 依據 | 工作量 | 優先 |
|---|---|---|---|---|
| 1 | **桌機 sidebar「我的行程」點選後維持目前分頁**。在聊天點行程就換聊天的行程，在地圖點就換地圖的，不再一律跳到「行程」分頁。 | Flutter 已明訂「切換後維持目前 section」（`flutter/DESIGN.md:106`）。Web 的 sidebar 一律連到 `/trips?selected=`（`web/src/components/shell/DesktopSidebar.tsx:277`）。HIG Split views 要求「persistently highlight the current selection in each pane」。 | S–M，1–1.5 人日 | P1 |
| 2 | **補上自家規範已寫、但程式沒做的桌機 CRUD 載體**：右鍵 contextual menu，加上 `Delete` 鍵。 | `web/DESIGN.md:840` 明訂「hover 顯示的列尾按鈕＋右鍵 contextual menu（＋Delete 鍵）」。全 `src/` 搜不到 `onContextMenu`／`contextmenu`／`'Delete'`。HIG Context menus：「Support context menus consistently throughout your app」。 | M，2–3 人日 | P1 |
| 3 | **一致性小修包**（三項都是 Web 偏離自己的規範或 Flutter）：① 深色柔褐 `#CBA06E` 改 `#D0A576`；② 行程 tab 圖示由房子改行李箱；③ 手機帳號圓圈由姓名首字改 `person.crop.circle`。 | Flutter `GLOSSARY.md:104`、`flutter/DESIGN.md:39`、`:72`。Web 自己的 `DESIGN.md:349` 也寫「`person.crop.circle` 圓圈」。 | S，約 1 人日 | P1 |
| 4 | **可收合的桌機 sidebar**：leading 側放顯示／隱藏鈕，視窗變窄時自動收合，預設展開。 | HIG Sidebars：「Consider letting people hide the sidebar」「Consider automatically hiding and revealing a sidebar when its container window resizes」「Avoid hiding the sidebar by default」。Apple Maps on the web 有 `aria-label="Toggle sidebar"` 的 sidebar 切換鈕（實際 HTML）。 | M，2 人日（**layout 變化，需 prototype gate**） | P2 |
| 5 | **最小桌機鍵盤組合**：聚焦搜尋、新增、聊天 `⌘Enter` 送出（與 App 一致），避開瀏覽器保留鍵。另外每頁設 `document.title`。 | HIG Keyboards：「Respect standard keyboard shortcuts」「Define custom keyboard shortcuts for only the most frequently used app-specific commands」。iCloud.com Mail 用 `Option-Shift-N` 新增、`Delete` 刪除，避開瀏覽器的 `⌘N`。HIG Toolbars：「Provide a useful title for each window… Don't title windows with your app name」。目前只有 `TripPage.tsx:419` 設標題。 | S–M，1.5–2 人日 | P2 |

**總工作量**：
- P1＋P2（建議先做）：約 **8–10 人日**
- 連同 P3：約 **20–25 人日**

詳見第 7 節。

最大的需討論事項是**選取樣式**：
- Web：實心柔褐底配白字，owner 2026-07-24 拍板。
- Flutter：中性底配柔褐前景，ADR-0004 以像素實測推翻舊作法。

兩邊相反，見第 6 節 D1。

### Owner 決策（2026-11-14）

owner 同意本報告的建議；**Web 與 App 不同處，一律以 App 為準**。逐項定案如下（取代第 5、6 節的「需討論」）：

| # | 定案 |
|---|---|
| D1／P5 | 選取樣式統一成 App ADR-0004：中性底＋柔褐前景。取代 Web 2026-07-24 的實心柔褐決策（`DESIGN.md:483,510`）。需 prototype gate |
| D2 | 隨 D1 解決：sidebar 不再出現兩塊實心柔褐 |
| D3 | 隨 D1 的 prototype 一併處理：sidebar 主導覽去掉內層玻璃，只靠 sidebar 本身的 vibrancy（App 依 Apple「避免 Liquid Glass 疊加」） |
| P7 | 隨 D1 跟進：淺色柔褐當文字改 `#6F4C2C`，`#8A6038` 只當底色 |
| D6／H13 | 採 (b)：改 `DESIGN.md:374,378`，觸控大螢幕也走桌機版；hover 才顯示的控制在 `(hover: none)` 時常駐 |
| P15 | 依 App：Web 在 720–1023px 也要有寬版版型（App ≥720 走 regular）。新 layout，需 prototype gate；工作量未估 |
| D9／P10 | 依 App：Day 文字用 `Day N`，地圖第一項叫「全部」 |
| P11 | 依 App：聊天 Return 換行、`⌘Return` 送出（取代原建議的「Enter 送出保留」） |
| P2、P3、P4、P6、P13、P14 | 依 App，同原建議 |
| P12 | 例外：Web 已有歸檔、App 沒有，由 App 補上 |
| D4、D7、D8 | 維持原建議（不改）。這三項是 HIG 與 Web 現況的差異，不是 Web ↔ App 差異 |
| P8、P9 | **暫維持** Web 暖奶油配色與 Inter（CLAUDE.md 明列保留）。若「依 App」也涵蓋這兩項，Web 要改系統色與系統字，待 owner 確認 |

更新後的工作量見第 7 節。

### 實際畫面驗證（2026-11-14）

用 `tests/e2e/hig-scenes.spec.js` 的 api-mocks 場景，在最新 master `c2a8d7ca` 截了 78 個場景（手機 390×844、桌機 1280×800，淺色與深色），共 312 張，全部通過。本研究原本讀的是 `ce96157f`，之後 master 合併了 #1690（owner 2026-11-13 簽核的側欄方案 B）和 #1688（帳號頁桌機版面），所以以下幾條要更正：

| 項目 | 更正 |
|---|---|
| D2 | **原描述已過時。**側欄選中改成 `--color-accent-bg` 淡底配中性字（`DESIGN.md` §Desktop Sidebar，#1690），不再是兩塊實心柔褐。不過聊天頁仍有兩個同等強度的選中（「聊天」和目前行程），問題縮小但還在 |
| D3 | **已解決。**#1690 把側欄改成實底、主導覽不再包 `--tabbar-*` 玻璃 |
| D1 範圍 | 側欄現在是淡柔褐底配中性字；App 是中性底配柔褐字，仍不一致。實心柔褐配白字還留在手機底部 tab 和 Day tab（時間軸與地圖） |
| H4 | owner 2026-11-13 已定「不做 icon rail」，所以收合只能做成整欄隱藏，不能收成只剩圖示 |
| H9 | 「我的行程」標題已經是可收合的 disclosure（`aria-expanded`），只剩分組 |

截圖確認成立的：
- 側欄點行程一律連 `/trips?selected=`（H1）
- `src/` 沒有右鍵處理（H2）
- 程式沒有判斷 `pointer: fine`（D6）
- 手機帳號圓圈顯示首字「R」（P2）
- 行程 tab 是房子圖示（P3）
- 地圖第一項叫「總覽」、時間軸用 `DAY N`（P10）
- 桌機帳號是右側抽屜加暗背景（P14）
- 行程詳情中欄標題列仍有行程切換下拉

限制：mock 環境沒有 Google Maps key，地圖區塊都顯示「地圖暫停服務」，地圖本身的畫面沒驗到。

---

## 2. 現況盤點

### 2.1 桌機 Web（≥1024px）

**Shell**：
- `AppShell` 三欄 `216px 1fr 1fr`（`web/css/tokens.css:147`），沒有開右欄的頁面是兩欄（`:148`）。
- 欄寬固定，不能拖拉，sidebar 也不能收合。`AppShell.tsx:166-182` 只有固定 grid，沒有 resize／collapse 邏輯。
- 斷點只判斷 `min-width: 1024px`（`AppShell.tsx:166`），全 repo 沒有 `pointer: fine`。但 `DESIGN.md:374,378` 規定桌機＝`min-width:1024px and (pointer: fine)`，**文件與程式不一致**。

**Sidebar**（`DesktopSidebar.tsx`）：
- 由上到下：品牌 → 4-tab 主導覽（套底部 tab 的玻璃材質 `--tabbar-*`，`:53-63`）→「我的行程」清單（`:259-287`）→ 左下帳號 chip（`:289-326`）。
- 主導覽與目前行程**同時**用實心 `--color-accent-fill`（`:76`、`:104`）。
- 在 `/chat` 時，`activeTripId` 會回退到偏好的行程（`DesktopSidebarConnected.tsx:35-40`），所以 sidebar 會出現兩塊實心柔褐。
- 檔頭註解 `:4-5` 還寫著「primary nav 移到底部浮動玻璃膠囊」，已過時（與 `DESIGN.md:347` 相反）。

**行程詳情**：
- 在 `/trips?selected=` 時，中欄 TitleBar 仍是 `TripTitleSwitcher` 下拉（`TripsListPage.tsx:1060-1073`），與 sidebar 清單重複。
- 進到操作堆疊後，中欄刻意不放 switcher（`TripStackLayout.tsx:21-27` 的註解寫「切換行程已有 DesktopSidebar」）。同一個中欄，兩種行為。

**操作堆疊**：右欄 `OperationShell`／`StackPanelHeader` 的 ‹／✕ ＋右側主要動作（`DESIGN.md:530-539`）。符合 owner 決策，本研究不動。

**帳號**：sidebar chip 開 Account sheet，桌機是**從右側滑入、寬 480px 的抽屜加暗背景**（`AccountSheet.tsx:24-34`）。

**鍵盤**：
- 只有 Esc（多處）、`⌘Enter`／`⌘S`（`EditEntryPage.tsx:903,1679`）、`⌘Enter`（`RailRow.tsx:151`）。
- 聊天用 Enter 送出、Shift+Enter 換行（`ChatPage.tsx:784`）。
- 沒有全域捷徑、右鍵選單、`Delete` 鍵或多選。

**Hover**：timeline 列的 ⋯ 鈕在 `(hover: hover)` 時 hover 才顯示（`TimelineRail.styles.ts:285-298`），已符合 `DESIGN.md:840` 的「hover 顯示列尾按鈕」。

**視窗標題**：`index.html:28` 固定為 `Tripline`，只有 `TripPage.tsx:419` 會改成行程名。

### 2.2 手機 Web（<1024px）

- 底部浮動玻璃膠囊（4-tab），常駐。
- 標題列右側依序是：主要動作 · ⋯ · 帳號圓圈。
- 帳號圓圈顯示**姓名首字**（`AccountCircle.tsx:64-73`）。
- Day tab 文字：時間軸是 `DAY N`（`DayNav.tsx:53`），地圖是「總覽」（`MapPage.tsx:549`）。
- 行程列表有「全部／我的／共編／已歸檔」四個篩選（`TripsListPage.tsx:843-848`），搜尋是展開式按鈕（`:308,324`）。

### 2.3 Flutter App

- 全平台用 iOS 26 system-app 語言（`flutter/DESIGN.md:22-24`，ADR-0009）。
- 寬度 ≥720 時，root tab 改放頂部，行程 detail 並排 320pt 清單（ADR-0009 引 `app_shell.dart:39`）。
- 帳號一律 `person.crop.circle`，不顯示縮寫（`DESIGN.md:72`）。
- regular 寬度的 Account 是置中、最大 560×720 的 form sheet（`:254`）。
- **選取樣式**：中性底＋tint 前景（`:222`，ADR-0004）。
- **配色**：系統動態色，不維護暖白 palette（`:327`）；系統字 SF（`:360`）。
- **Tab 圖示**：`bubble.left / suitcase / map / heart`（`:38-41`）。
- **Day 文字**：`Day N`；地圖第一項是「全部」（`:180`；`display_format.dart:36`）。
- **聊天**：Return 換行，`⌘Return` 送出（`:174`；`chat_screen.dart:1012`）。
- **行程篩選**：只有「全部／我的／共編」，沒有歸檔（`trips_list_screen.dart:373-375`；`lib/` 搜不到 archive）。
- **刪除**：不可復原、沒有 Undo（`:286`，ADR-0008）。這點與 Web W12 一致。

---

## 3. HIG 桌面指引 vs 現況差距表

符合風格：✅＝不違反 owner 決策；⚠️＝碰到 owner 決策，見第 6 節。

| # | 項目 | HIG 依據 | 現況 | 建議 | 符合風格？ | 工作量 | 優先 |
|---|---|---|---|---|---|---|---|
| H1 | Sidebar 選取後的分頁語意 | [Split views](https://developer.apple.com/design/human-interface-guidelines/split-views)：「persistently highlight the current selection in each pane that leads to the detail view」 | 「我的行程」一律連到 `/trips?selected=`（`DesktopSidebar.tsx:277`），在聊天或地圖點了會被帶離目前分頁 | 清單項依目前分頁換「目前行程」：`/chat` → 換聊天行程；`/map`、`/trip/:id/map` → 換地圖；其餘才去行程詳情。行為與 Flutter `DESIGN.md:106` 對齊 | ✅ 不改版面 | S–M 1–1.5d | P1 |
| H2 | 右鍵 contextual menu | [Context menus](https://developer.apple.com/design/human-interface-guidelines/context-menus)：「Support context menus consistently throughout your app」「Always make context menu items available in the main interface, too」；破壞性項目放最後 | 全 `src/` 沒有 `onContextMenu`；自家規範 `DESIGN.md:840` 已要求 | 對 timeline 列、行程卡、收藏卡、sidebar 行程列做 `contextmenu` → 開**現有** ⋯ 選單（`RailRowMenu`、`TripCardMenu`、`TripActionsMenu`）。不另做第二套選單，鍵盤用 Shift+F10／Menu 鍵等效【推論】 | ✅ 沿用現有選單元件，無新 layout | M 2–3d | P1 |
| H3 | `Delete` 鍵 | `DESIGN.md:840`；[Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards)「Respect standard keyboard shortcuts」；iCloud.com Mail 用 `Delete` 刪除所選郵件（[Apple Support](https://support.apple.com/en-us/guide/icloud/mm281e20de/icloud)） | 沒有 | 列表／timeline 有焦點時按 Delete，走**同一條**確認流程（W12／不可逆 Alert），不新增捷徑專屬行為 | ✅ | S（併入 H2）0.5d | P1 |
| H4 | 可收合 sidebar | [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)（2026-06-08）：「Consider letting people hide the sidebar」「in macOS, you can include a show/hide button」「Avoid hiding the sidebar by default」「Consider automatically hiding… when its container window resizes」 | 固定 216px，不能收合 | 標題列 leading 放 `sidebar.left` 樣式的切換鈕，偏好存 localStorage；1024–1199px 自動收成只有圖示的窄欄或完全隱藏（變體交給 prototype 比較） | ✅ 保留 rev2 三欄與帳號左下，只增加收合狀態 | M 2d，**prototype gate** | P2 |
| H5 | 窗格寬度可調 | [Split views](https://developer.apple.com/design/human-interface-guidelines/split-views)（macOS）：「dividers between panes that can support dragging to resize」「Set reasonable defaults for minimum and maximum pane sizes」「Prefer the thin divider style」 | 中欄與地圖右欄固定 `1fr 1fr` | 中欄與右欄之間加 1px 可拖分隔線，設最小寬度（例如 timeline ≥420px、地圖 ≥360px）；雙擊回預設【推論】 | ✅ 仍是三欄 | L 3–4d，**prototype gate** | P3 |
| H6 | 隱藏的窗格要有多種叫回方式 | Split views：「Provide multiple ways to reveal hidden panes… toolbar button or a menu command — including a keyboard shortcut」 | 無（目前也沒有可隱藏的窗格） | 做 H4 時一併提供：按鈕＋捷徑＋`aria-expanded`（Apple Maps web 的切換鈕就有 `aria-expanded`／`aria-controls`） | ✅ | 併入 H4 | P2 |
| H7 | 視窗標題 | [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)：「Provide a useful title for each window」「Don't title windows with your app name」 | 只有行程頁改 `document.title`（`TripPage.tsx:419`），其他頁都是 `Tripline` | 每頁設「頁名 · 行程名 — Tripline」，app 名放尾端，方便分辨多個瀏覽器分頁【推論：網頁加站名是慣例，不違反 HIG 的本意】。行程頁離開時要還原 | ✅ | S 0.5d | P2 |
| H8 | 自訂捷徑與標準捷徑 | Keyboards：「Respect standard keyboard shortcuts」「In general, don't repurpose standard keyboard shortcuts」；`Option-Command-F`＝「Jump to the search field control」；`Esc`＝取消 | 沒有全域捷徑 | 最小集合：`⌥⌘F`（或 `/`）聚焦頁內搜尋；`⌥⇧N` 新增行程或景點（比照 iCloud Mail 的「Compose a new email: Option-Shift-N」，避開瀏覽器的 `⌘N`）；`⌘Z` **不做**（無 undo，ADR-0008／W12）。用 `aria-keyshortcuts` 標示，並在 tooltip 顯示 | ✅ | S–M 1–1.5d | P2 |
| H9 | Sidebar 階層與分組 | Sidebars：「Group hierarchy with disclosure controls if your app has a lot of content」「no more than two levels」；[Layout](https://developer.apple.com/design/human-interface-guidelines/layout)「Use progressive disclosure」 | 「我的行程」是單一平面清單，沒有分組 | 分成「進行中／即將出發」「過去」兩組，可收合，已歸檔不列入；分組依日期自動產生 | ✅ 文字分組，不加色 | M 1.5d，**prototype gate**（清單結構變化） | P3 |
| H10 | Sidebar 搜尋或篩選 | [Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields)（iPadOS, macOS）：「Include search at the top of the sidebar when filtering content or navigation there」「Put a search field at the trailing side of the toolbar for many common uses」 | 行程列表的搜尋是展開按鈕；sidebar 沒有過濾 | 行程超過 N 筆時，在「我的行程」上方放 scoped 過濾欄，placeholder「搜尋行程」（`TripTitleSwitcher` 已有 >8 筆才顯示的搜尋邏輯，可抽出共用） | ✅ | M 1d，**prototype gate** | P3 |
| H11 | 多選 | `DESIGN.md:842`「批次：⌘／⇧ 多選」；iCloud.com Mail：「Select multiple emails: Command-Click」「Select consecutive emails: Shift-Up/Down Arrow」 | 收藏頁有勾選模式（`PoiFavoritesPage.tsx:344`），沒有 `⌘`／`⇧` 點選 | 收藏格線支援 `⌘`-click 切換、`⇧`-click 範圍選取，接到既有的 `selectedIds` | ✅ | M 1.5d | P3 |
| H12 | Tooltip | [Offering help](https://developer.apple.com/design/human-interface-guidelines/offering-help)：tooltip「avoid repeating a control's name」「limit… 60 to 75 characters」 | icon-only 鈕的 `title` 直接重複 aria-label（例：`TripsListPage.tsx`「新增景點」） | 有捷徑的鈕，tooltip 改成「說明＋捷徑」；沒有額外資訊的維持現狀 | ✅ | S（併入 H8） | P3 |
| H13 | 斷點文件與程式不一致 | 【網頁要求】無；屬自家 SoT 一致性 | `DESIGN.md:374,378` 要求 `pointer: fine`，程式只判斷寬度 | 二選一：改文件（承認寬螢幕 iPad 橫向也走桌機版），或程式補 `pointer: fine`。見第 6 節 D6 | ⚠️ | S 0.5d（任一方向） | P2 |
| H14 | 過時註解 | — | `DesktopSidebar.tsx:2-5` 描述與 `DESIGN.md:347` 相反 | 改註解 | ✅ | XS | P3 |
| H15 | Sidebar 底部的關鍵資訊 | Sidebars（macOS）：「Avoid putting critical information or actions at the bottom of a sidebar」；[Layout](https://developer.apple.com/design/human-interface-guidelines/layout)（macOS）同義 | 帳號 chip 在左下（owner 決策） | **不建議改**。瀏覽器視窗被拖出螢幕底部的情境有限，帳號也不是高頻的關鍵動作【推論】。列為需討論 D4 | ⚠️ | — | — |

---

## 4. Apple Web 產品可借鏡處

### 4.1 Apple Maps on the web（beta）

**驗證方式**：抓取 `https://maps.apple.com/` 的 SSR HTML。

**驗證到的結構**：
- 全畫面地圖：`#shell-map role="application" aria-label="Map"`。
- 左側導覽，頂部有 `<button class="nav-expand-button" aria-expanded="true" aria-controls="shell-nav" aria-label="Toggle sidebar">`，符號用 `sidebar-left-semibold`。
- 導覽項目：Search／Guides／Directions，每項都是 icon＋文字。
- 卡片用 `#shell-tray` 托盤呈現。
- 字型從 `apple.com/wss/fonts` 載入 SF Pro。

**可借鏡處**：
1. **Sidebar 切換鈕放在 sidebar 標頭、正確標上 `aria-expanded`／`aria-controls`**：直接作為 H4／H6 的 Web 實作範本。
2. 地圖全出血，加上浮動的導覽與卡片托盤。Tripline 地圖頁已經是這個方向（`DESIGN.md` Map exception），不需要改。

**不借鏡**：SF Pro 字型（Tripline 保留 Inter，owner 決策）。

**未驗證**：互動後的卡片、路線規劃 UI 是 client 端渲染，本次沒看到。

### 4.2 Apple Music on the web（music.apple.com）

**驗證方式**：抓取 `/us/browse` 的 SSR HTML，未登入。

**驗證到的結構**：
- `<nav data-testid="navigation">`：標頭是 logo，導覽依序為 **Search**、Home、New、Radio。
- 內容區是水平 shelf（`shelf-grid--onhover`），有「Previous Page／Next Page」翻頁鈕。
- 每個項目都有 `aria-label="MORE"` 的更多鈕，共 150 個。
- 底部是浮動播放列（`player-bar__floating-player`）。

**可借鏡處**：
1. **搜尋是 sidebar 的第一個項目**，對應 HIG Search fields「Include search as an item in the sidebar… when you want an area dedicated to discovery」。Tripline 的「探索」目前是收藏頁右上的次要入口（`DESIGN.md` §Unified App Shell）。這是 owner 決策（v2.21.0 降級），**不建議改 IA**，只在第 6 節備註。
2. **每個項目都有「更多」選單，hover 時才顯示翻頁控制**。與 Tripline timeline 列的 hover ⋯ 一致，可延伸到收藏卡與 sidebar 行程列（併入 H2）。

**未驗證**：登入後 sidebar 的「資料庫／播放列表」分組外觀。

### 4.3 iCloud.com（Mail、Notes、Reminders、Calendar）

**驗證方式**：各 App 要登入，**只依 Apple Support 文件**。

**已驗證的文件內容**：
- [Sidebar 詞彙](https://support.apple.com/en-asia/guide/icloud/aside/mme7d598d0)：「The column on the left side of the window on iCloud.com. The contents of the sidebar change depending on which iCloud feature you're using.」
- [Mail 鍵盤捷徑](https://support.apple.com/en-us/guide/icloud/mm281e20de/icloud)：
  - `Option-Shift-N` 新郵件
  - `Delete` 刪除所選
  - `Shift-Command-D` 送出
  - `Command-Click`／`Shift-↑↓` 多選
  - `Command-Z`／`Shift-Command-Z` 復原與重做
  - `Command-Down Arrow` 封存
- [Notes 建立筆記](https://support.apple.com/en-au/guide/icloud/mmc0cd6edf/icloud)：「Create a note」鈕在「the top-right corner of the Notes toolbar」；筆記列表依修改時間排序。

**可借鏡處**：
1. **瀏覽器內的捷徑刻意加修飾鍵，避開瀏覽器保留鍵**（新增用 `⌥⇧N` 而不是 `⌘N`）。這是 H8 的直接依據。
2. 「新增」放在 toolbar 右上，與 Tripline 標題列右側主要動作一致，現況已符合。
3. sidebar 內容隨目前功能改變，支持 H1：sidebar 的行程清單應該服務目前分頁。

**未驗證**：Notes、Reminders、Calendar 在 iCloud.com 的實際 sidebar 收合鈕位置與右鍵選單。support 文件只提到「Open Sidebar」按鈕，本次沒有取得原文頁。

### 4.4 apple.com 商店與支援頁

**驗證方式**：抓取 HTML。

**驗證到的結構**：
- 全站 global nav（`#globalnav-list`），含搜尋（`#globalnav-menubutton-link-search`）與購物袋（`#globalnav-bag`）。
- 搜尋欄 placeholder 為「Search apple.com」，明示搜尋範圍。

**可借鏡處**：**placeholder 寫明範圍**，對應 HIG Searching「Clearly display the current scope of a search」。Tripline 的「搜尋行程名稱或地區」（`TripsListPage.tsx:893`）、「搜尋收藏（名稱 / 地址 / 備註）」已符合。

**其他**：這兩個是行銷站，不是 App，其他互動不適合套用到 Tripline【推論】。

---

## 5. Web ↔ Flutter 一致性差距表

「以誰為準」的判準依序如下：

1. 已有 ADR 或明文 owner 決策的一方。
2. 有一手實測證據（像素、HIG 原文）的一方。
3. 功能已上線、後端已支援的一方。

兩邊各有 owner 決策時，列為需討論。

| # | 項目 | Web 現況 | Flutter 現況 | 以誰為準 | 建議 | 工作量 |
|---|---|---|---|---|---|---|
| P1 | 切換行程後的分頁 | 桌機 sidebar 點行程 → 一律跳行程分頁（`DesktopSidebar.tsx:277`）；手機與桌機標題 switcher 維持原頁 | 「切換後維持目前 section」（`DESIGN.md:106`） | **Flutter**（有明文決策；Web 標題 switcher 本身也已這樣做，只有 sidebar 例外） | 同 H1 | S–M 1–1.5d |
| P2 | 帳號入口圖示 | 手機顯示姓名首字（`AccountCircle.tsx:64-73`）；桌機 chip 顯示首字＋名稱 | 固定 `person.crop.circle`，不顯示縮寫（`DESIGN.md:72`） | **Flutter**。Web 自己的 `DESIGN.md:349` 也寫 `person.crop.circle`，grill v2「web 鏡像 app #82」 | 手機改 `person.crop.circle` 線條圖示，保留 aria-label「帳號」。**桌機 sidebar chip 保留名稱**，這是 macOS sidebar 帳號列的合理延伸，且是 owner 決策（帳號左下） | S 0.5d |
| P3 | 「行程」tab 圖示 | 房子（`Icon.tsx:106-108`，註解寫「house／map／heart… 跨 web+mobile 一致」，但 App 不是房子） | `suitcase`／`suitcase.fill`（`DESIGN.md:39`） | **Flutter**（DESIGN 表格明文） | 改成 SF 風格線條行李箱；註解一併修正 | S 0.25d |
| P4 | 選中 tab 的圖示 | 同一個描邊圖示，靠實心膠囊表示選中 | 選中用 filled variant（`DESIGN.md:45`） | **Flutter**（HIG Tab bars；Web 在 grill v2 ⑤ 選了「SF-風描邊 icon」，沒禁止 filled） | 補四個 `-fill` 變體，選中時換用。若 D1 改中性底，這項更重要 | S 0.5d |
| P5 | 選取樣式（tab、sidebar、Day tab） | 實心 `--color-accent-fill`＋白字（`DESIGN.md:483,510`，owner 2026-07-24） | 中性底＋tint 前景（`DESIGN.md:222`，ADR-0004 像素實測） | **需討論**（兩邊都有 owner 或 ADR 決策） | 見第 6 節 D1 | M 2–3d（若統一） |
| P6 | 深色柔褐 | `--color-accent-fill: #CBA06E`（`tokens.css:1073`）；文字 `#E0BC90`（`:1062`） | `#D0A576`；前景 tintDeep `#E5C39F`（`tokens.dart:42-43`；`GLOSSARY.md:104`「全產品單一值」） | **Flutter**（GLOSSARY 定義為產品單一值；Web GLOSSARY 沒有定義） | 深色 accent 與 fill 改 `#D0A576`。實算對 `#1C1C1E` 是 7.56:1、對 `#2C2C2E` 是 6.19:1，都高於現值 7.12。文字色 `#E0BC90` 與 `#E5C39F` 擇一，需重跑焦點框對比守門 | S 0.5d |
| P7 | 淺色柔褐當文字 | 文字也用 `#8A6038`（對奶油底 5.35:1） | 前景文字 `#6F4C2C`，`#8A6038` 只當底色（`DESIGN.md:329`） | **需討論**。Web 已有 #1572 收斂決策，且 5.35 達 AA；Flutter 的拆分是為了在選取底上也達 6.2:1 | 只有 D1 改成中性底時才需要跟進（中性底上的柔褐字要夠深）；否則維持 | S |
| P8 | 背景與 surface 配色 | 暖奶油 `#FFFBF5`；深色 base `#1C1C1E` | 系統白／深色 base `#000000`，elevated 才是 `#1C1C1E`（`tokens.dart:10,47`） | **不統一**。Web 的 warm editorial 是 owner 品牌決策，App 的系統色是 ADR 決策，兩平台各自合理 | 不建議改，列 D5 備查 | — |
| P9 | 字型 | Inter＋Noto Sans TC（owner 例外） | 系統 SF（`DESIGN.md:360`） | **不統一**（owner 例外） | 不改 | — |
| P10 | Day 選擇器文字 | 時間軸 `DAY N`（大寫；DaySection 是 `DAY 01` 補零）；地圖第一項「總覽」 | `Day N`；地圖第一項「全部」（`DESIGN.md:180`） | **需 owner 選一個**。大寫 eyebrow 是 Web editorial 風格；「全部／總覽」純粹是用詞不一 | 至少統一「全部」或「總覽」其中一個（建議「全部」，與 App 的篩選用詞一致【推論】）；大小寫可維持平台差異 | S 0.25d |
| P11 | 聊天送出鍵 | Enter 送出、Shift+Enter 換行（`ChatPage.tsx:784`） | Return 換行、`⌘Return` 送出（`DESIGN.md:174`） | **兩者並存**。桌機網頁 Enter 送出是常見慣例；App 的 `⌘Return` 是外接鍵盤慣例 | Web **加上** `⌘Enter`／`Ctrl+Enter` 也能送出（不移除 Enter），讓兩邊都會的人不出錯 | S 0.25d |
| P12 | 行程歸檔 | 有「已歸檔」篩選與歸檔動作（`TripsListPage.tsx:843-848`） | 篩選只有全部／我的／共編，沒有歸檔（`trips_list_screen.dart:373-375`） | **Web**（功能已上線、API 已支援） | Flutter 補「已歸檔」篩選＋⋯ 選單裡的歸檔／取消歸檔（確認文案照抄 Web） | M 2d（Flutter） |
| P13 | 行程列表搜尋 | 展開式按鈕（`.tp-trips-search-toggle`） | 內容頂端常駐 inline search field（`DESIGN.md:149`） | **Flutter**（DESIGN 明文；HIG 建議 macOS 搜尋放 toolbar trailing 或 sidebar 頂部，兩者都是常駐欄位） | Web 桌機改常駐搜尋欄（手機可維持展開式以省空間）。版面變化需 prototype gate | S–M 1d |
| P14 | regular／桌機的 Account | 右側 480px 抽屜＋暗背景（`AccountSheet.tsx:24-34`） | 置中 form sheet，最大 560×720（`DESIGN.md:254`） | **Flutter＋HIG**：[Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)（macOS）「a sheet is a cardlike view with rounded corners that floats on top of its parent window」 | 桌機 Account 改置中卡片型 sheet。owner 決策只說「Account sheet／popover」，沒有指定從右側滑入。屬版面變化，**需 prototype gate** | M 1.5d |
| P15 | 平板寬度 | <1024 一律手機版（`DESIGN.md:378`「不再維護 tablet-specific 斷點」） | ≥720 就是 regular（頂部 tab＋320pt 行程清單；ADR-0009） | **需討論**（各有決策） | 見 D6 | — |
| P16 | 刪除與 Undo | 不可逆，用確認框（W12）；可復原那一列目前沒有使用處 | 不可逆、沒有 Undo（ADR-0008） | **已一致** | 不需動作。H8 因此不做 `⌘Z` | — |
| P17 | 標題列 trailing 順序 | 主要動作 · ⋯ · 帳號（`DESIGN.md` Compact header trailing） | 同（`DESIGN.md:67`） | **已一致** | — | — |

---

## 6. 與 owner 決策衝突、需討論的事項

| # | 議題 | 衝突內容 | 我的建議 |
|---|---|---|---|
| D1 | **選取樣式：實心柔褐 vs 中性底＋柔褐前景** | Web 在 2026-07-24 把 Day tab、sidebar、底部 tab 統一成實心 accent（`DESIGN.md:483,510`）。Flutter ADR-0004 以 iOS 26「電話」App 的像素掃描指出「強調色在前景，不在背景」，並推翻了相反的 ADR-0003。HIG [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)：「By default, sidebar icons use your app's accent color」。HIG [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)：「Reduce the use of toolbar backgrounds and tinted controls」 | 請 owner 決定「兩平台統一一套」或「Web 保留實心」。若要統一，建議以 ADR-0004 為準，因為它有像素證據。這樣也順帶解決 D2。動到全站選取元件，需 prototype gate。2–3 人日 |
| D2 | **Sidebar 同時出現兩塊實心柔褐** | 在 `/chat` 時，主導覽「聊天」與「我的行程」裡的目前行程都是 accent-fill（`DesktopSidebar.tsx:76,104`；`DesktopSidebarConnected.tsx:35-40`）。HIG Split views 是「每個窗格」各有一個選取；同一欄出現兩個同等強度的選取，會讓人看不出哪個是目前位置【推論】 | 行程清單的「目前行程」降一階（例如 `--color-hover` 底＋前景加粗，或左側細指示條）。這動到 owner 寫的「active trip 套 accent」（`DESIGN.md:478`），需確認。S 0.5d |
| D3 | **Sidebar 主導覽的玻璃疊玻璃** | `.tp-sidebar-nav` 套 `--tabbar-*` 玻璃材質（`DesktopSidebar.tsx:53-63`），放在本身就是 vibrancy 玻璃的 sidebar 裡（`:26`）。owner 2026-07-21 要求和手機膠囊共用材質。Flutter 文件引用 Apple「avoid overcrowding or layering Liquid Glass elements on top of each other」（`flutter/DESIGN.md:351`，[Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)） | 不主動改。若 D1 啟動版面重做，可順便評估「sidebar 主導覽去掉內層玻璃，只靠 sidebar 本身的 vibrancy」 |
| D4 | **帳號 chip 在 sidebar 左下** | HIG Sidebars（macOS）：「Avoid putting critical information or actions at the bottom of a sidebar」。Layout（macOS）有同義條文 | **維持 owner 決策**。瀏覽器視窗底部被拖出螢幕的情境很少，帳號也不是任務關鍵動作【推論】。只記錄依據，不建議改 |
| D5 | 暖奶油 palette、Inter vs App 的系統色、SF | Flutter「HIG 必須」使用系統動態色與系統字。Web 是 owner 的品牌例外 | **維持**。兩平台各有決策，品牌一致性靠單一柔褐 tint（P6 修正後）承擔 |
| D6 | **桌機斷點與平板** | `DESIGN.md:374,378` 寫 `pointer: fine`，程式沒有。寬螢幕 iPad 橫向（≥1024）目前會拿到三欄桌機版，其中的 hover-only ⋯ 鈕在觸控上看不到（`@media (hover: hover)` 外是 opacity 0）。App 則在 ≥720 就走 regular | 先決定 SoT：(a) 程式補 `pointer: fine`，觸控大螢幕走手機版；或 (b) 改文件接受觸控桌機版，並確保 hover-only 控制在 `(hover: none)` 時常駐。建議 (b) 加補常駐，與 App「寬度決定版型」（ADR-0009）同精神【推論】。S–M |
| D7 | 桌機標題列動作帶文字標籤 | HIG Toolbars：「Prefer simple, recognizable symbols for items instead of text」「Keep actions with text labels separate」。Web 桌機 `.tp-titlebar-action` 是 icon＋文字（`DESIGN.md` §Page Titlebar，owner 決策） | 維持。中欄較窄的行程詳情已改 icon-only（`TripsListPage.tsx`「§9.5」註解）。只建議多個文字鈕相鄰時保留間距 |
| D8 | 探索的位置 | Apple Music web 把 Search 放 sidebar 第一項；HIG 也支持「search as an item in the sidebar」。Tripline 在 v2.21.0 把探索降為收藏頁的次要入口 | 不建議改 IA（owner 決策）。只記錄：若未來探索變重要，sidebar 是 Apple 的慣用位置 |
| D9 | P10「全部」vs「總覽」、`DAY` 大小寫 | 純用詞與風格 | 請 owner 選一個 |

---

## 7. 建議路線圖與總工作量

工作量以一位熟悉 codebase 的工程師計，含測試，不含 prototype 簽核等待時間。

**第 1 批：一致性與自家規範補齊（不動版面，不需 prototype）約 5–6.5 人日**

| 項目 | 工作量 |
|---|---|
| H1／P1 sidebar 行程點選維持分頁 | 1–1.5d |
| H2＋H3 右鍵選單＋Delete 鍵（沿用現有選單） | 2.5–3.5d |
| P2 手機帳號圓圈、P3 行程 tab 圖示、P4 filled 選中圖示、P6 深色柔褐 token | 約 1.5d |
| P11 聊天 ⌘Enter、H14 過時註解 | 約 0.25d |

**第 2 批：桌機效率（部分需 prototype）約 4–5.5 人日**

| 項目 | 工作量 |
|---|---|
| H7 每頁 `document.title` | 0.5d |
| H8／H12 最小捷徑集＋tooltip | 1–1.5d |
| H13／D6 斷點 SoT 定案（含 hover-only 控制在觸控時常駐） | 0.5–1d |
| H4／H6 可收合 sidebar（prototype gate） | 2d＋簽核 |

**第 3 批：版面改進（全部需 prototype）約 11–13 人日**

| 項目 | 工作量 |
|---|---|
| P14 桌機 Account 置中 sheet | 1.5d |
| P13 常駐搜尋欄 | 1d |
| H9 sidebar 行程分組 | 1.5d |
| H10 sidebar 過濾 | 1d |
| H11 ⌘／⇧ 多選 | 1.5d |
| H5 可拖分隔線 | 3–4d |
| P12 Flutter 歸檔（在 Flutter repo） | 2d |

**owner 2026-11-14 定案後追加**：

| 項目 | 批次 | 工作量 |
|---|---|---|
| P10 Day 文字與「全部」 | 第 1 批 | 0.25d |
| D1＋D2＋P7 選取樣式統一（prototype gate；D3 已由 #1690 解決） | 第 2 批 | 2–3d＋簽核 |
| P15 Web 720–1023px 寬版版型（prototype gate） | 第 3 批 | 未估 |

**總計**（含定案追加，不含 P15）：
- 第 1 批約 5.5–7 人日，第 2 批約 6–8.5 人日，第 1＋2 批約 **11.5–15.5 人日**
- 全部約 **22.5–28.5 人日**，另加 P15

---

## 8. 來源清單

### Apple HIG（2026-11-14 從 `developer.apple.com/tutorials/data/design/human-interface-guidelines/*.json` 取得原文）

| 頁面 | 頁內最新 change log 日期 |
|---|---|
| [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars) | 2026-06-08 |
| [Split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | 2025-06-09 |
| [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars) | 2025-12-16 |
| [Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields) | 2026-06-08 |
| [Searching](https://developer.apple.com/design/human-interface-guidelines/searching) | 2026-06-08 |
| [Context menus](https://developer.apple.com/design/human-interface-guidelines/context-menus) | 2023-12-05 |
| [Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards) | 2025-06-09 |
| [Undo and redo](https://developer.apple.com/design/human-interface-guidelines/undo-and-redo) | 未記 |
| [Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | 2026-09-09 |
| [Windows](https://developer.apple.com/design/human-interface-guidelines/windows) | 2025-06-09 |
| [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) | 2026-03-24 |
| [Popovers](https://developer.apple.com/design/human-interface-guidelines/popovers) | 未記 |
| [Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) | 未記 |
| [Materials](https://developer.apple.com/design/human-interface-guidelines/materials) | 2025-09-09 |
| [The menu bar](https://developer.apple.com/design/human-interface-guidelines/the-menu-bar) | 未記（Show/Hide Sidebar 項目） |
| [Offering help](https://developer.apple.com/design/human-interface-guidelines/offering-help) | 2023-12-05 |
| [Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass) | 轉引自 `flutter/DESIGN.md:351`，本次未重抓 |

### Apple 網頁（2026-11-14 抓取）

- https://maps.apple.com/ ：SSR HTML 的 `#shell-nav` 結構
- https://music.apple.com/us/browse ：SSR HTML 的 `nav[data-testid=navigation]`
- https://www.apple.com/store 、https://support.apple.com/ ：global nav 與搜尋欄
- [Keyboard shortcuts in Mail on iCloud.com](https://support.apple.com/en-us/guide/icloud/mm281e20de/icloud)
- [iCloud.com Sidebar 詞彙](https://support.apple.com/en-asia/guide/icloud/aside/mme7d598d0)
- [Create notes on iCloud.com](https://support.apple.com/en-au/guide/icloud/mmc0cd6edf/icloud)

### 程式碼與文件

- Web：`DESIGN.md`、`css/tokens.css`、`src/components/shell/{AppShell,DesktopSidebar,DesktopSidebarConnected,AccountSheet,AccountCircle,navItems}.tsx`、`src/pages/{TripsListPage,TripStackLayout,ChatPage,MapPage,PoiFavoritesPage,TripPage}.tsx`、`src/components/trip/{TimelineRail.styles.ts,DayNav.tsx}`、`src/components/shared/Icon.tsx`、`index.html`
- Flutter：`DESIGN.md`、`GLOSSARY.md`、`docs/adr/0004、0009`、`lib/theme/tokens.dart`、`lib/features/shell/app_shell.dart`、`lib/features/trips/trips_list_screen.dart`、`lib/features/chat/chat_screen.dart`、`lib/models/display_format.dart`、`lib/features/trip_detail/trip_map_screen.dart`

### 未驗證（明確標記）

- **prod 實際畫面**：要登入，全部依原始碼判斷。像素層級的視覺差異（例如 D3 玻璃疊加的實際觀感）沒有看到。
- **iCloud.com 各 App 的實際 UI**：要登入，只依 support 文件；Notes／Reminders／Calendar 的 sidebar 收合鈕與右鍵選單沒有驗證。
- **Apple Maps web、Apple Music web 的 client 端渲染部分**：卡片互動、登入後的資料庫 sidebar。
- **瀏覽器保留鍵**：「Chrome／Safari 不允許網頁攔截 `⌘N`／`⌘W`／`⌘T`」是我的既有認知，本次沒查官方文件。H8 改用修飾鍵組合，就是為了不依賴這個前提。
- **macOS 的 Show/Hide Sidebar 標準捷徑鍵**：HIG The menu bar 只列出選單項目，本次沒在 HIG 找到對應鍵位，所以沒有建議特定組合。
- **工作量估計**：粗估，沒有拆票驗證。
