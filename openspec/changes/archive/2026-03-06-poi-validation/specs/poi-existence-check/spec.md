## ADDED Requirements

### Requirement: R13 POI 真實性驗證

所有 POI（餐廳、景點、飯店、商店）在搜尋階段 SHALL 先驗證存在性，再進行欄位填充。

#### Scenario: AI 產生的 POI 搜不到
- **WHEN** tp-create Phase 2 或 tp-patch agent 搜尋 AI 生成的 POI
- **AND** Google Maps 或搜尋引擎找不到該 POI
- **THEN** SHALL 替換為同類型、同區域的真實店家
- **AND** 替換後的店家 SHALL 通過存在性驗證

#### Scenario: AI 產生的 POI 營業時間不符
- **WHEN** tp-create Phase 2 驗證 AI 生成的餐廳
- **AND** 餐廳營業時間與用餐時段不符（開始營業 > event 時間 + 1hr）
- **THEN** SHALL 替換為同類型、營業時間符合的真實店家

#### Scenario: 使用者提供的 POI 搜不到
- **WHEN** tp-issue 或 tp-edit 處理使用者指定的 POI
- **AND** Google Maps 或搜尋引擎找不到該 POI
- **THEN** SHALL 保留原資料
- **AND** SHALL 在 console 輸出 warning
- **AND** SHALL 在行程 JSON 的 `suggestions.content.cards` 加入 high priority 建議卡

#### Scenario: 使用者提供的 POI 營業時間不符
- **WHEN** tp-issue 或 tp-edit 處理使用者指定的餐廳
- **AND** 營業時間與用餐時段不符
- **THEN** SHALL 保留原資料
- **AND** SHALL 在 `suggestions.content.cards` 加入 high priority 建議卡

#### Scenario: tp-check R13 離線檢查
- **WHEN** tp-check 執行 R13 檢查
- **THEN** SHALL 列出所有缺少 googleRating 的非豁免 POI 為 warning
- **AND** warning 不阻擋 tp-check 通過（非 fail）

### Requirement: search-strategies 存在性前置驗證

#### Scenario: 搜尋流程前置步驟
- **WHEN** agent 依 search-strategies.md 開始搜尋某 POI 的欄位
- **THEN** SHALL 先搜尋「{名稱} Google Maps」或「{名稱} {地區}」確認 POI 存在
- **IF** POI 不存在
- **THEN** SHALL 回報「POI 不存在」，不繼續搜尋該 POI 的其他欄位
