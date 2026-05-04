## ADDED Requirements

### Requirement: TitleBar title 靠左對齊

所有主功能頁 TitleBar SHALL 用 flex layout（不是 grid），title 為 `flex: 1` 自然靠左對齊（不可 `text-align: center`）。對齊 css/tokens.css:1257-1316 production 規範。Title font: desktop ≥761 為 20px / line-height 28px / weight 700、compact ≤760 為 18px / line-height 24px / weight 700，letter-spacing -0.01em。TitleBar 高度: desktop 64px、compact 56px，padding desktop 0 24px、compact 0 16px，glass blur 14px + hairline border-bottom。

#### Scenario: Desktop title 靠左
- **WHEN** viewport ≥ 1024px 渲染 PoiFavoritesPage
- **THEN** TitleBar title「收藏」SHALL 靠左對齊（緊接 TitleBar padding-left 後）
- **AND** font-size 20px、line-height 28px、font-weight 700、letter-spacing -0.01em

#### Scenario: Phone title 靠左
- **WHEN** viewport ≤ 760px 渲染 PoiFavoritesPage
- **THEN** TitleBar title 同樣靠左對齊
- **AND** font-size 18px、line-height 24px、font-weight 700

#### Scenario: 有左側返回 button 時 title 仍靠左
- **WHEN** AddPoiFavoriteToTripPage 渲染（含 `.tp-titlebar-back`）
- **THEN** title 緊接 back button 後（gap 12px）
- **AND** title `flex: 1` 推 actions（如有）靠右

#### Scenario: 全 page 一致
- **WHEN** 任何 PoiFavoritesPage / AddPoiFavoriteToTripPage frame 渲染
- **THEN** SHALL NOT 用 grid 3-col layout 強制 title 置中
- **AND** SHALL NOT 設 `text-align: center` 在 title

## MODIFIED Requirements

### Requirement: Per-page right action 對映表（unified-layout-plan.md 表格）

各主功能頁 TitleBar right action MUST 對齊 `docs/design-sessions/2026-04-27-unified-layout-plan.md` 表格（衝突時 mockup 為準），下列對映 MUST 全數實作：

- 聊天：桌機無、手機無
- 行程列表：桌機「搜尋 + 新增 `+`」、手機「新增 `+`」
- 行程詳情：桌機「建議 + 共編 + 下載 + 更多 `⋯`」、手機「更多 `⋯`」+ 左側返回
- 地圖：桌機「行程切換 + 定位」、手機「行程切換」
- 探索：桌機「收藏」、手機「收藏」
- 收藏：桌機「探索（search icon）」、手機「探索（search icon）」
- 帳號：桌機無、手機無

#### Scenario: 行程列表 titlebar 桌機 actions
- **WHEN** 使用者在桌機 `/trips`
- **THEN** TitleBar actions 從左到右為「搜尋 icon button」+「新增 `+` icon button」

#### Scenario: 行程詳情 titlebar 手機 actions
- **WHEN** 使用者在手機 `/trip/:id`
- **THEN** TitleBar 左側「返回」icon button、右側僅「更多 `⋯`」icon button（其餘 actions 收進 menu）

#### Scenario: 探索 titlebar 收藏（廢除 asymmetric label）
- **WHEN** 使用者開啟 `/explore`（不分桌機 / 手機）
- **THEN** TitleBar 右側顯示「收藏」icon button（heart icon）→ navigate `/favorites`
- **AND** label SHALL NOT 為「我的收藏」（廢除 v2.21.0 asymmetric labels 設計）

#### Scenario: 收藏 titlebar 探索
- **WHEN** 使用者開啟 `/favorites`（不分桌機 / 手機）
- **THEN** TitleBar 中間文字 SHALL 為「收藏」（不是「我的收藏」）
- **AND** TitleBar 右側顯示「探索」icon button（search icon ghost variant）→ navigate `/explore`

## ADDED Requirements

### Requirement: PoiFavoritesPage 頁面 layout

`/favorites` route SHALL 渲染 PoiFavoritesPage 對齊 DESIGN.md 規範：TitleBar「收藏」+ hero（eyebrow + count meta + region pill row + type filter chip row + search input）+ POI grid + 多選底部 sticky toolbar。Token drift 6 項全對齊：使用 `tp-page-eyebrow` / `tp-skel` / `tp-empty-cta` / `<PageErrorState>` / `<EmptyState>` / `tp-action-btn` family 共用 token / shared component（不可自寫 `.saved-*` / `.favorites-toolbar-btn` 等）。

#### Scenario: Hero hierarchy by 收藏數量
- **WHEN** user 收藏 0 筆
- **THEN** UI SHALL 渲染 `tp-empty-cta` block + 隱藏 filters（region pill / type filter / search input）

- **WHEN** user 收藏 50 筆
- **THEN** grid 為主 + controls 在 hero 下方 12px

- **WHEN** user 收藏 200+ 筆
- **THEN** search input 升為 sticky toolbar 置頂 + count 降為 meta + 啟用 pagination/windowing

#### Scenario: Viewport breakpoints
- **WHEN** viewport ≥ 1024px AND pointer: fine
- **THEN** card grid SHALL 3-col + max-width 1040px

- **WHEN** viewport 640-1023px
- **THEN** card grid SHALL 2-col

- **WHEN** viewport < 430px
- **THEN** card grid SHALL 1-col

