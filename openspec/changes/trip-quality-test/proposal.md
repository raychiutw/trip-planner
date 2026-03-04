## Why

全面審計後發現多項資料品質問題（R5 飯店缺 blogUrl、R7 飯店缺 hotel.infoBoxes shopping），但現有 `quality.test.js` 缺乏對應的自動化測試，無法在 CI 階段攔截這類回歸。此外，R3 餐廳數量規則需調整：行程使用者已提供的餐廳資料應優先保留，最多 3 家即可（不強制補到 3 家），且類型順序應對齊 `meta.foodPreferences`。

## What Changes

- **新增 quality.test.js 測試項目**：
  - R5：非「家」飯店必須有 `blogUrl`（字串或 null，但欄位須存在）
  - R7：非「家」飯店必須有 `hotel.infoBoxes` 含 `type=shopping`（至少 3 家 shops）
  - R1/R3：餐廳 `category` 順序應對齊 `meta.foodPreferences`
- **R3 餐廳數量規則變更**：
  - 現行規則：「補到 3 家」→ 新規則：「以使用者提供的為優先，最多 3 家」
  - 現有測試 `>= 3` → 改為 `>= 1 && <= 3`
- **R3 spec 更新**：反映「使用者提供優先，最多三家」的新語義

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `trip-enrich-rules`：R3 餐廳數量從「補到 3 家」改為「使用者提供優先，最多 3 家」

## Impact

- 檔案影響：`tests/json/quality.test.js`（新增測試 + 修改 R3 數量檢查）
- Spec 影響：`openspec/specs/trip-enrich-rules/spec.md`（R3 scenario 更新）
- 無 JSON 結構變更、無 JS/CSS/HTML 變更
