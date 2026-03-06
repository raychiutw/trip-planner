## Why

目前行程 JSON 中的 POI（餐廳、景點、飯店、購物點、加油站）無法區分是使用者明確指定還是 AI 自動產生。R13 POI 真實性驗證對所有 POI 一視同仁（皆為 warning），但實際上：
- 使用者指定的 POI 驗證失敗應為 warning（尊重使用者意願，提醒即可）
- AI 產生的 POI 驗證失敗應為 fail（AI 不該產出不存在的地點）

需要在 JSON 層級追蹤 POI 來源，讓 tp-check 能依來源套用不同驗證等級。

## What Changes

- 每個 POI 物件新增 `"source": "user" | "ai"` 欄位
- tp-create：所有產出的 POI 標記 `source: "ai"`
- tp-edit / tp-issue：使用者明確指定名稱的 POI 標記 `source: "user"`，模糊描述（如「加個午餐」）由 AI 選擇的 POI 標記 `source: "ai"`
- tp-check R13：依 source 區分驗證等級（user → warning，ai → fail）
- 現有行程資料遷移：所有既有 POI 預設標記為 `"ai"`（因皆由 tp-create 產生）

## Capabilities

### New Capabilities
- `poi-source-field`: POI 來源欄位定義、各 skill 的標記邏輯、資料遷移策略

### Modified Capabilities
- `trip-quality-rules-source`: R13 驗證邏輯依 source 欄位區分 warning/fail 等級

## Impact

- **JSON 結構**：所有 POI 物件（restaurant、timeline event、hotel、shop、gasStation）新增 source 欄位
- **Skill 檔案**：tp-create.md、tp-edit.md、tp-issue.md、tp-patch.md、tp-check.md
- **品質規則**：trip-quality-rules.md（R13 規則更新）
- **範本**：data/examples/template.json
- **測試**：tests/json/quality.test.js（R13 測試更新）
- **行程資料**：data/trips/*.json（全部 7 個行程需遷移）
- checklist/backup/suggestions 不受影響（source 欄位不涉及這些結構）
