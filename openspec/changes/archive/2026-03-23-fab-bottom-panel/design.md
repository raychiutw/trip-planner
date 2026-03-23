## Context

現行 SpeedDial 元件（`SpeedDial.tsx`）以垂直堆疊按鈕方式在 FAB 旁展開 8 個項目，每項包含兩個重複的 `<span class="speed-dial-label">`，且「設定」按鈕內含巢狀子選單（tools group）需額外點擊。手機版按鈕遮擋右側內容（Mapcode、交通資訊）。QC 稽核另發現停車場地圖連結為空、URL trip 參數被 localStorage 覆蓋等問題。

主題系統目前有 6 個色彩主題（sun / sky / zen / forest / sakura / ocean），其中 sky（天藍）與 ocean（深藍）色相太近，且缺少純黑色系主題。

## Goals / Non-Goals

**Goals:**
- 將 SpeedDial 重構為 iOS Action Sheet 風格的 QuickPanel Bottom Sheet
- 扁平化所有功能項目至單層 grid（無巢狀子選單）
- 「切換行程」和「外觀主題」以 sheet-in-sheet drill-down 在 panel 內完成，不跳頁
- ocean 主題替換為 night（黑/炭灰色系）
- 修復 QC 發現的 5 個問題（M1-M5 + L4）

**Non-Goals:**
- 不重構 InfoSheet 主體結構（保持 85dvh + 現有動畫）
- 不新增滑動手勢關閉（drag handle 維持裝飾用途）
- 不改變 InfoPanel 桌機版行為
- 不修改 API 端點或 D1 schema

## Decisions

### D1: QuickPanel 取代 SpeedDial — 新元件而非改寫

**選擇**：建立全新 `QuickPanel.tsx`，不修改 `SpeedDial.tsx`

**理由**：SpeedDial 的 DOM 結構（垂直堆疊 + inline items）和 QuickPanel（Bottom Sheet + grid）差異太大，改寫會比新建更混亂。完成後整檔刪除 SpeedDial。

**替代方案**：原地改寫 SpeedDial → 太多 breaking changes，git blame 失去意義。

### D2: QuickPanel 內部結構 — 三區段 + 分隔線

**選擇**：
```
Section A: 行程資訊（航班/出發/緊急/備案）    — 4 grid
Section B: 行程工具（建議/路線/交通）          — 3 grid
           快捷設定（行程/外觀/列印）          — 3 grid
─────────── 分隔線（1px var(--color-border)）───────────
Section C: 下載匯出（PDF/MD/JSON/CSV）         — 4 grid
```

每格：Icon 在上 + label 在下，min-height `--tap-min`（44px），grid `repeat(4, 1fr)`。Section B 兩列各 3 格 + 1 空格，自然靠左。

**理由**：iOS Share Sheet 慣例是上方常用功能 + 分隔線 + 下方次要功能。14 項扁平無巢狀，一眼看完。

### D3: FAB 圖示 — 上下箭頭 + 180° rotate

**選擇**：收折時 ▲（朝上），展開時 ▼（朝下），透過 `transform: rotate(180deg)` 搭配 `--transition-timing-function-apple` 實現翻轉。

**理由**：箭頭方向暗示面板從底部升起/收回，比左右箭頭更符合 Bottom Panel 的動線語意。

### D4: Sheet-in-sheet drill-down — 條件渲染內容區

**選擇**：QuickPanel 內部維護 `view` state（`'grid' | 'trip-select' | 'appearance'`），點擊「切換行程」或「外觀主題」時切換 view，內容區以 CSS `opacity + translateX` 左右滑動切換。

**理由**：避免開啟第二個 sheet（z-index 管理複雜），也避免跳頁離開行程（使用者反覆切換行程/主題時不想離開當前頁）。

**替代方案**：開啟新的 InfoSheet → 需管理兩層 sheet 的 z-index 和 body scroll lock，過於複雜。

### D5: night 主題色彩定義

**選擇**：
| Token | Light | Dark |
|-------|-------|------|
| `--color-accent` | `#6B6B6B`（中灰） | `#A0A0A0`（淺灰） |
| `--color-accent-subtle` | `#F0F0F0` | `rgba(160,160,160,0.12)` |
| `--color-accent-bg` | `#E8E8E8` | `rgba(160,160,160,0.08)` |
| `--color-background` | `#F5F5F5`（淺灰白） | `#000000`（純黑） |
| `--color-secondary` | `#EBEBEB` | `#1A1A1A` |
| `--color-tertiary` | `#E0E0E0` | `#2A2A2A` |
| `--color-foreground` | `#1A1A1A` | `#E5E5E5` |
| `--color-muted` | `#808080` | `#999999` |
| `--color-border` | `#D5D5D5` | `#333333` |

**理由**：純黑 `#000000` dark background 對 OLED 螢幕最省電，light mode 用中性灰保持低調。無彩色設計與其他 5 個彩色主題形成對比。

### D6: 停車場地圖連結修正 — `buildLocation` fallback

**選擇**：`mapDay.ts` 的 `buildLocation()` 中，當 `maps` 不是 URL 時，將 `maps` 值作為 `name`（搜尋用），而非空值。

修正邏輯：
```typescript
function buildLocation(maps?, mapcode?, name?): NavLocation | null {
  if (!maps && !mapcode) return null;
  const isUrl = maps && /^https?:/i.test(maps);
  return {
    name: name || (!isUrl && maps ? maps : undefined),
    googleQuery: isUrl ? maps : undefined,
    mapcode: mapcode || undefined,
  };
}
```

### D7: URL trip 參數優先權修正

**選擇**：`TripPage.tsx` 的 resolve effect 中，URL `?trip=` 參數永遠優先於 localStorage。

現行問題（L278）：
```typescript
let tripId = getUrlTrip();
if (!tripId || !/^[\w-]+$/.test(tripId)) {
  tripId = lsGet<string>('trip-pref');
}
```
URL 有值時不應進 localStorage fallback。但目前邏輯看起來已正確？需在 QC 手機版環境重現，可能是 SPA 首次載入時 URL 被覆蓋。

### D8: 預約連結觸控目標修正

**選擇**：CSS `.reservation-link`（或等效選擇器）加上 `min-height: var(--tap-min)` + `display: inline-flex; align-items: center`。

### D9: N+1 API Call 調查

**選擇**：`useTrip.ts` L148-165 已在迴圈中逐一 `apiFetch` 每天的資料，但這是 `Promise.all` 並行發送而非序列，且有 cache。Sentry 標記 N+1 可能是因為 5 天 × 1 request = 5 個同時發出的 fetch。這是預期行為（每天資料獨立端點），不是真正的 N+1。標記為「已知/接受」。

## Risks / Trade-offs

**[風險] QuickPanel 14 項 grid 在小螢幕可能需要捲動**
→ 緩解：面板高度 `auto`，max-height `50dvh`，超出時 `overflow-y: auto`。實測 14 項在 390px 寬度下約需 280px 高度，不會超出。

**[風險] sheet-in-sheet 返回按鈕可能被忽略**
→ 緩解：返回按鈕用明顯的 `← 返回` 文字 + icon，且 backdrop 點擊仍可關閉整個面板。

**[風險] night 主題純黑底在 LCD 螢幕上對比可能過強**
→ 緩解：light mode 用 `#F5F5F5`（非純白），dark mode 用 `#000000`（純黑）。LCD 使用者通常不選 night 主題。

**[取捨] 刪除 ocean 主題 — 已有使用者可能已選用**
→ 緩解：migration 邏輯在 `readColorTheme()` 中，`ocean` → 自動 fallback 為 `night`。
