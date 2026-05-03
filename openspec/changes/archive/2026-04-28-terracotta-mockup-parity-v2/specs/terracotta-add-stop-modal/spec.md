## ADDED Requirements

### Requirement: 新建 `<AddStopModal>` 取代 `<InlineAddPoi>` 為加景點 entry

對應 mockup section 14 (line 6428-6714)。`InlineAddPoi` day-level inline expand 模式改為 trip-level modal，UI 跟 interaction model 對齊 mockup 4-frame 規範。

新 component `src/components/trip/AddStopModal.tsx`：
- Modal layout（backdrop + centered card），開啟由 trip detail page-level「+ 加入景點」button 觸發
- Header: 標題「加景點」+ 「DAY 03 · 7/31（五）」meta + close button
- Region selector pill「沖繩 ▾」(default 用 trip.countries) + 「📋 篩選」 ghost button
- 3 tabs：搜尋 / 收藏 / 自訂
- 每 tab content 區
- Footer: 「已選 N 個 · 將加入 Day 03 · 7/31」+ 取消 / 完成 buttons

舊 `InlineAddPoi.tsx` 在本 capability 完成後移除（trigger 從每 DaySection 末尾改為 TripPage TitleBar actions 加「+ 加入景點」 chip 或 trip detail content top）。

#### Scenario: 點 trip-level「+ 加入景點」 trigger
- **WHEN** 使用者在 trip detail page 點「+ 加入景點」 trigger
- **THEN** AddStopModal 以 modal pattern 開啟（backdrop + center card + Esc 關閉 + click backdrop 關閉）
- **AND** modal Header 顯示當前選中 day（`activeDayNum`）的 meta
- **AND** 預設停留在「搜尋」tab

#### Scenario: 切換 day 在 modal 內
- **WHEN** 使用者在 modal 內切換 day（切 day picker 或切 modal-internal day chip）
- **THEN** modal Header meta 更新為新 day
- **AND** Footer 「將加入 Day X」更新

### Requirement: 「搜尋」tab 含 region selector + subtab chips + POI grid

「搜尋」tab 內容：
1. Subtab chips：為你推薦 / 景點 / 美食 / 住宿 / 購物（POI category filter）
2. POI 2-col grid card，每張 card 含：
   - Cover photo (`tp-add-poi-card-cover` with `data-tone` placeholder when no real photo)
   - Name + ★ rating + distance
   - 多選 checkbox（batch add）
3. 點 POI card 切多選狀態
4. 「為你推薦」subtab 預設顯示 region 內 trending POI（用 `/api/poi-search?q=trending&region={region}` 或類似）

#### Scenario: 預設 subtab「為你推薦」+ 沖繩 region
- **WHEN** 使用者開啟 modal「搜尋」tab
- **THEN** 顯示 region selector「沖繩 ▾」+ subtab chips 5 項，「為你推薦」active
- **AND** 顯示 2-col POI grid（推薦 POI list）

#### Scenario: 切 subtab「美食」
- **WHEN** 使用者點 subtab「美食」chip
- **THEN** 重新 fetch POI list filtered by category=`restaurant`
- **AND** Grid 重 render 美食 POI

### Requirement: 「收藏」tab 對接既有 saved POI store

「收藏」tab 列出 user 既有 saved POI（同 ExplorePage `我的收藏` tab data source `/api/saved-pois`），但提供 batch add to 當前 trip 的 inline UX：
- POI grid 同搜尋 tab 結構，每 card 含 checkbox
- 預設無選取，使用者勾選後 footer counter 更新

ExplorePage 「我的收藏」tab 既有功能不變（仍然可以從 explore 進來 multi-select + 加入行程），AddStopModal 「收藏」 tab 是同 data 的另一 entry point。

#### Scenario: 切「收藏」tab 顯示 user 的 saved POI
- **WHEN** 使用者點「收藏」tab
- **THEN** GET `/api/saved-pois` + render 2-col grid
- **AND** Card 跟「搜尋」tab 結構一致（cover / name / rating / checkbox）

#### Scenario: 「收藏」tab 無資料
- **WHEN** 使用者尚未儲存任何 POI
- **THEN** 顯示 empty state「還沒收藏任何 POI」+ link「去探索找 POI」 navigate `/explore`

### Requirement: 「自訂」tab 提供 manual entry form

「自訂」tab 是純 form：
- 標題（required）
- 地址（optional，typeahead 用 Nominatim）
- 開始時間 / 結束時間（time picker）
- 類型 select（attraction / restaurant / hotel / shopping / other）
- 預估停留 number input（min）
- 備註 textarea

提交時 POST `/api/trips/:id/days/:num/entries` 直接寫入（同既有 promote endpoint），不經 saved POI store。

#### Scenario: 自訂 entry form 全填送出
- **WHEN** 使用者在「自訂」tab 填完 form 點完成
- **THEN** POST `/api/trips/:id/days/:num/entries`，body 含 form 欄位
- **AND** Success 後 modal 關閉 + DaySection refetch + 新 entry 出現在 timeline

#### Scenario: 自訂 form 缺 title
- **WHEN** 使用者沒填 title 點完成
- **THEN** 顯示 inline validation error「請輸入景點名稱」
- **AND** 不送 POST

### Requirement: Batch select footer + 完成 commit

Footer 永遠顯示，內容隨 selection 變動：
- 0 選：「還沒選任何景點」+ 完成 button disabled
- N 選：「已選 N 個 · 將加入 Day 03 · 7/31」+ 完成 button active

點完成後：
- 「搜尋」/「收藏」 tab 選的 POI list → 並行 N 個 POST `/api/trips/:id/days/:num/entries`
- 全部成功後 modal 關閉 + DaySection refetch + Toast 「已加入 N 個景點」
- 任一失敗 → 顯示 error toast + modal 不關，selection 保留

#### Scenario: 多選 3 個 POI 點完成
- **WHEN** 使用者多選 3 個搜尋結果 POI 點完成
- **THEN** 並行 POST 3 次 entries endpoint
- **AND** 全成功後 modal 關閉 + Toast 「已加入 3 個景點」

#### Scenario: 多選後切 day 重新看 footer
- **WHEN** 使用者已選 2 POI 後在 modal 內切 day
- **THEN** Footer 「將加入 Day X」 更新為新 day
- **AND** 完成時新 entries 都加到新 day

### Requirement: 拿掉 day-level 「+ 加景點」 inline trigger

舊 `InlineAddPoi` component 從 `DaySection.tsx` 移除。Trigger 改為 trip-level（`TripPage.tsx` TitleBar actions 增加「+ 加入景點」 chip 或 trip detail content top sticky chip）。

避免 user 在 day 切換時要重啟 inline UI 的麻煩，且符合 mockup section 14 的 trigger placement 規範。

#### Scenario: DaySection 不再有 inline add trigger
- **WHEN** 使用者展開任何 day section
- **THEN** Day section 末尾不再有「+ 加景點」 inline button
- **AND** 加景點 entry point 集中在 page-level
