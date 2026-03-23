---
name: tp-edit
description: 接受自然語言描述，局部修改指定行程資料（D1 API）。適用於使用者要求修改現有行程中的景點、餐廳或活動時。
---

# tp-edit

接受自然語言描述，局部修改指定行程資料（D1 API）。

## 核心原則
- 不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 `ask_user`。
- 嚴格遵守 `references/trip-quality-rules.md` 中的品質規則。

## API 設定

- **Base URL**: `https://trip-planner-dby.pages.dev`
- **認證**: Service Token headers（寫入操作必填）
  - `CF-Access-Client-Id`: `e5902a9d6f5181b8f70e12f1c11ebca3.access`
  - `CF-Access-Client-Secret`: 從環境變數 `CF_ACCESS_CLIENT_SECRET` 取得

## 步驟

1. **讀取資料**：GET `/api/trips/{tripId}` + GET `/api/trips/{tripId}/days/{N}`
2. **局部修改**：依自然語言描述局部修改（只改涉及的部分）
3. **標記來源**：新增或替換的 POI 須標記 `source`：
   - 使用者明確指定名稱 → `"user"`
   - 使用者僅給模糊描述 → `"ai"`
4. **符合規範**：修改部分須符合 `references/trip-quality-rules.md`
5. **寫回 API**：依修改類型選擇對應端點：
   - 修改單一 entry：PATCH `/api/trips/{tripId}/entries/{eid}`
   - 覆寫整天：PUT `/api/trips/{tripId}/days/{N}`
   - 新增餐廳：POST `/api/trips/{tripId}/entries/{eid}/restaurants`
   - 修改/刪除餐廳：PATCH/DELETE `/api/trips/{tripId}/restaurants/{rid}`
   - 新增購物：POST `/api/trips/{tripId}/entries/{eid}/shopping`
   - 修改/刪除購物：PATCH/DELETE `/api/trips/{tripId}/shopping/{sid}`
   - 更新 doc：PUT `/api/trips/{tripId}/docs/{type}`
6. **連動更新**：若影響到 checklist、backup、suggestions，同步更新對應 doc
7. **品質檢查**：執行 `tp-check` 技能進行精簡模式驗證
8. **不自動 commit**：資料已直接寫入 D1 database，無需 git 操作

## 局部修改 vs 全面重整
本技能只處理描述涉及的修改範圍。如需全面重整，使用 `tp-rebuild`。

## 注意事項
- 所有資料讀寫均透過 API，不操作本地 MD 檔案
- 不執行 git commit / push，不執行 npm run build

## 參考資源
- 品質規則：`references/trip-quality-rules.md`
