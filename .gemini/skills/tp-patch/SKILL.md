---
name: tp-patch
description: 跨行程局部欄位更新工具（D1 API）。針對特定 target + field 批次掃描並搜尋補齊。適用於需要針對特定類別物件（如飯店、餐廳）更新特定欄位（如評分、位置）時。
---

# tp-patch

跨行程局部欄位更新工具（D1 API）。

## 指令格式
`/tp-patch --target <target> --field <field> [--trips <tripId,...>]`
- **target**: `hotel` | `restaurant` | `shop` | `event` | `gasStation`
- **field**: `googleRating` | `reservation` | `location` 等
- **trips**: 指定行程 ID（預設全部）

## API 設定

- **Base URL**: `https://trip-planner-dby.pages.dev`
- **認證**: Service Token headers（寫入操作必填）
  - `CF-Access-Client-Id`: `e5902a9d6f5181b8f70e12f1c11ebca3.access`
  - `CF-Access-Client-Secret`: 從環境變數 `CF_ACCESS_CLIENT_SECRET` 取得

## 步驟
1. **掃描**：
   - GET `/api/trips?all=1` 取得行程清單（若未指定 --trips）
   - GET `/api/trips/{tripId}/days/{N}` 讀取每天資料，定位目標物件，檢查欄位是否需更新
2. **搜尋**：參考 `references/search-strategies.md` 並行搜尋新值。
   - 依 R13 驗證 POI 存在性。
   - 搜不到則不繼續搜尋該物件的其他欄位。
3. **合併與驗證**：
   - 依物件類型選擇 API 寫回：
     - entry：PATCH `/api/trips/{tripId}/entries/{eid}`
     - 餐廳：PATCH `/api/trips/{tripId}/restaurants/{rid}`
     - 購物：PATCH `/api/trips/{tripId}/shopping/{sid}`
   - `tp-check`（精簡模式）驗證每個修改的行程
4. **不自動 commit**：資料已直接寫入 D1 database，無需 git 操作。

## 注意事項
- 所有資料讀寫均透過 API，不操作本地 MD 檔案
- 不執行 git commit / push，不執行 npm run build

## 參考資源
- 搜尋策略：`references/search-strategies.md`
- 品質規則：`references/trip-quality-rules.md`
