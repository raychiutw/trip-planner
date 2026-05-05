## ADDED Requirements

### Requirement: POI 收藏池 D1 schema

D1 SHALL 提供 `poi_favorites` 表作為使用者跨 trip 的 POI 收藏池單一來源。表結構：`id` (PK auto)、`user_id` (FK users.id ON DELETE CASCADE)、`poi_id` (FK pois.id ON DELETE CASCADE)、`favorited_at` (DEFAULT datetime('now'))、`note` (nullable)。約束 UNIQUE `(user_id, poi_id)`。INDEX `idx_poi_favorites_poi(poi_id)` 加速 trip_pois JOIN。

#### Scenario: 表存在且結構正確
- **WHEN** migration 0050 在 prod D1 apply 完成
- **THEN** `PRAGMA table_info(poi_favorites)` SHALL 回傳 5 欄（id / user_id / poi_id / favorited_at / note）
- **AND** `PRAGMA index_list(poi_favorites)` SHALL 含 `idx_poi_favorites_poi` + UNIQUE auto-index for (user_id, poi_id)
- **AND** `PRAGMA foreign_key_list(poi_favorites)` SHALL 含 user_id → users.id ON DELETE CASCADE 與 poi_id → pois.id ON DELETE CASCADE

#### Scenario: UNIQUE 約束防重複收藏
- **WHEN** 使用者已收藏某 POI，再次 INSERT 同 (user_id, poi_id)
- **THEN** D1 SHALL 拋 UNIQUE constraint failed 錯誤
- **AND** API handler SHALL 轉為 `DATA_CONFLICT` HTTP 409

#### Scenario: POI 刪除時連動清空
- **WHEN** admin DELETE FROM pois WHERE id = ?
- **THEN** ON DELETE CASCADE SHALL 自動清空所有引用該 poi_id 的 poi_favorites rows

#### Scenario: User 刪除時連動清空
- **WHEN** user 帳號刪除（users 表 row 移除）
- **THEN** ON DELETE CASCADE SHALL 自動清空該 user_id 的 poi_favorites rows

### Requirement: POST /api/poi-favorites 新增收藏

API SHALL 提供 `POST /api/poi-favorites` 端點供 V2 OAuth 使用者新增收藏，body 接受 `{ poiId, note?, companionRequestId? }`。Auth 來源：V2 session OR companion mapping（見 tp-companion-mapping 能力）。Rate limit `10/min` per effective user。POI 不存在 → 404。重複收藏 → 409。

#### Scenario: V2 user 新增收藏成功
- **WHEN** authed user POST `/api/poi-favorites { poiId: 123 }`
- **THEN** D1 SHALL INSERT (user_id, 123, null) into poi_favorites
- **AND** API SHALL 回 201 + RETURNING row

#### Scenario: poiId 缺失或無效
- **WHEN** body 缺 poiId 或 poiId 非正整數（含 0、負數、字串）
- **THEN** API SHALL 拋 `DATA_VALIDATION` HTTP 400

#### Scenario: POI 不存在
- **WHEN** poiId 對應 pois 表無 row
- **THEN** API SHALL 拋 `DATA_NOT_FOUND` HTTP 404

#### Scenario: 重複收藏
- **WHEN** 使用者已收藏 poi 123，再次 POST poiId=123
- **THEN** API SHALL 拋 `DATA_CONFLICT` HTTP 409

#### Scenario: Rate limit 觸發
- **WHEN** 同一 user 1 分鐘內 POST 第 11 次
- **THEN** API SHALL 回 429 + `Retry-After` header
- **AND** admin user SHALL 不受 rate limit 影響

### Requirement: GET /api/poi-favorites 列出收藏 with usages

API SHALL 提供 `GET /api/poi-favorites` 列出 authed user 所有收藏，每筆 row 帶 `usages_json` 陣列描述該 POI 目前出現在哪些 trip / day / entry。Usages SHALL 只回傳 user 自己有 read 權限的 trip（owner 或 trip_permissions row）防 cross-user data leak。Anonymous SHALL 回空陣列（不拋 401）。

#### Scenario: V2 user 列出收藏
- **WHEN** authed user GET `/api/poi-favorites`
- **THEN** API SHALL 回 200 + 陣列，每筆含 `id, user_id, poi_id, poi_name, poi_address, poi_lat, poi_lng, poi_type, favorited_at, note, usages`
- **AND** `usages` SHALL 為陣列含 `{ tripId, tripName, dayNum, dayDate, entryId }` 物件

