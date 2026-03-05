## Context

行程 JSON 有 4 種 location 容器，結構幾乎相同但存在不一致：
- timeline event：`locations[]`（陣列，可多個）
- restaurant：`location`（單一物件）
- shop：`location`（單一物件，填寫率極低）
- gasStation：`station.location`（多包一層 wrapper）

所有位置最終都經過同一個 `renderMapLinks(loc, inline)` 函數渲染。

本次變更統一 location 型別定義、扁平化 gasStation、開放 `label` 給所有容器，並新增 R11 品質規則驗證 location 完整性。

## Goals / Non-Goals

**Goals:**
- 定義 `MapLocation` 統一型別，所有 location 容器共用
- gasStation infoBox 扁平化（移除 `station` wrapper）
- `label` 欄位開放所有容器使用
- 新增 R11 品質規則：所有景點/餐廳/加油站必須有 location
- 更新 schema.test.js 和 quality.test.js

**Non-Goals:**
- 不導入 lat/lng 座標（留給後續 Phase 2）
- 不導入 mapcode-js 自動計算（留給後續 Phase 3）
- 不填補現有缺失的 location 資料（R11 規則先以 warn 模式運行，不阻擋 CI）
- 不修改 `renderMapLinks` 函數（已天然支援統一型別）

## Decisions

### D1: MapLocation 統一型別定義

```typescript
interface MapLocation {
  name: string;           // 地點名稱（顯示 + fallback 查詢用）
  googleQuery: string;    // Google Maps URL
  appleQuery: string;     // Apple Maps URL
  mapcode?: string;       // 日本車機導航碼（optional）
  label?: string;         // 多地點時的分類標籤（optional）
}
```

**為何不改欄位名稱（如 googleQuery → googleUrl）**：現有 160+ timeline location + 70+ restaurant location 都用 `googleQuery`/`appleQuery`，改名的遷移成本太高且無實質收益。未來 Phase 2 導入 lat/lng 後這些欄位會被淘汰，不值得現在重命名。

### D2: gasStation 扁平化方式

**Before:**
```json
{
  "type": "gasStation",
  "title": "還車前加油",
  "station": {
    "name": "ENEOS...",
    "address": "...",
    "hours": "...",
    "service": "...",
    "phone": "...",
    "location": { ... }
  }
}
```

**After:**
```json
{
  "type": "gasStation",
  "title": "還車前加油",
  "name": "ENEOS...",
  "address": "...",
  "hours": "...",
  "service": "...",
  "phone": "...",
  "location": { ... }
}
```

**影響範圍**：
- `app.js` 第 164-180 行：`box.station` → 直接讀 `box.*`（約 15 行修改）
- 2 個行程 JSON：`okinawa-trip-2026-Ray.json`、`okinawa-trip-2026-HuiYun.json`
- `schema.test.js`：gasStation 驗證從 `box.station.name` → `box.name`
- `quality.test.js`：R10 檢查不受影響（只看 `box.type === 'gasStation'`）

**替代方案**：保留 `station` wrapper 但加上 backward-compat shim。不選此方案因為只有 2 個行程有 gasStation，一次改完更乾淨。

### D3: label 欄位開放策略

`label` 目前只在 timeline `locations[]` 出現（多地點事件），開放給 restaurant/shop/gasStation 使用。

**使用場景**：shopping infoBox 裡有兩家不同位置的超市，需標註「本店」「分店」。

**不影響現有渲染**：`renderMapLinks` 不讀 `label`，label 由上層（如 `renderNavLinks`）處理。restaurant/shop 的 render 函數目前不顯示 label，未來需要時再加。

### D4: R11 規則分級

R11 拆為兩級驗證：

| 級別 | 檢查對象 | 模式 | 原因 |
|------|----------|------|------|
| Schema | location 物件結構正確性 | fail | 有 location 就必須格式正確 |
| Quality | 景點/餐廳/加油站是否有 location | warn | 現有資料填寫率不足，先不阻擋 CI |

Quality warn 模式使用 `console.warn`（與 R1/R3 category 對齊一致），待資料補齊後可升級為 strict `expect`。

**哪些容器必填（Quality R11）**：
- timeline event locations：所有事件 SHALL 有 `locations[]`
- restaurant location：所有餐廳 SHALL 有 `location`
- gasStation location：所有加油站 SHALL 有 `location`
- shop location：warn only（現有填寫率太低，暫不強制）

## Risks / Trade-offs

**[gasStation 扁平化是 breaking change]** → 範圍限定（2 個 JSON + 1 個 render function），一次性改完。無外部 API 依賴。

**[R11 warn 模式不夠嚴格]** → 故意為之。現有 5 個行程中 shop location 填寫率僅 11%（15/136），強制會導致大量測試失敗。先用 warn 讓 `/tp-rebuild` 逐步補齊。

**[label 開放但無 render]** → restaurant/shop 的 render 函數不會顯示 label。這是可接受的：先開放資料結構，render 需要時再加。schema 驗證會確保 label 為字串。
