---
name: tp-rebuild
description: 全面重整單一行程資料（D1 API），依品質規則逐項檢查並修正。適用於需要確保行程內容完全符合最新品質標準時。
---

# tp-rebuild

全面重整單一行程資料，依品質規則逐項檢查並透過 API 修正。

## 核心原則
- 不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 `ask_user`。
- 嚴格遵守 `references/trip-quality-rules.md` 中的品質規則。

## API 設定

- **Base URL**: `https://trip-planner-dby.pages.dev`
- **認證**: Service Token headers（寫入操作必填）
  - `CF-Access-Client-Id`: `e5902a9d6f5181b8f70e12f1c11ebca3.access`
  - `CF-Access-Client-Secret`: 從環境變數 `CF_ACCESS_CLIENT_SECRET` 取得

## 步驟
1. **讀取資料**：GET `/api/trips/{tripId}` + GET `/api/trips/{tripId}/days` + GET `/api/trips/{tripId}/days/{N}` 取得全部資料。
2. **Pre-check**：執行 `tp-check`（完整模式），顯示修正前的品質狀態。
3. **全面重整**：逐項檢查品質規則，修正不合格的資料。
   - 不改 timeline 順序、不新增/移除景點，只確保內容符合規則。
4. **寫回 API**：依修改類型選擇對應端點：
   - 修改單一 entry：PATCH `/api/trips/{tripId}/entries/{eid}`
   - 覆寫整天：PUT `/api/trips/{tripId}/days/{N}`
   - 修改餐廳：PATCH `/api/trips/{tripId}/restaurants/{rid}`
   - 修改購物：PATCH `/api/trips/{tripId}/shopping/{sid}`
   - 更新 doc：PUT `/api/trips/{tripId}/docs/{type}`
5. **Post-check**：執行 `tp-check`（完整模式），確認修正結果。
6. **不自動 commit**：資料已直接寫入 D1 database，無需 git 操作。

## 注意事項
- 所有資料讀寫均透過 API，不操作本地 MD 檔案
- 不執行 git commit / push，不執行 npm run build

## 參考資源
- 品質規則：`references/trip-quality-rules.md`