#### Scenario: Usages 防 cross-user leak
- **WHEN** user A 收藏 poi 999、user B 也收藏 poi 999 並把它放進 B 的私人 trip
- **THEN** user A 的 GET response 中 poi 999 的 usages SHALL 不包含 B 的 trip 資訊

#### Scenario: Anonymous 不拋 401
- **WHEN** 未 authed 使用者 GET `/api/poi-favorites`
- **THEN** API SHALL 回 200 + 空陣列（不暴露 401 為 user enumeration oracle）

### Requirement: DELETE /api/poi-favorites/:id 移除收藏

API SHALL 提供 `DELETE /api/poi-favorites/:id` 移除單筆收藏。Owner check：auth.userId === row.user_id OR isAdmin。非 owner → 403。row 不存在 → 404。

#### Scenario: Owner 刪除自己收藏
- **WHEN** authed user DELETE 自己的 poi_favorites id
- **THEN** D1 SHALL DELETE 該 row
- **AND** API SHALL 回 204

#### Scenario: 非 owner 嘗試刪除
- **WHEN** authed user A 嘗試 DELETE user B 的 poi_favorites id
- **THEN** API SHALL 拋 `PERM_DENIED` HTTP 403

#### Scenario: row 不存在
- **WHEN** 嘗試 DELETE 不存在的 id
- **THEN** API SHALL 拋 `DATA_NOT_FOUND` HTTP 404

### Requirement: POST /api/poi-favorites/:id/add-to-trip fast-path

API SHALL 提供 `POST /api/poi-favorites/:id/add-to-trip` 從收藏快速加入指定 trip。Body：`{ tripId, dayNum, startTime, endTime }`（純時間驅動，4 fields）。Auth：owner OR admin + 對 tripId 有 hasWritePermission。`travel_*` 欄位 NULL（背景 tp-request fill）。Server SHALL 依 startTime 自動計算 sort_order 插入點（不接受 position / anchorEntryId 參數）。同 day 時段衝突 → 409 + `conflictWith` 結構。

#### Scenario: Fast-path 成功加入行程（時間自動排序）
- **WHEN** authed owner POST `/api/poi-favorites/{id}/add-to-trip { tripId, dayNum: 2, startTime: '12:00', endTime: '13:30' }`
- **THEN** server SHALL 依 startTime '12:00' 找該 day 中既有 entries 的時間點，計算 sort_order 插入位置（在 startTime 之前最後一個 entry 之後）
- **AND** D1 SHALL INSERT 一筆 trip_entries + 一筆 trip_pois（`source: 'fast-path'`）
- **AND** API SHALL 回 201 + `{ entryId, dayId, sortOrder, startTime, endTime }`

#### Scenario: 同 day 時段衝突
- **WHEN** 加入 entry 時段與既有 entry 重疊（newStart < entryEnd AND newEnd > entryStart）
- **THEN** API SHALL 回 409 + `{ error: 'CONFLICT', conflictWith: { entryId, time, title, dayNum } }`
- **AND** 不執行 INSERT（client 端 ConflictModal 顯示三選 action 由 user 決定）

#### Scenario: 拒絕 legacy position 參數
- **WHEN** body 含 position 或 anchorEntryId 欄位
- **THEN** API SHALL 拋 `DATA_VALIDATION` HTTP 400「欄位 position / anchorEntryId 已廢除，請只傳 startTime / endTime」

#### Scenario: startTime / endTime 缺失或無效
- **WHEN** body 缺 startTime 或 endTime，或值非 HH:MM 格式
- **THEN** API SHALL 拋 `DATA_VALIDATION` HTTP 400

#### Scenario: 非 owner 嘗試加入別人的 trip
- **WHEN** user A POST add-to-trip 至 user B 的 private trip
- **THEN** API SHALL 拋 `PERM_DENIED` HTTP 403（hasWritePermission false）

### Requirement: PoiFavoritesPage 頁面行為

`/favorites` route SHALL 渲染 PoiFavoritesPage，含 TitleBar「收藏」+ hero（eyebrow 「YOUR FAVORITES POOL / 你的跨行程收藏池」+ count meta + region pill row + type filter chip row + search input）+ POI grid（含「目前在 N 個行程」usage badge + per-card「加入行程 →」link）。

#### Scenario: 0 favorites 隱藏 filters
- **WHEN** user GET `/favorites` 且收藏池為空
- **THEN** UI SHALL 渲染 `tp-empty-cta` block + 文案「還沒有收藏」+ CTA「去探索找景點」→ navigate `/explore`
- **AND** SHALL 隱藏 region pill / type filter / search input

