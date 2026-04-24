## ADDED Requirements

### Requirement: Trip sheet 的 open/close state 由 `?sheet` query param 驅動
當 URL 有 `?sheet=<tab>`（tab ∈ {itinerary, ideas, map, chat}），`<TripSheet>` SHALL 展開且顯示對應 tab。URL 無此 param 或值無效（不在上述 4 個），sheet SHALL 關閉（或在 TripPage 預設展開 itinerary）。

#### Scenario: 使用者訪問 `/trip/:id?sheet=ideas`
- **WHEN** 使用者以此 URL 進入
- **THEN** TripSheet 展開
- **AND** 顯示 Ideas tab 內容
- **AND** 其他 3 個 tab 的 header 顯示為 inactive

#### Scenario: 使用者訪問 `/trip/:id` 無 sheet param
- **WHEN** 沒 `?sheet=`
- **THEN** 預設展開 itinerary tab（`/trip/:id` 等同 `/trip/:id?sheet=itinerary` 的 UX，但 URL 不 rewrite）

#### Scenario: 使用者訪問 `/trip/:id?sheet=foo`（無效 tab 名）
- **WHEN** 值為 `foo`（不在 allowed tabs）
- **THEN** TripSheet 降級為關閉（或預設 itinerary）
- **AND** 不 throw error
- **AND** console warn 可選（dev only）

### Requirement: 切 tab 使用 `navigate({search}, {replace: true})`
TripSheet 切 tab 時 SHALL 用 `replace: true` 更新 URL，不 push history。使用者 back button 回到打開 sheet 前的頁面，不按 tab 順序 replay。

#### Scenario: 使用者切 Ideas → Map tab
- **WHEN** 使用者在 `?sheet=ideas` 點「Map」tab
- **THEN** URL 變 `?sheet=map` 但 history length 不增加（replace）
- **AND** 按 back button 回到 tab 外（可能回到 `/manage`）

### Requirement: Sheet 關閉移除 `sheet` param
關閉 sheet（點 close X）SHALL 用 `replace` 移除 `?sheet=` param，URL 變 `/trip/:id`（無 sheet query）。

#### Scenario: 關 sheet
- **WHEN** 使用者點 sheet 的 close X
- **THEN** URL 變 `/trip/:id`（無 query param）
- **AND** sheet 收起
- **AND** main content 擴寬（grid template 從 3-col 變 2-col）

### Requirement: `/trip/:id/map` 301 redirect 到 `?sheet=map`
既有 sub-route `/trip/:id/map` SHALL 自動 redirect（SPA Router Navigate）到 `/trip/:id?sheet=map`。此 redirect rule 保留至少 2 週（讓 bookmark / external link 過渡），之後可移除。

#### Scenario: 使用者訪問舊 URL
- **WHEN** 使用者輸入或 bookmark `/trip/okinawa-trip-2026-Ray/map`
- **THEN** URL 自動變 `/trip/okinawa-trip-2026-Ray?sheet=map`
- **AND** TripSheet 展開且顯示 Map tab

### Requirement: Back/Forward button 自然運作
當使用者點 browser back / forward 按鈕，URL 變化 SHALL reflect sheet state（展開 + tab）改變，且 TripSheet 對應更新。

#### Scenario: 使用者 back button
- **WHEN** 使用者從 `/trip/:id?sheet=ideas` 按 browser back
- **THEN** URL 回到 push 此 URL 之前的狀態（可能是 `/manage`）
- **AND** TripSheet 不再 render（因為已離開 /trip/:id）

### Requirement: Ideas tab 基本 list + add 功能（無 drag）
Ideas tab 內部 SHALL 呼叫 `GET /api/trip-ideas?tripId=xxx` 列出當前 trip 的 ideas，提供一個 `+ Add idea` button 觸發 modal 新增（Phase 1 的 POST API）。不實作 drag（Phase 5）、不做 promote-to-itinerary 的 drag（Phase 5），但提供一個「排入行程」text button 呼叫 PATCH API。

#### Scenario: Ideas tab 載入
- **WHEN** 使用者打開 Ideas tab
- **THEN** 呼叫 `GET /api/trip-ideas?tripId={current}` 並 render cards
- **AND** 空狀態顯示「尚無 idea，點 + Add 新增」

#### Scenario: 新增 idea
- **WHEN** 使用者點「+ Add idea」
- **THEN** 彈 modal 輸入 title / note（選填 poi）
- **AND** POST 成功後 refresh list

#### Scenario: Ideas → Itinerary promote（text-based，Phase 3 版）
- **WHEN** 使用者點某 idea 的「排入行程」button
- **THEN** 彈 day picker + 時段 input
- **AND** PATCH `trip-ideas/:id { promotedToEntryId: new-entry }` + 同時 INSERT trip_entries
- **AND** idea 狀態變 promoted
- **AND** 排入 itinerary tab 的 timeline

### Requirement: Chat / Map tab 在 Phase 3 為 placeholder / 既有 render
Chat tab SHALL 顯示 "AI chat 功能將於 Phase 4+ 開放" 佔位畫面。Map tab SHALL render 既有 `<TripMapRail>` component（既有 UI 邏輯不動）。

#### Scenario: 使用者點 Chat tab
- **WHEN** sheet=chat
- **THEN** 顯示佔位「AI chat 功能將於 Phase 4+ 開放，目前請至 /manage 使用 AI 編輯」

#### Scenario: 使用者點 Map tab
- **WHEN** sheet=map
- **THEN** render 既有 `<TripMapRail>` 對應此 trip 的 POI markers
- **AND** Map UI 行為與 Phase 2 時相同（無新 feature）
