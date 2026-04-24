## ADDED Requirements

### Requirement: `/explore` page 提供搜尋 + 儲存池 + 加到 trip 三功能
系統 SHALL 提供 `/explore` route，使用 `<AppShell>` 套殼；內部分兩 section：
1. **搜尋 section**（上）：search bar + category filter chips + 結果卡片 list
2. **儲存池 section**（下或右）：已儲存 POI 清單 + 加到某 trip 的 action

桌機 layout: 左 search column + 右 儲存池 column（內部 grid）；手機：上下堆疊，儲存池 default collapse。

#### Scenario: 使用者首次進入 /explore
- **WHEN** 未搜尋過
- **THEN** 搜尋 section 顯示 placeholder「搜尋景點 / 餐廳 / 飯店 / 購物...」
- **AND** category filter chips 全 inactive（default = 全部）
- **AND** 儲存池 section 顯示已儲存清單（若 empty 則「尚未儲存 POI，搜尋後點儲存」）

#### Scenario: 使用者搜尋「沖繩」
- **WHEN** 輸入「沖繩」並 submit
- **THEN** 呼叫 `GET /api/poi-search?q=沖繩&category=all`
- **AND** 結果 render 成 POI cards
- **AND** 每卡有「儲存」button（若未儲存）或「已儲存 ✓」狀態（若已儲存）

#### Scenario: 使用者點 category chip 過濾
- **WHEN** 使用者點「餐廳」chip
- **THEN** 重新呼叫 `/api/poi-search` 加 `category=food`
- **AND** 結果更新為餐廳類 POI

### Requirement: Explore POI card 有儲存 button
每張 POI card SHALL 顯示 POI 圖片（若無則 placeholder）+ 名稱 + 地址 + 類別 chip + 儲存 button（若未儲存顯示「+ 儲存」）或 checkmark（已儲存）。

#### Scenario: 點儲存 button
- **WHEN** 使用者點「+ 儲存」
- **THEN** 呼叫 `POST /api/saved-pois { poiId }`
- **AND** button 變 「已儲存 ✓」
- **AND** 儲存池 section 即時更新（無需手動 refresh）

#### Scenario: 重複儲存同 POI
- **WHEN** 使用者對已儲存 POI 再按 button
- **THEN** 按鈕呈現 disabled state
- **AND** （不彈 duplicate conflict toast，已 ✓ 本身就是 feedback）

### Requirement: 儲存池 section 顯示已儲存 POI + 加到 trip action
儲存池 section SHALL 呼叫 `GET /api/saved-pois` 取清單，每項顯示 POI 資訊 + 「加到行程」button。

#### Scenario: 點「加到行程」button
- **WHEN** 使用者點某儲存 POI 的「加到行程」
- **THEN** 彈 trip picker modal 顯示使用者所有 trips
- **AND** 使用者選一個 trip + optional 選 Day（default 為 Ideas 不選 Day）
- **AND** submit 後呼叫 `POST /api/trip-ideas { tripId, poiId, title }`
- **AND** 成功後 toast「已加到 XX 的 Ideas」

#### Scenario: 使用者只有一個 trip
- **WHEN** 使用者只有 1 個 trip
- **THEN** trip picker modal 仍顯示（不 auto-pick）但 trip list 只有一項
- **AND** one-click 即可 add

#### Scenario: 使用者還沒任何 trip
- **WHEN** 使用者 trip 列表為空
- **THEN** trip picker 顯示「你還沒有 trip，先建立一個？」CTA
- **AND** click 導到 Create Trip modal（Phase 3 實作）

### Requirement: 儲存池支援移除
每儲存 POI SHALL 提供「移除儲存」選項（icon button 或 menu item）。

#### Scenario: 移除儲存 POI
- **WHEN** 使用者點移除
- **THEN** 呼叫 `DELETE /api/saved-pois/:id`
- **AND** 成功後 card 從儲存池消失
- **AND** 可選 undo toast 5 秒內可還原
