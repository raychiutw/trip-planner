## Context

行程主頁 `index.html` 目前透過 `createSkeleton()` 建立 6 個 info slot div（flights/checklist/backup/emergency/suggestions/driving），再由 `renderInfoSlot()` 渲染內容到 DOM。同時 Speed Dial → Bottom Sheet 也提供相同內容的存取。造成 DOM 重複渲染、頁面冗長。

現行資料流：
```
fetch JSON → renderInfoSlot(key, data) → 寫入 #xxx-slot DOM + 存入 TRIP[key]
                                          ↓
Speed Dial 按鈕 → openSpeedDialContent() → 讀取 TRIP[key] → 渲染到 Bottom Sheet
```

存在 bug：`renderInfoSlot()` 中 `TRIP[key] = data` 位於 `if (!el) return` 之後（app.js:894-896），移除 slot div 會導致 cache 寫入被跳過。

## Goals / Non-Goals

**Goals:**
- 主頁面只保留每日行程 + Footer，輔助內容統一由 Speed Dial → Bottom Sheet 存取
- 修正 cache 寫入 bug，確保移除 slot 後 Bottom Sheet 仍有資料
- Speed Dial 新增 driving 按鈕、suggestions 移到最上方
- 桌機手機體驗一致

**Non-Goals:**
- 不改 info-panel 右側欄（桌機版的倒數計時/統計/建議摘要卡片）
- 不改 CSS 動畫或 Bottom Sheet 樣式
- 不改 data/trips-md/ 或 JSON 結構
- 不改 Footer 渲染邏輯

## Decisions

### D1: fetch callback 改為 cache-only（取代 renderInfoSlot）

刪除 `renderInfoSlot()` 函式。fetch callback 改為直接寫 cache：

```js
// Before
.then(function(data) { renderInfoSlot(key, data); })

// After
.then(function(data) { TRIP[key] = data; })
```

這同時修正了 cache 寫入 bug（原本 `TRIP[key] = data` 在 `if (!el) return` 之後）。

`openSpeedDialContent()` 已經從 `TRIP[contentKey]` 讀取資料，不需修改。

### D2: tryRenderDrivingStats 改為 cache-only

```js
// Before: 計算後寫入 #driving-slot DOM
var el = document.getElementById('driving-slot');
if (!el) return;
el.innerHTML = ...;

// After: 計算後存入 TRIP.driving，供 Bottom Sheet 使用
var tripStats = calcTripDrivingStats(TRIP.days);
if (tripStats) {
    TRIP.driving = { title: '全旅程交通統計', content: tripStats };
}
```

### D3: DIAL_RENDERERS 新增 driving

```js
var DIAL_RENDERERS = {
    flights: renderFlights, checklist: renderChecklist,
    backup: renderBackup, emergency: renderEmergency,
    suggestions: renderSuggestions, driving: renderTripDrivingStats
};
```

`openSpeedDialContent()` 已有通用邏輯：`var fn = DIAL_RENDERERS[contentKey]`，新增 key 即可。

### D4: Speed Dial 按鈕排序

展開後由上到下（最上方 = 離 trigger 最遠 = HTML 最後一個）：

```
suggestions  ← 最上方（策略性、低頻）
flights
driving      ← 新增
checklist
backup
emergency    ← 最靠近 trigger（緊急、高頻）
```

HTML 中按鈕順序需對應（第一個最靠近 trigger）：
```html
<button data-content="emergency">...</button>
<button data-content="backup">...</button>
<button data-content="checklist">...</button>
<button data-content="driving">...</button>   <!-- 新增 -->
<button data-content="flights">...</button>
<button data-content="suggestions">...</button>
```

### D5: initNavTracking 移除 info section 依賴

`initNavTracking()` 使用 `var infoStart = document.getElementById('sec-flight')` 判斷使用者是否捲動到 info 區域。移除 info slots 後 `sec-flight` 不存在，`infoRect` 永遠是 `Infinity`，`inInfo` 永遠是 `false`。

可以直接刪除 `infoStart`、`infoRect`、`inInfo` 相關邏輯，簡化為只追蹤 day headers。

### D6: createSkeleton 精簡

移除 6 個 info slot div，只保留 footer-slot：

```js
function createSkeleton(dayIds) {
    var html = '';
    dayIds.forEach(function(id) { ... }); // day sections 不變
    html += '<div id="footer-slot"></div>';
    return html;
}
```

## Risks / Trade-offs

- **列印模式**：移除 info slots 後列印模式不會印出輔助內容 → 原本列印也不需要，影響可接受
- **renderSlotError 變成無效呼叫**：fetch 失敗時 `renderSlotError(key + '-slot', ...)` 找不到元素，會靜默失敗 → 移除這些 error slot 呼叫，改為 console.warn
- **driving icon**：需在 `icons.js` 確認有合適 icon 或使用現有 `directions_car` icon