#### Scenario: 50 favorites 標準 grid
- **WHEN** user GET `/favorites` 收藏 50 筆
- **THEN** UI SHALL 渲染 grid（1024+ 3-col、640-1023 2-col、<430 1-col、max-width 1040px）+ controls 在 hero 下方 12px

#### Scenario: 200+ favorites sticky search + pagination
- **WHEN** user GET `/favorites` 收藏 200+ 筆
- **THEN** search input SHALL 升為 sticky toolbar 置頂
- **AND** count meta 降為 hero meta 文字
- **AND** grid SHALL 啟用 pagination 或 windowing（react-window 或等價）

#### Scenario: per-card 加入行程 link
- **WHEN** user 點某 card 的「加入行程 →」link
- **THEN** SHALL navigate 至 `/favorites/{id}/add-to-trip`

#### Scenario: 多選 toolbar 只支援 delete
- **WHEN** user select ≥1 card
- **THEN** 顯示底部 sticky toolbar（DESIGN.md form 規範同 pattern）含「全選 / 取消選擇 / 刪除 N 筆」三個 action
- **AND** SHALL NOT 提供 batch add-to-trip（per-card link 為唯一 add-to-trip 入口）

### Requirement: PoiFavoritesPage 8-state matrix

PoiFavoritesPage MUST 涵蓋 8 個狀態：loading / empty-pool / filter-no-results / error / data / optimistic-delete / bulk-action-busy / pagination。每個狀態 SHALL 有明確 UI + 對應 token / shared component。

#### Scenario: loading state
- **WHEN** 初次進入 page，fetch in-flight
- **THEN** UI SHALL 渲染 `tp-skel` skeleton 3-card grid

#### Scenario: filter-no-results state
- **WHEN** user 輸入 search 或選 filter chip 後 0 筆 match
- **THEN** UI SHALL 渲染 `tp-empty` block + 「沒有符合條件的收藏」+ 「清空篩選」reset 按鈕

#### Scenario: error state
- **WHEN** GET `/api/poi-favorites` 5xx
- **THEN** UI SHALL 渲染 `<PageErrorState>` shared component + retry button

#### Scenario: optimistic-delete state
- **WHEN** user 點刪除某 card
- **THEN** card SHALL 立刻 opacity 0.5 + label「移除中…」+ `aria-live` announce
- **AND** DELETE 成功後 SHALL 從 grid 移除
- **AND** DELETE 失敗 SHALL 復原 opacity + toast error

#### Scenario: bulk-action-busy state
- **WHEN** user select N 筆 + 點「刪除」
- **THEN** toolbar button SHALL disabled + spinner + label「刪除中（N/M）…」
- **AND** N 筆全部 DELETE 完成後 SHALL 清空 selection + toast success

#### Scenario: pagination state
- **WHEN** 收藏 ≥ 200 筆
- **THEN** UI SHALL 啟用 windowing 或 page-based pagination
- **AND** scroll 到 bottom SHALL load more 或顯示 page navigation

### Requirement: AddPoiFavoriteToTripPage 頁面行為

`/favorites/:id/add-to-trip` route SHALL 渲染 AddPoiFavoriteToTripPage（full page，非 modal），含 **4-field 純時間驅動 form**：trip dropdown / day dropdown / startTime / endTime（廢除 position radio 與 anchorEntryId 欄位）。TitleBar SHALL title 靠左 + 左側返回 button（取消用）+ 右側無 confirm action。「加入行程」primary button SHALL 置中放在 form 欄位下方（`.tp-form-actions` wrapper）。Desktop viewport SHALL 用 2-col grid layout（trip+day 同列、startTime+endTime 同列），phone viewport ≤760 SHALL stack 單欄且 button 自動 full-width。

#### Scenario: Form 4 fields 渲染
- **WHEN** user GET `/favorites/{id}/add-to-trip`
- **THEN** form SHALL 渲染 4 個 fields：trip dropdown / day dropdown / startTime / endTime
- **AND** SHALL 用 stay-duration heuristic 預填 startTime/endTime by POI type（restaurant 90min / attraction 120min 等）
- **AND** SHALL NOT 含 position radio group 或 anchorEntryId field

#### Scenario: Desktop 2-col grid layout
- **WHEN** viewport ≥ 1024px
- **THEN** form SHALL 用 2-col grid：trip + day 同列、startTime + endTime 同列
- **AND** form max-width SHALL 為 720px

#### Scenario: 提交按鈕置中放表單下方
- **WHEN** form data state（fields 已填）
- **THEN** 「加入行程」primary button SHALL 包在 `.tp-form-actions` wrapper 內、置中對齊、放在 4 個 field 下方
- **AND** TitleBar 右側 SHALL NOT 含 confirm action（取消由左側返回 button 處理）

