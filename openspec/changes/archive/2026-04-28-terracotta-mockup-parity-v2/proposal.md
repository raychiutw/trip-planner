## Why

`docs/design-sessions/terracotta-preview-v2.html` 是 Terracotta 設計系統 v2 的權威 layout spec（7,950 行 / 14 個 page section + 5 個 design-token 參考 section），但 React 實作跟 mockup 之間累積了 **~46 missing / 42 inconsistent / 11 extra finding**，跨 13 個 components + 1 個整頁缺漏（Account hub）。Audit 結果在本 change `design.md` 的 §Audit 詳載。

不對齊的後果：
- mockup 是 design source of truth，跟實作 drift 後設計 review 失去 reference 基準（每次 /design-review 都得重判）
- 部分缺漏屬於 visible regression（如 Account hub 整頁缺、Add Stop Modal 不是 modal、Stop card 用 emoji 當 icon），不是 polish
- 多個 mockup-defined affordance（travel pill、TripsListPage filter subtabs、Explore POI cover 卡）user 已知預期但拿不到

## What Changes

按主題拆 5 個 capability，每個獨立 implement + ship（不互相依賴），可分批進 PR：

- **icon-svg-sweep**（HIGH，跨 component）：emoji unicode (`🗑 ✕ ⛶ ⎘ ⇅ 🔍 ✓`) → 既有 `<Icon name="..." />` SVG sprites，對齊 CLAUDE.md「icon 用 inline SVG，不用 emoji」+ mockup section 12 lead 明文吐槽
- **account-hub-page**（HIGH，新 page）：新建 `/account` route + `src/pages/AccountPage.tsx`，mockup section 19 規範的 Profile hero (avatar + name + email + 3 stats) + 3 group settings rows（應用程式 / 共編 & 整合 / 帳號）+ 登出 destructive row，整合既有 `/settings/sessions` `/settings/connected-apps` `/settings/developer-apps` 為入口
- **add-stop-modal-redesign**（HIGH，重構）：`InlineAddPoi` day-level inline expand → trip-level modal 4-tab pattern（搜尋 / 收藏 / 自訂 + region selector + filter + 推薦 chips），POI card 改 2-col grid with cover photo，batch select footer（mockup section 14）
- **bottom-nav-ia-decision**（HIGH，**product 決策題先**）：mockup 5-tab global（聊天/行程/地圖/探索/帳號）vs React 4-tab trip-scoped（行程/地圖/助理/更多）的 IA reconciliation。本 capability 第一個 task 是跑 office-hours / CEO review 收斂方向後再實作
- **ui-parity-polish**（MEDIUM/LOW，跨 section sweep）：DesktopSidebar active state / NewTripModal 文案 + 多目的地拖拉 / DayNav eyebrow / TripsListPage filter+search+owner avatar / ChatPage day divider+AI avatar / ExplorePage POI cover+heart+region+subtabs / MapPage FAB / Error & Status 新 `tp-alert-panel`

每個 capability 獨立可 ship；`bottom-nav-ia-decision` 在 product 決策出來前不解鎖實作 task。

## Capabilities

### New Capabilities

- `terracotta-icon-svg-sweep`：跨 component emoji-to-SVG icon 替換的 contract（哪些 emoji / 對應 Icon name / 視覺 spec）
- `terracotta-account-hub-page`：新 unified Account hub `/account` 的 layout / nav entry / settings rows / data 來源 contract
- `terracotta-add-stop-modal`：trip-level modal 4-tab pattern 的結構 / interaction model / batch flow / 三 tab 各自 spec
- `terracotta-ui-parity-polish`：各 section 的 mockup-aligned 視覺/結構 finding 集合 spec

### Modified Capabilities

- `mobile-bottom-nav`：mockup 規定 5-tab IA「聊天/行程/地圖/探索/帳號」vs 既有 4-tab「行程/地圖/助理/更多」的 requirement 替換，含 product decision 的 prerequisite

## Impact

- **新 page**：`src/pages/AccountPage.tsx` + 對應 route in `src/entries/main.tsx`；可能新建 `NotificationsSettingsPage.tsx`（mockup 通知設定 row 目前完全沒對應 page）
- **修改 components**：
  - `src/components/shell/DesktopSidebar.tsx`（active state 顏色 / 暗底 / 「帳號」nav item）
  - `src/components/shell/BottomNavBar.tsx`（IA 對齊後的 tab list）
  - `src/components/shell/TitleBar.tsx`（actions slot button label vs icon-only）
  - `src/components/trip/TimelineRail.tsx`（icon emoji → SVG）
  - `src/components/trip/InlineAddPoi.tsx`（重構為 modal 或新建 `<AddStopModal>` 取代）
  - `src/components/trip/NewTripModal.tsx`（多目的地拖拉 + 文案 + tabs）
  - `src/components/trip/DaySection.tsx`（day hero title vs area）
  - `src/components/trip/DayNav.tsx`（eyebrow 格式）
- **修改 pages**：
  - `src/pages/TripPage.tsx`（titlebar actions 文字 + travel pill 介接）
  - `src/pages/TripsListPage.tsx`（filter subtabs + search + sort + owner avatar）
  - `src/pages/ChatPage.tsx`（day divider + AI avatar + bubble timestamp prefix）
  - `src/pages/ExplorePage.tsx`（POI cover + heart icon + region + subtabs）
  - `src/pages/GlobalMapPage.tsx` + `MapPage.tsx`（FAB / titlebar trip switcher）
- **新 component**：`<AlertPanel>` (`tp-alert-panel`) persistent banner with warning/error variants
- **無 breaking change**：所有變動是視覺/結構對齊，data model / API / route 設計不變（除新增 `/account` route）
- **依賴**：無新 npm dep；`@dnd-kit/core` 已有（NewTripModal 多目的地拖拉重用 Section 6 ideas-drag 帶來的 dnd-kit）
- **測試**：每 capability 自帶 unit test；`/account` route 加 Playwright E2E；emoji sweep 加 source-grep contract test 防 regression
- **參考**：mockup 完整在 `docs/design-sessions/terracotta-preview-v2.html`，audit 細節在本 change `design.md` §Audit
