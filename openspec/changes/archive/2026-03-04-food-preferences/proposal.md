## Why

目前四趟行程的餐廳推薦缺乏個人化：每人有不同的料理偏好（拉麵派 vs 燒肉派 vs 牛排派），但行程 JSON 沒有記錄偏好，`/render-trip` 也無法持久參考。Ray 行程因設計時已手動對齊「拉麵/燒肉/當地特色」所以符合度高，但 HuiYun、RayHus、Onion 三趟行程的餐廳分佈與使用者偏好嚴重不對齊。

## What Changes

- 行程 JSON `meta` 新增 `foodPreferences` 陣列（3 個字串，依優先排序）
- 更新 `validateTripData()` 認可新欄位（不做強制驗證，選填）
- 四趟行程 JSON 寫入各自的 `foodPreferences`：
  - Ray：`["拉麵", "燒肉", "當地特色"]`
  - HuiYun：`["拉麵", "燒肉", "當地特色"]`
  - RayHus：`["燒肉", "牛排/烤魚", "當地特色"]`
  - Onion：`["拉麵", "義大利麵", "特色小吃"]`
- 修正不符合偏好的餐廳 infoBox：確保每個 infoBox 的 3 家餐廳盡量依序對應 3 種偏好
  - HuiYun：拉麵覆蓋率從 1/8 提升
  - RayHus：燒肉/牛排覆蓋率從各 1 次提升
  - Onion：拉麵覆蓋率從 1/27 提升

## Capabilities

### New Capabilities
- `food-preferences-field`: 行程 JSON `meta.foodPreferences` 欄位定義與驗證規則

### Modified Capabilities
- `trip-enrich-rules`: R1 偏好來源從「運行時詢問」改為「讀取 JSON `meta.foodPreferences`」；R3 餐廳排序需對齊偏好順序

## Impact

- **JSON 結構**：`data/trips/*.json` 的 `meta` 區塊新增選填欄位
- **JS**：`app.js` 的 `validateTripData()` 需認可 `foodPreferences`（不阻擋缺少此欄位的舊行程）
- **資料**：四個行程 JSON 的餐廳 infoBox 需補齊/替換不符偏好的項目
- **checklist/backup/suggestions**：不受影響（偏好欄位在 meta，不影響日程結構）
- **/render-trip**：未來產生餐廳推薦時讀取 `foodPreferences` 欄位，不再需要額外詢問
