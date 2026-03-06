## Why

目前行程資料的維護面臨兩個痛點：

1. **缺乏跨行程局部更新工具**：現有 `tp-rebuild` / `tp-rebuild-all` 會掃描全部 R1-R12 規則，只為更新某個欄位（如 hotel googleRating）就得跑全面重整，太重且有不必要的改動風險。`tp-edit` 只能改單一行程，無法批次操作。
2. **搜尋策略散落各處**：`tp-create`、`tp-rebuild` 各自在 prompt 裡描述怎麼搜 blogUrl、googleRating，知識重複且不一致，新增搜尋策略（如 reservation）時要改多處。
3. **tp-create 骨架欄位遺漏**：Phase 1 生成骨架時，缺乏明確的 Event Type Schema 定義各類型 event 的必填欄位，導致 AI 生成大量 JSON 時容易漏掉 blogUrl、googleRating、locations 等欄位，需事後手動修補。

同時有兩個功能需求觸發此次變更：
- **Hotel googleRating**：飯店名稱後需顯示 Google 評分（目前只有餐廳/商店/景點有），品質規則 R12 需擴充至 hotel
- **餐廳 reservation 結構化**：目前 reservation 是自由格式字串（「建議預約」「不需訂位」等），需改為結構化物件，包含可否預約、預約方式（網站/電話）、是否建議預約

## What Changes

### 新增 tp-patch skill
- 新增 `.claude/commands/tp-patch.md`
- 結構化指令：`/tp-patch --target <hotel|restaurant|shop|event> --field <fieldName> [--trips <slug,...>]`
- 掃描所有（或指定）行程，列出需更新的項目
- 並行 Agent 搜尋 + 回傳 patch，主流程合併寫回
- 只改目標欄位，其他完全不動

### 新增 search-strategies.md 共用搜尋策略 + Event Type Schema
- 新增 `.claude/commands/search-strategies.md`
- **Part 1 — Event Type Schema**：定義景點/交通/餐廳/航班 event、hotel、shop 的必填欄位清單，tp-create Phase 1 骨架生成時參照，Phase 1 結尾自動掃描補漏
- **Part 2 — Search Strategies**：定義各欄位（googleRating、blogUrl、reservation、location）的搜尋方式、關鍵字模板、驗證規則
- `tp-create`、`tp-rebuild`、`tp-patch` 統一引用

### Hotel googleRating 渲染 + strict
- `renderHotel()` 加入 `★ N.N` 顯示（與餐廳/商店一致）
- R12 品質規則擴充：hotel 必須有 googleRating（1.0-5.0）
- 所有行程 JSON 的 hotel 補上 googleRating（用 tp-patch 回填）

### 餐廳 reservation 結構化 **BREAKING**
- `reservation` 從 string 改為 object：`{ available, method, url, phone, recommended }`
- `reservationUrl` 欄位移除，併入 `reservation.url`
- `renderRestaurant()` 改讀新結構
- R3 品質規則加入 reservation 結構 strict 檢查
- 所有行程 JSON 的 restaurant reservation 重新搜尋填入（用 tp-patch 回填）

## Capabilities

### New Capabilities
- `tp-patch-skill`: tp-patch 指令定義——結構化參數、掃描邏輯、Agent 並行策略、合併流程
- `search-strategies`: 共用搜尋策略定義——各欄位的搜尋方式、關鍵字模板、驗證規則、適用 target

### Modified Capabilities
- `google-rating`: R12 擴充至 hotel，renderHotel 加入評分渲染
- `trip-quality-rules-source`: R3 加入 reservation 結構化 strict 檢查

## Impact

### 影響檔案

| 類型 | 檔案 | 改動 |
|------|------|------|
| JS | `js/app.js` | `renderHotel()` 加 googleRating、`renderRestaurant()` 改讀 reservation 物件 |
| 測試 | `tests/unit/render.test.js` | 新增 hotel rating 測試、更新 restaurant reservation 測試 |
| 測試 | `tests/json/quality.test.js` | R12 加 hotel 檢查、R3 加 reservation 結構檢查 |
| 測試 | `tests/json/schema.test.js` | reservation 型別從 string 改 object |
| Skill | `.claude/commands/tp-patch.md` | 新增 |
| Skill | `.claude/commands/search-strategies.md` | 新增 |
| Skill | `.claude/commands/trip-quality-rules.md` | R3、R12 更新 |
| 範本 | `data/examples/template.json` | hotel 加 googleRating、restaurant reservation 改結構 |
| 資料 | `data/trips/*.json`（全部） | hotel 加 googleRating、restaurant reservation 改結構 |

### 連動影響
- checklist / backup / suggestions：不受影響（hotel googleRating 和 reservation 不在這些區塊中）
- `reservationUrl` 欄位移除後，`escUrl` 白名單 URL_FIELDS 需同步移除 `reservationUrl`，改為驗證 `reservation.url`