#### Scenario: Token drift 對齊
- **WHEN** 元件渲染各狀態
- **THEN** loading SHALL 用 `tp-skel`（非自寫 `.saved-skeleton-card`）
- **AND** empty SHALL 用 `tp-empty-cta` + `<EmptyState>` 組合（非自寫 `.saved-empty-cta`）
- **AND** error SHALL 用 `<PageErrorState>` shared component（非自寫 `.saved-error`）
- **AND** eyebrow SHALL 用 `tp-page-eyebrow` class（非自寫 `.saved-eyebrow`）
- **AND** 多選 toolbar button SHALL 用 `tp-action-btn` / `tp-action-btn-ghost` / `tp-action-btn-destructive` shared button family（非自寫 `.saved-toolbar-btn` 系列）
- **AND** 頁面 scoped CSS SHALL 在 `css/pages/poi-favorites.css`（不用 inline `<style>` 注入）

#### Scenario: A11y 規範
- **WHEN** 渲染 type filter chip row
- **THEN** wrapper SHALL `role="group" aria-label="POI 類型篩選"`（不是 `role="tablist"`）
- **AND** 每個 chip SHALL 為 `<button aria-pressed={selected}>`（不是 `role="tab"`）
- **AND** region pill row 同 pattern

- **WHEN** 渲染 selection checkbox per card
- **THEN** checkbox SHALL `aria-label={\`選取 \${row.poiName}\`}`

- **WHEN** card 進入 optimistic-delete 狀態
- **THEN** card SHALL 含 `aria-live="polite"` 區塊宣告「移除中…」狀態文字

- **WHEN** ExplorePage heart toggle 渲染
- **THEN** button SHALL 含 `aria-pressed={isFavorited}` 表達 toggle state

#### Scenario: 8-state matrix 完整覆蓋
- **WHEN** PoiFavoritesPage 處於各狀態（loading / empty-pool / filter-no-results / error / data / optimistic-delete / bulk-action-busy / pagination）
- **THEN** UI SHALL 對應 8-state matrix 規範（取代既有 5-state）

### Requirement: AddPoiFavoriteToTripPage layout

`/favorites/:id/add-to-trip` route SHALL 渲染 AddPoiFavoriteToTripPage（full page，非 modal）。**4-field 純時間驅動 form**：trip dropdown / day dropdown / startTime / endTime（廢除 position radio + anchorEntryId 欄位，server 依 startTime 自動排序）。Desktop ≥1024 SHALL 用 2-col grid + max-width 720px；phone ≤760 SHALL stack 單欄。「加入行程」primary button SHALL 置中放在 form 欄位下方（`.tp-form-actions` wrapper），TitleBar 右側 SHALL NOT 含 confirm action（取消由左側返回 button 處理）。

#### Scenario: Form 4 fields
- **WHEN** user GET `/favorites/{id}/add-to-trip`
- **THEN** form SHALL 渲染 trip dropdown / day dropdown / startTime / endTime 4 個 fields
- **AND** stay-duration heuristic 預填 startTime/endTime by POI type（restaurant 90min / shopping 60min / attraction 120min / parking 15min / transport 30min / activity 90min / hotel overnight / other 60min）
- **AND** SHALL NOT 含 position radio 或 anchorEntryId field

#### Scenario: Desktop 2-col grid
- **WHEN** viewport ≥ 1024px
- **THEN** form SHALL 用 2-col grid（trip + day 同列、startTime + endTime 同列）
- **AND** form max-width SHALL 為 720px

#### Scenario: Phone single column + button full-width
- **WHEN** viewport ≤ 760px
- **THEN** form 4 fields SHALL stack 單欄
- **AND** 「加入行程」button SHALL 自動延展為 full-width

#### Scenario: 提交按鈕置中放表單下方
- **WHEN** form 渲染
- **THEN** 「加入行程」primary button SHALL 包在 `.tp-form-actions` wrapper 內，置中對齊放在 4 個 field 下方
- **AND** TitleBar SHALL 含左側 `.tp-titlebar-back` 返回 button 為取消手段
- **AND** TitleBar 右側 SHALL NOT 含 `.tp-titlebar-action.is-primary` confirm button

#### Scenario: trip → day skeleton
- **WHEN** user 切換 trip dropdown
- **THEN** day field SHALL 立刻顯示 `tp-skel` 1-row skeleton 直到 days fetched（避免 layout jump）
- **AND** 「加入行程」primary button SHALL disabled 直到 day 載入完成

### Requirement: Primary nav label 統一「收藏」

DesktopSidebar 第 4 slot label SHALL 為「收藏」（廢除 v2.21.0 asymmetric「我的收藏」設計）。GlobalBottomNav 第 4 tab label SHALL 為「收藏」（不變）。兩處 label 一致。Ownership 語意改由 PoiFavoritesPage hero eyebrow 補回（不再依賴 nav label disambiguation）。

#### Scenario: DesktopSidebar label
- **WHEN** user 在 desktop viewport 渲染 Sidebar
- **THEN** 第 4 slot key='favorites' label='收藏' href='/favorites'
- **AND** SHALL NOT 為「我的收藏」

#### Scenario: GlobalBottomNav label 不變
- **WHEN** user 在 compact viewport 渲染 BottomNav
- **THEN** 第 4 tab key='favorites' label='收藏' href='/favorites'

#### Scenario: 兩處 label 一致
- **WHEN** 同 user 在 desktop + compact 切換
- **THEN** Sidebar 與 BottomNav 第 4 slot label SHALL 一致為「收藏」
