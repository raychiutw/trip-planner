## Why

tp-create Phase 2 自動產生的餐廳/景點/飯店可能是 AI 幻覺（分店不存在、已歇業、名稱錯誤），目前沒有品質規則能攔截這類問題。reservation 結構化後，agent 搜不到 POI 時一律設 `available: "unknown"`，但實際上應區分「搜到店但沒預約資訊」和「連店都搜不到」。此外，營業時間不符合用餐時段的問題也需要依來源（使用者提供 vs AI 產生）做不同處理。

## What Changes

- 新增 **R13 POI 真實性驗證**品質規則：所有 POI（餐廳、景點、飯店、商店）須可在 Google Maps 或搜尋引擎找到
- **依來源區分處理方式**：
  - **使用者提供**的 POI（透過 tp-issue/tp-edit 指定）：搜不到或營業時間不符 → warning + 加入 `suggestions` 高優先建議卡，保留原資料
  - **AI 自動產生**的 POI（tp-create Phase 2 生成）：搜不到 → 直接替換為真實店家；營業時間不符 → 直接替換為時段合適的店
- 更新 **search-strategies.md**：搜尋流程加入「先驗證 POI 存在性」前置步驟
- 更新 **tp-create**：Phase 2 agent 搜尋時須驗證生成的 POI 是否真實存在
- 更新 **tp-check**：R13 檢查輸出搜不到的 POI 列表

## Capabilities

### New Capabilities
- `poi-existence-check`: POI 真實性驗證規則（R13），定義驗證流程、來源區分、處理方式

### Modified Capabilities
- `trip-quality-rules-source`: 新增 R13 規則定義
- `tp-create-skill`: Phase 2 agent 須驗證 POI 存在性，搜不到時替換
- `search-strategies`: 搜尋流程加入 POI 存在性前置驗證

## Impact

- **品質規則**：`.claude/commands/trip-quality-rules.md` 新增 R13
- **品質測試**：`tests/json/quality.test.js` 新增 R13 測試（但 POI 存在性為搜尋層驗證，非靜態 JSON 測試，可能只做結構檢查）
- **搜尋策略**：`.claude/commands/search-strategies.md` 更新搜尋流程
- **tp-create**：`.claude/commands/tp-create.md` Phase 2 加入驗證步驟
- **tp-check**：`.claude/commands/tp-check.md` 加入 R13 檢查邏輯
- **行程 JSON**：無結構變更，但 `suggestions` 可能因驗證結果新增高優先建議卡
