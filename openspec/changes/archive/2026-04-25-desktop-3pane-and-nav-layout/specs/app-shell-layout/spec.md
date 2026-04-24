## ADDED Requirements

### Requirement: AppShell 提供桌機 3-pane + 手機 bottom-nav 統一 layout
系統 SHALL 提供 `<AppShell>` React component，內部包：
- 桌機 (`≥ 1024px`)：CSS grid `grid-template-columns: 240px 1fr min(780px, 40vw)`（sidebar / main / right sheet slot），3 個 grid areas
- 手機 (`< 1024px`)：單欄 main + bottom nav sticky
- Right sheet slot 可為 null（不 render 第三 column，grid template 變 `240px 1fr`）

Props: `{sheet?: ReactNode, children: ReactNode}`。所有 authenticated route（`/manage`, `/trip/:id`, `/chat`, `/map`, `/explore`, `/admin`, `/login`）SHALL wrap in AppShell。

#### Scenario: 桌機有 sheet 的頁面
- **WHEN** user 在桌機 `≥ 1024px` 訪問 `/trip/:id` 且頁面傳 `sheet={<TripMapRail />}`
- **THEN** AppShell render 3-column grid：左 sidebar 240px / 中 main fluid / 右 sheet slot render `<TripMapRail />`
- **AND** sheet 的 width = `min(780px, 40vw)`

#### Scenario: 桌機無 sheet 的頁面
- **WHEN** user 在桌機訪問 `/manage` 且頁面沒傳 `sheet` prop
- **THEN** AppShell render 2-column grid：左 sidebar 240px / 中 main fluid（無右 column）

#### Scenario: 手機任何頁面
- **WHEN** user 在 viewport `< 1024px` 訪問任何 AppShell-wrapped 頁面
- **THEN** layout 變單欄 main + sticky bottom nav
- **AND** 不 render sidebar 或 sheet（只 render `children`，sheet 傳入 prop 被忽略或降級）

### Requirement: AppShell 的 main content 保留 bottom padding 給 mobile nav
手機 viewport 下，AppShell 的 main content SHALL 套用 `padding-bottom: 88px`（或對應 CSS variable），避免 bottom nav 覆蓋頁底內容。桌機該 padding 歸零。

#### Scenario: 手機頁面內容不被 nav 遮
- **WHEN** user 在手機滾動到頁面底部
- **THEN** 最後一個可見內容 SHALL 距離 bottom nav 頂端至少 16px（含 padding），不被遮
- **AND** padding-bottom 透過 media query 套用，僅 `< 1024px` 啟用

### Requirement: AppShell 的 sidebar / sheet 在 modal 開啟時的 layering
當有 modal (primary overlay) 開啟時：
- 桌機：sidebar SHALL 保持可見（modal center 在 main + sheet 區域）
- 手機：full-screen cover modal 蓋住整個 viewport（含 bottom nav）

#### Scenario: 桌機開 modal sidebar 不被遮
- **WHEN** 桌機開啟 "Create Trip" modal
- **THEN** modal 位置 center 在 main + sheet 區，不覆蓋 sidebar
- **AND** backdrop dim 只覆蓋 main + sheet，不覆蓋 sidebar

#### Scenario: 手機 full-screen cover 遮 bottom nav
- **WHEN** 手機開啟 Create Trip full-screen cover
- **THEN** overlay z-index 高於 bottom nav
- **AND** bottom nav 自然被遮住（使用者關 cover 後 nav 立即恢復 visible）

### Requirement: Bottom Nav 常駐，不隨 scroll 收合
手機的 `<BottomNavBar>` SHALL 使用 `position: sticky; inset-block-end: 0` 永遠可見，不實作 hide-on-scroll 行為。包含 iOS safe-area 補正 `padding-bottom: env(safe-area-inset-bottom)`。

#### Scenario: 使用者向下滾動
- **WHEN** 手機使用者滾動 main content
- **THEN** bottom nav SHALL 保持 visible
- **AND** 不 animate 消失 / 出現

#### Scenario: iOS Safari 上的 safe area
- **WHEN** 使用者在 iPhone Safari 訪問
- **THEN** bottom nav bottom 內建 `env(safe-area-inset-bottom)` 避免被 home indicator 遮
- **AND** 整體 nav 高度 ≥ 80px（含 safe area 約 88-96px）
