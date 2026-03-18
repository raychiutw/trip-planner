## Context

React 19 遷移完成後，與舊版 vanilla JS 存在四處行為差異。本次修改目標是還原功能對等，不引入新 UI 設計。

目前狀態：
- `Restaurant.tsx`：`reservation` 欄位以 `string` 型別直接渲染，但 D1 實際儲存 JSON 物件
- `InfoPanel.tsx`：渲染 8 張卡片（舊版只有 2 張）
- `SpeedDial.tsx`：按鈕順序與舊版不同
- `DrivingStats.tsx`：每段交通只有時間，無起點→終點名稱

## Goals / Non-Goals

**Goals:**
- 餐廳訂位資訊正確解析 JSON 並依 method 渲染
- 桌面 InfoPanel 與舊版一致（Countdown + TripStatsCard）
- SpeedDial 按鈕順序與舊版一致
- 交通統計每段顯示「起點 → 終點」路段名稱

**Non-Goals:**
- 不改 DB schema
- 不改 API 端點
- 不重新設計 InfoPanel 桌面版 layout
- 不修改 CSS（純邏輯層修改）

## Decisions

### D1：Reservation JSON 解析策略

**選擇**：在 `Restaurant.tsx` 渲染層解析，不加入 `JSON_FIELDS`

**理由**：
- `reservation` 欄位可能同時存在舊格式（純字串）和新格式（JSON 物件），需要 graceful fallback
- 加入 `JSON_FIELDS` 會影響所有使用 `mapRow` 的地方，blast radius 過大
- 在元件層解析可以根據 `method` 精確控制渲染

**Reservation JSON 三種模式**：
```
method=website → 🔗 連結到 url（文字：「建議訂位」）
method=phone   → 📞 顯示電話號碼（可撥打 tel: 連結）
available=no   → 不顯示訂位區塊
fallback       → 當作純字串渲染（向後相容舊資料）
```

### D2：InfoPanel 精簡方式

**選擇**：`InfoPanel.tsx` 移除 props 和渲染，`TripPage.tsx` 不再傳入 doc 資料

**理由**：InfoPanel 是獨立元件，移除 props 就能切斷資料流，不需要改 useTrip 或 docs fetching（其他地方仍需 docs）

### D3：交通路段名稱推導

**選擇**：在 `calcDrivingStats()` 中從 `entries[i].title` → `entries[i+1].title` 推導

**理由**：
- travel 物件只有 `{ type, desc, min }`，沒有地名
- entry 的 title 就是景點名稱，前後 entry 的 title 自然形成路段
- 不需改 DB 或 API

**Segment 型別擴充**：
```ts
interface Segment {
  text: string;
  minutes: number;
  from?: string;  // 新增
  to?: string;    // 新增
}
```

## Risks / Trade-offs

- [Reservation 舊資料] → 用 `typeof` 檢查：若是 string 維持原有渲染，若是 object 才解析 JSON
- [InfoPanel 功能退化] → 桌面使用者失去 sidebar 快速存取 docs 的能力，但這是還原舊版行為
- [最後一個 entry 無 to] → 最後一段交通的 `to` 為 undefined，渲染時只顯示 from 即可
