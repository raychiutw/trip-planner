## Context

行程 JSON 的 `meta` 區塊目前只有 `name`/`title`/`description`/`ogDescription`/`themeColor`，沒有記錄使用者的料理偏好。現有 `trip-enrich-rules` R1 定義了「執行時詢問偏好」的流程，但偏好沒有持久化——每次 `/render-trip` 都要重新問。

分析四趟行程的餐廳 category 分佈後發現：Ray 符合度高（每組都是拉麵/燒肉/local），但 HuiYun 的拉麵只出現 1/8 次、RayHus 的燒肉和牛排各只出現 1 次、Onion 的拉麵只出現 1/27 次。

## Goals / Non-Goals

**Goals:**
- 在 `meta` 新增 `foodPreferences` 選填欄位，持久記錄每趟行程的料理偏好
- 修正 HuiYun、RayHus、Onion 三趟行程的餐廳推薦，使其對齊偏好
- 更新 `/render-trip` 的 R1 規則：偏好來源改為讀取 JSON，已有就不問

**Non-Goals:**
- 不在 UI 上顯示或編輯 foodPreferences（未來可做但不在此次範圍）
- 不強制每個 infoBox 都必須完美匹配三種偏好（有些地區/餐次確實找不到特定料理類型）
- 不改動 Ray 行程的餐廳（已經高度符合）

## Decisions

### D1：`foodPreferences` 欄位位置與格式

**選擇**：放在 `meta.foodPreferences`，型別為 `string[]`，最多 3 個元素

```json
"meta": {
  "name": "...",
  "foodPreferences": ["拉麵", "燒肉", "當地特色"]
}
```

**替代方案**：
- 放在 `footer` → 不合適，footer 是顯示用
- 放在頂層 `preferences` 物件 → 過度設計，目前只有食物偏好

**理由**：`meta` 是行程的元資料區塊，食物偏好屬於行程特性描述，放這裡最自然。

### D2：偏好對齊策略

**選擇**：「盡力對齊」而非「嚴格對齊」

每個餐廳 infoBox 的 3 家餐廳，第 1 家 category 盡量對應偏好 1、第 2 家對應偏好 2、第 3 家對應偏好 3。但如果某地區真的找不到特定料理類型（例如離島沒有拉麵店），允許以「當地特色」替代。

**理由**：嚴格要求會導致推薦不合理的遠距餐廳，違反「行程當時地點附近」原則。

### D3：Ray 行程不動

**選擇**：Ray 行程只加 `foodPreferences` 欄位，不修改餐廳

**理由**：Ray 行程的餐廳分佈已完美對齊偏好，無需調整。

### D4：修改範圍限制

**選擇**：只改 `data/trips/*.json`，不改 JS/CSS/HTML

**理由**：
- `foodPreferences` 是選填欄位，`validateTripData()` 不需要額外驗證邏輯（JSON schema test 已涵蓋）
- `/render-trip` 的行為改變在 spec 層面記錄即可，實際是 AI skill 的行為調整，不是程式碼變更
- 避免觸動 JS 導致測試風險

## Risks / Trade-offs

- **[category 名稱不統一]** → 偏好寫「拉麵」但 category 可能是「豚骨拉麵」「日式拉麵」「味噌拉麵」等。此次修正時統一用偏好名稱作為 category（如「拉麵」），具體拉麵種類在 name/desc 中描述。
- **[找不到偏好料理的地區]** → Onion 行程在土城樹林找不到義大利麵或拉麵店。此時 category 改為最接近的替代（如日式料理），並在 desc 中說明。
- **[過多替換可能破壞已驗證的資料]** → 只替換 category 不對齊的項目，保留 name/desc/location 等已驗證欄位。
