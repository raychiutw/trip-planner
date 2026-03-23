---
name: tp-create
description: 從零透過 D1 API 建立符合品質規則的完整行程。適用於使用者要求建立新行程或根據目的地產生旅遊計畫時。
---

# tp-create

從零透過 D1 API 建立符合品質規則的完整行程。

## 核心原則
- 不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 `ask_user`（料理偏好除外）。
- 嚴格遵守 `references/trip-quality-rules.md` 中的品質規則。

## API 設定

- **Base URL**: `https://trip-planner-dby.pages.dev`
- **認證**: Service Token headers（寫入操作必填）
  - `CF-Access-Client-Id`: `e5902a9d6f5181b8f70e12f1c11ebca3.access`
  - `CF-Access-Client-Secret`: 從環境變數 `CF_ACCESS_CLIENT_SECRET` 取得

## 步驟

### Phase 1：產生骨架
1. **詢問料理偏好**：詢問使用者料理偏好（最多 3 類，依優先排序），寫入 `meta.foodPreferences`。
2. **判斷國家**：依目的地自動判斷 `meta.countries`（ISO 3166-1 alpha-2）。
3. **讀取規範**：讀取 `references/trip-quality-rules.md`。
4. **建立 meta**：POST `/api/trips` 建立行程（含 id、name、title、startDate、endDate、countries、transportMode、foodPreferences）
5. **建立每天資料**：PUT `/api/trips/{tripId}/days/{N}` 依序建立每天完整內容：
   - 所有 POI 標記 `"source": "ai"`，`note: ""`，有 `location.googleQuery`
   - `googleRating` Phase 1 省略，Phase 2 補充
   - Hotel 含 `checkout` 欄位
6. **建立 docs**：PUT `/api/trips/{tripId}/docs/{type}` 建立 flights/checklist/backup/suggestions/emergency

### Phase 2：充填資訊
7. **補充評分**：針對每一天，使用 `web_fetch` 或 `google_web_search` 查詢地點評分，透過 PATCH `/api/trips/{tripId}/entries/{eid}` 補充 `googleRating`。
8. **避免 null**：確保不引入 `null` 值（找不到則省略欄位）。

### Phase 3：驗證
9. **品質檢查**：執行 `tp-check` 技能進行完整模式驗證。
10. **不自動 commit**：資料已直接寫入 D1 database，無需 git 操作。

## tripId 命名規則
`{destination}-trip-{year}-{owner}`，例如：`okinawa-trip-2026-Ray`

## 注意事項
- 所有資料均透過 API 建立，不建立本地 MD 檔案
- 不執行 git commit / push，不執行 npm run build

## 參考資源
- 品質規則：`references/trip-quality-rules.md`
- 搜尋策略：`references/search-strategies.md`
