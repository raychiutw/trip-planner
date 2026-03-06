## Context

行程頁（index.html）目前為垂直長頁面，所有天數 section 依序排列。導航依賴左側 sidebar（桌機）/ drawer（手機）+ sticky-nav pills（anchor scroll 跳轉）。資訊類區塊（航班/清單/備案/緊急/建議）渲染於頁面底部，僅可透過 sidebar 或捲動到達。

現有架構：
```
┌──────────┬─────────────────────┬────────────┐
│ sidebar  │    .container       │ info-panel │
│ (nav)    │  ┌──sticky-nav──┐   │ (countdown │
│          │  │ ☰  D1 D2 D3  │   │  stats     │
│          │  └──────────────┘   │  suggest)  │
│          │  [day1 section]     │            │
│          │  [day2 section]     │            │
│          │  [day3 section]     │            │
│          │  [flights section]  │            │
│          │  [checklist...]     │            │
│          │  [backup...]        │            │
│          │  [emergency...]     │            │
│          │  [suggestions...]   │            │
└──────────┴─────────────────────┴────────────┘
  FABs: [ℹ] [＋]
```

改造後架構：
```
┌─────────────────────────────────┬────────────┐
│         .container              │ info-panel │
│  ┌──sticky-nav──────────────┐   │ (保留)     │
│  │ Trip Planner 1 2 3  🖨 ⚙ │   │            │
│  └──────────────────────────┘   │            │
│  [day1 section] ← 一次只顯示一天  │            │
│                                 │            │
│                                 │            │
└─────────────────────────────────┴────────────┘
  FABs: [▲ speed dial] [＋]
```

## Goals / Non-Goals

**Goals:**
- 以 tab 模式切換天數，減少不必要的捲動
- 移除 sidebar，簡化頁面結構
- Speed Dial FAB 提供快速進入航班/清單/備案/緊急/建議
- 統一桌機/手機版的導航模式

**Non-Goals:**
- 不修改 edit.html / setting.html 的 sidebar（它們有自己的選單）
- 不修改行程 JSON 資料結構
- 不修改 info-panel 的內容（countdown / stats / suggestion cards）
- 不修改列印模式的最終輸出格式

## Decisions

### D1: Tab 切換方式 — CSS display 切換

**選擇**：所有天數同時渲染於 DOM，用 `display: none` / `display: block` 切換。
**替代方案**：JavaScript 動態渲染當前天數。
**理由**：
- 現有 `renderTrip()` 已一次產生所有 section HTML
- display 切換保留 DOM 狀態（展開/收合、天氣載入結果），切換回來不需重新渲染
- 列印模式只需全部設為 `display: block`，無需額外處理
- 效能影響可忽略（一般行程 ≤15 天）

### D2: Pills 標籤改為純數字

**選擇**：`"1"` `"2"` `"3"` 取代 `"D1"` `"D2"` `"D3"`，桌機版在 pills 左方加 "Trip Planner" 文字。
**理由**：
- 純數字節省水平空間，多天行程更不易溢出
- "Trip Planner" 品牌文字利用桌機版的寬螢幕空間
- 手機版不顯示 "Trip Planner"（空間不足）

### D3: Sidebar 移除策略

**選擇**：index.html 完全移除 `<aside class="sidebar">` 和 drawer，改為雙欄佈局。
**替代方案**：保留 sidebar 但預設收合。
**理由**：
- sidebar 功能已被 tab pills + speed dial + nav icons 完全取代
- edit/setting 頁有各自的 sidebar，不受影響
- 移除後 container 可用寬度增加，閱讀體驗更好

**影響**：
- `js/app.js` 中的 `buildMenu()` 不再需要渲染 sidebar/drawer 內容
- `js/menu.js` 中的 sidebar toggle / drawer 邏輯在 index.html 不再觸發（但 menu.js 仍被 edit/setting 頁使用）
- 三欄佈局 grid 改為雙欄：`grid-template-columns: 1fr var(--panel-w)`

### D4: Speed Dial FAB 設計

**選擇**：現有 ℹ FAB 位置改為 Speed Dial 觸發按鈕。
**icon**：收合時 ▲ 三角形、展開時 ▼ 三角形（inline SVG）。
**子項目**：由下到上依序為 ✈ 航班 / ✓ 清單 / 🔄 備案 / 🚨 緊急 / 💡 建議。
**互動流程**：
1. 點擊 ▲ → 展開子項目 + backdrop
2. 點擊子項目 → 關閉 speed dial + 開啟 bottom sheet（顯示對應內容）
3. 點擊 backdrop 或 ▼ → 關閉 speed dial

**子項目 icon**：全部使用 `js/icons.js` ICONS registry 中的 icon（不用 emoji）。需要新增的 icon：
- `flight`（航班）：已存在
- `checklist`（清單）：已存在
- `backup`（備案）：已存在 `refresh` 或類似
- `emergency`（緊急）：已存在 `alert-circle` 或類似
- `lightbulb`（建議）：已存在

### D5: Bottom Sheet 內容動態切換

**現狀**：Bottom Sheet 只顯示 info-panel 內容（countdown/stats/suggestions）。
**改造**：Bottom Sheet 內容依 Speed Dial 選擇動態渲染：
- 航班 → `renderFlights()` 產生的 HTML
- 清單 → `renderChecklist()` 產生的 HTML
- 備案 → `renderBackup()` 產生的 HTML
- 緊急 → `renderEmergency()` 產生的 HTML
- 建議 → `renderSuggestions()` 產生的 HTML

需要將這些渲染函式重構為回傳 HTML string 的純函式（目前可能直接操作 DOM）。

### D6: Nav 右側 icon 按鈕

**桌機版**（≥768px）：`🖨 列印模式` `⚙ 設定` — icon + 文字
**手機版**（<768px）：🖨 ⚙ — 純 icon
**實作**：在 `sticky-nav` 右側新增 `.nav-actions` 容器，使用 `data-action="toggle-print"` 和 `href="setting.html"` 連結。

### D7: 手機版 pill 區域（方案 A）

pill 區域保持現有橫向捲動 + 箭頭機制，🖨⚙ 固定在 sticky-nav 最右側不隨 pill 捲動。
```
┌──────────────────────────────────┐
│ ◂ [1] [2] [3] [4] [5] ▸  🖨 ⚙  │
└──────────────────────────────────┘
```

`sticky-nav` 改為 flex 佈局：`dh-nav-wrap`（flex: 1）+ `.nav-actions`（flex-shrink: 0）。

## Risks / Trade-offs

- **[頁面初始渲染效能]** → 所有天數同時渲染增加 DOM 節點數量，但實測行程 ≤15 天影響可忽略。若未來行程極長可考慮虛擬化。
- **[Sidebar 移除影響 edit/setting 頁]** → edit/setting 頁的 sidebar 獨立於 index.html，不受影響。但 `menu.js` 仍需保留 sidebar 邏輯供這兩頁使用。
- **[Speed Dial 手勢衝突]** → Speed Dial backdrop 與 Bottom Sheet backdrop 可能重疊，需確保開啟 Bottom Sheet 時先關閉 Speed Dial overlay。
- **[列印模式相容性]** → 列印模式需切換所有天數為 `display: block`，已在 D1 考量。
- **[Browser Back 按鈕]** → Tab 切換不影響瀏覽器歷史（無 pushState），這是有意為之——使用者按 back 返回上一頁，而非上一天。