#### Scenario: trip 變更觸發 day 重載
- **WHEN** user 切換 trip dropdown
- **THEN** day field SHALL 顯示 `tp-skel` 1-row skeleton 直到 days fetched
- **AND** day dropdown SHALL 重新載入該 trip 的 days
- **AND** 「加入行程」primary button SHALL disabled 直到 day 載入完成

#### Scenario: Phone viewport stack 單欄
- **WHEN** viewport ≤ 760px
- **THEN** form 4 fields SHALL stack 單欄
- **AND** 「加入行程」button SHALL 自動延展為 full-width（提升 tap area）

#### Scenario: 7-state matrix
- **WHEN** form 處於各狀態（loading / empty-no-trip / conflict / error / success / optimistic / partial）
- **THEN** UI SHALL 對應 7-state 規範
- **AND** conflict state SHALL 用 ConflictModal pattern（取代既有 entry / 改插入後面 / 取消 三選 action）

### Requirement: companion_request_actions 防灌爆 table

D1 SHALL 提供 `companion_request_actions(request_id, action, poi_id, created_at)` 表，UNIQUE `(request_id, action)`。每個 trip_request 對每個 action（`favorite_create` / `favorite_delete` / `add_to_trip`）只能寫一筆。companion 路徑 INSERT 此表後再執行真實業務操作；UNIQUE 衝突時 → 409 `COMPANION_QUOTA_EXCEEDED`。

#### Scenario: 同 requestId 多次 favorite_create
- **WHEN** companion 路徑用同 requestId POST 第 2 次 `/api/poi-favorites`（不同 poiId）
- **THEN** companion_request_actions 第 2 次 INSERT 違反 UNIQUE
- **AND** API SHALL 回 409 `COMPANION_QUOTA_EXCEEDED`

#### Scenario: 同 requestId 不同 action 允許
- **WHEN** companion 路徑同 requestId 先 POST favorite_create，再 POST add-to-trip
- **THEN** 兩筆 INSERT 都成功（action 欄位不同 → UNIQUE 不衝突）

### Requirement: 命名 stack 全 rename `saved` → `poi-favorites`

整個 stack 命名 SHALL 從 `saved-pois` / `saved_pois` / `SavedPoi` / `savedPois` / `isSaved` 全 rename 為 `poi-favorites` / `poi_favorites` / `PoiFavorite` / `poiFavorites` / `isPoiFavorited`。前端 route 從 `/saved` rename 為 `/favorites`、`/saved-pois/:id/add-to-trip` rename 為 `/favorites/:id/add-to-trip`。CSS class `.saved-*` 全 rename 為 `.favorites-*`。

#### Scenario: Hard cutover 不留 alias
- **WHEN** PR ship 後，舊 `/api/saved-pois` 或 `/saved` URL 被請求
- **THEN** server SHALL 404（不留 backward-compat redirect 或 alias）

#### Scenario: Naming consistency check
- **WHEN** PR pre-merge gate 跑 `git grep -nE "saved[-_]?pois|SavedPoi|savedPois|isSaved\b|/saved\b|saved-error|saved-count" -- src/ functions/api/ css/ tests/`
- **THEN** active 範圍 SHALL 0 matches（archive/ 與 docs/2026-04-* 例外）

### Requirement: UI label 統一「收藏」+ ownership eyebrow

UI label SHALL 全部統一「收藏」（廢除 DESIGN.md L298 asymmetric「我的收藏」/「收藏」設計）。為補回 ownership 語意，PoiFavoritesPage hero eyebrow SHALL 寫「YOUR FAVORITES POOL」（英文 eyebrow 慣例）+ count meta 句型「N 個地點，已用於 M 個行程」。LoginPage feat title SHALL 從「我的收藏跟著你」rename 為「收藏跟著你」。

#### Scenario: TitleBar title 靠左對齊
- **WHEN** user 在 PoiFavoritesPage
- **THEN** TitleBar title SHALL 為「收藏」靠左對齊（flex:1 layout，對齊 css/tokens.css:1277-1289 production 規範）
- **AND** SHALL NOT 為「我的收藏」

#### Scenario: DesktopSidebar nav label
- **WHEN** user 在 desktop viewport
- **THEN** Sidebar 第 4 slot label SHALL 為「收藏」（不是「我的收藏」）

#### Scenario: Hero eyebrow 補 ownership
- **WHEN** PoiFavoritesPage 處於 data state（≥1 favorite）
- **THEN** hero SHALL 渲染 `tp-page-eyebrow` 內容 `YOUR FAVORITES POOL` + count meta「N 個地點，已用於 M 個行程」
