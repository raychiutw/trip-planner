## Context

行程 JSON 中的 POI（餐廳、景點、飯店、商店）有兩種來源：使用者透過 tp-issue/tp-edit 指定，或 tp-create Phase 2 由 AI 自動生成。AI 生成的 POI 可能是幻覺（分店不存在、已歇業）。目前沒有規則能攔截這類問題，搜不到的 POI 一律保留並標記 `available: "unknown"`，但 unknown 應保留給「確認存在但查不到預約資訊」的情境。

## Goals / Non-Goals

**Goals:**
- 定義 R13 POI 真實性驗證規則
- 依來源區分處理方式（使用者提供 vs AI 產生）
- 更新搜尋策略，加入存在性前置驗證

**Non-Goals:**
- 不建立自動化 POI 存在性測試（需搜尋引擎，非靜態測試可做）
- 不改變 JSON 結構
- 不修改渲染邏輯

## Decisions

### D1: POI 存在性驗證時機

驗證在 **搜尋階段**（tp-create Phase 2、tp-patch agent、tp-rebuild agent）執行，不在靜態測試中執行。

**Why**: POI 存在性需要搜尋引擎查詢，無法用 JSON 結構檢查判定。靜態測試（quality.test.js）只能檢查結構正確性。

### D2: 來源區分策略 — 行為而非標記

不在 JSON 中標記 POI 來源，而是由各 skill 的行為決定處理方式：
- tp-create/tp-rebuild（AI 生成）：搜不到 → 替換
- tp-issue/tp-edit（使用者指定）：搜不到 → warning + suggestion

**Why**: 避免在 JSON 加入 meta 欄位增加結構複雜度。來源資訊只在生成/修改當下有意義。

### D3: tp-check R13 行為 — 離線標記

tp-check 無法做即時搜尋驗證，但可檢查「POI 缺少 googleRating」作為間接指標（搜不到的 POI 通常也搜不到 rating）。搜不到 rating 的 POI 列為 R13 warning（非 fail）。

**Why**: tp-check 定位是快速靜態檢查，不應該依賴網路搜尋。間接指標雖不完美，但可在不聯網的情況下標記疑似問題。

### D4: suggestion 高優先卡格式

使用者提供的 POI 驗證失敗時，加入 suggestion 卡：
```json
{
  "title": "⚠️ 餐廳可能不存在",
  "description": "「姜虎東白丁 南浦店」在 Google Maps 搜尋不到，建議確認或替換",
  "priority": "high"
}
```

**Why**: 複用既有 suggestions 結構，使用者可在網頁上看到。high priority 確保排在最前面。

## Risks / Trade-offs

- **[誤判風險] 小店搜不到 ≠ 不存在** → Mitigation: 使用者提供的 POI 只做 warning 不刪除
- **[搜尋成本] 每個 POI 都需驗證存在性** → Mitigation: 驗證融入既有搜尋流程（搜 googleRating 時順便確認），不增加額外搜尋步驟
- **[間接指標不準確] 缺 googleRating ≠ 不存在** → Mitigation: R13 在 tp-check 中為 warning 層級，不阻擋通過
