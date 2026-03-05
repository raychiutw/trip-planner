## Context

四項命名問題需同步修正：`transit`→`travel`、`ev`→`entry`、`desc`→`description`、`subs` 移除。所有行程 JSON、JS 渲染、CSS、測試、規則文件皆受影響。

## Goals / Non-Goals

**Goals:**
- 一次性清理所有命名不一致
- 所有測試通過、視覺無回歸
- `subs` 中的停車場資料無損遷移至 `hotel.infoBoxes`

**Non-Goals:**
- 不改 `TRANSPORT_TYPES` 常數名稱（命名正確）
- 不改 `data/backup/*.json`、`openspec/changes/archive/`
- 不改 CSS `transition` 屬性（與 `transit` 無關）
- 不加向後相容 fallback

## Decisions

### D1: `transit` → `travel`
最簡潔、語意精確。不與 public transit 或 CSS transition 混淆。

### D2: `ev` → `entry`
與品質規則文件用語一致（"timeline entry"）。只改 app.js 中的迴圈變數，不影響 JSON。

### D3: `desc` → `description`
統一為全名。timeline event 已用 `description`，餐廳的 `desc` 改為一致。

### D4: `subs` → 移除，遷移至 `hotel.infoBoxes`
現存 `subs` 全部為 `type: "parking"` 的停車場資料。結構已經與 `infoBoxes[type=parking]` 相容（含 title、price、note、location），直接搬入 `hotel.infoBoxes` 陣列。Ray（4 筆）和 HuiYun（6 筆）需遷移。app.js 中 `hotel.subs` 渲染邏輯移除。

### D5: 替換策略
- JSON 欄位：Node.js 腳本批次替換
- JS/CSS：手動 Edit 精確替換
- 測試：手動替換，確認上下文

## Risks / Trade-offs

- **風險：subs 遷移遺漏** → 緩解：遷移後 grep 確認無殘留 `"subs"`
- **風險：desc 替換誤傷** → 緩解：只替換 `"desc":` 不替換 `description`
- **風險：ev 替換範圍過大** → 緩解：只改 app.js 中作為 timeline entry 的 `ev`，不改 `toggleEv` 中的 DOM element `ev`（那個改為 `el` 或保留，因為其作用域獨立）
