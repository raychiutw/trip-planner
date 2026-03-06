## ADDED Requirements

### Requirement: localStorage prefix 縮短為 tp-

`shared.js` 的 `LS_PREFIX` SHALL 為 `tp-`。所有 localStorage key SHALL 使用 `tp-` prefix（`tp-trip-pref`、`tp-color-mode`、`tp-dark`、`tp-sidebar-collapsed`）。

#### Scenario: 新安裝使用者
- **WHEN** 使用者首次訪問網站，localStorage 無任何 key
- **THEN** 寫入的 key SHALL 使用 `tp-` prefix

#### Scenario: 讀取 key
- **WHEN** 程式碼呼叫 `lsGet('trip-pref')`
- **THEN** SHALL 讀取 `tp-trip-pref` key

### Requirement: 舊 prefix 自動遷移

系統 SHALL 在頁面載入時自動偵測舊 prefix key 並遷移至新 prefix。遷移完成後 SHALL 刪除舊 key。

#### Scenario: trip-planner-* 遷移至 tp-*
- **WHEN** localStorage 存在 `trip-planner-trip-pref` 但不存在 `tp-trip-pref`
- **THEN** SHALL 將值複製到 `tp-trip-pref` 並刪除 `trip-planner-trip-pref`

#### Scenario: 無 prefix 舊 key 遷移
- **WHEN** localStorage 存在無 prefix 的 `tripFile` 或 `tripPref` 或 `dark`
- **THEN** SHALL 將值遷移至對應的 `tp-*` key 並刪除舊 key

#### Scenario: 新 key 已存在時不覆蓋
- **WHEN** `tp-trip-pref` 已有值，且 `trip-planner-trip-pref` 也存在
- **THEN** SHALL 保留 `tp-trip-pref` 的值，僅刪除 `trip-planner-trip-pref`

#### Scenario: 遷移在所有頁面生效
- **WHEN** 使用者首次開啟 setting.html 或 edit.html（而非 index.html）
- **THEN** 遷移邏輯 SHALL 同樣執行（因為邏輯在 shared.js 中）

### Requirement: 行程載入失敗顯示訊息與設定頁連結

當 `loadTrip` fetch 失敗時，系統 SHALL 清除 `trip-pref`、在 `#tripContent` 顯示錯誤訊息與前往設定頁的連結按鈕。

#### Scenario: fetch 404
- **WHEN** `loadTrip` fetch 回傳 404（行程 JSON 不存在）
- **THEN** SHALL 清除 localStorage 的 `trip-pref` key
- **AND** SHALL 在 `#tripContent` 渲染訊息「行程不存在」與一個連結到 `setting.html` 的按鈕「前往選擇行程」

#### Scenario: fetch 網路錯誤
- **WHEN** `loadTrip` fetch 因網路問題失敗
- **THEN** SHALL 執行相同的錯誤處理（清除 trip-pref、顯示訊息與連結）

#### Scenario: 重新進入網站
- **WHEN** 使用者在載入失敗後重新整理頁面
- **THEN** 因 trip-pref 已被清除，SHALL 顯示「請選擇行程」訊息（非重複嘗試載入失敗的行程）

### Requirement: 移除預設行程 fallback

系統 SHALL 不再在無 trip-pref 時自動載入預設行程。`DEFAULT_SLUG` 常數 SHALL 被移除。

#### Scenario: 無 URL 參數且無 localStorage
- **WHEN** URL 無 `?trip=` 參數且 localStorage 無 `trip-pref`
- **THEN** SHALL 在 `#tripContent` 顯示「請選擇行程」訊息與設定頁連結按鈕，不自動載入任何行程

#### Scenario: URL 有 trip 參數
- **WHEN** URL 有 `?trip=okinawa-trip-2026-Ray`
- **THEN** SHALL 正常載入該行程（此行為不變）
