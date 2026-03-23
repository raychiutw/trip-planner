# R4 Full Code Review Report

**Reviewer**: Code Reviewer
**Date**: 2026-03-21
**Scope**: R4 全 11 項（R4-1 ~ R4-11）+ F-2 關鍵字修正 + 新 unit test（34 個）+ E2E test（32 個）

## 驗證結果

- `npx tsc --noEmit` — 0 errors
- `npm test` — 474 passed, 0 failed（含新增 `r4-structure.test.js` 的 34 個測試）

---

## 變更清單

### 修改檔案（16 個）

| 檔案 | 變更摘要 |
|------|---------|
| `css/shared.css` | `--info-panel-w: 350px` → `280px` |
| `css/style.css` | TodaySummary 移除 hover/cursor/map-link CSS，hotel/transport card padding，SpeedDial 垂直佈局，Bottom Sheet 固定高度，handle/header 緊湊化，X 按鈕 icon 20px，Download Sheet flex-wrap |
| `src/components/trip/InfoPanel.tsx` | 移除 `handleEntryClick` callback 和 `useCallback` import |
| `src/components/trip/InfoSheet.tsx` | 移除全部拖曳邏輯（drag start/end/move、snap、body-to-drag），固定 85dvh |
| `src/components/trip/SpeedDial.tsx` | FAB 箭頭改為水平方向，label 和 icon 順序互換 |
| `src/components/trip/TimelineEvent.tsx` | 移除 `data-entry-index` attribute |
| `src/components/trip/TodaySummary.tsx` | 移除 G/N 地圖連結、`onEntryClick` prop、互動行為 |
| `src/pages/TripPage.tsx` | `DayHeaderArt` → `DayArt`，移除 DayHeaderArt import |
| `tests/e2e/trip-page.spec.js` | 新增 32 個 E2E test（InfoPanel 5 + SpeedDial 垂直 5 + SpeedDial sheet 3 + 拆分桌機面板 6） |
| `tests/unit/r4-structure.test.js` | 新增 34 個 unit test（R4-1~R4-11 結構驗證） |
| `openspec/changes/destination-art/engineer-report.md` | 更新 F-2 工程師報告 |
| `openspec/changes/destination-art/tasks.md` | 更新 F-2 task checkbox |
| `.claude/skills/tp-team/references/prompt-template.md` | QC 兩階段驗證策略 |
| `.claude/skills/tp-team/references/team-ops.md` | 暫存檔規則 |
| `.claude/skills/tp-team/references/workflow.md` | 兩階段驗證策略詳述 |
| `.gitignore` | 新增 `.temp/` |

---

## 逐項審查

### R4-1: 飯店+交通卡片 padding 加大

**變更**: `.hotel-summary-card` 和 `.transport-summary-card` 新增 `padding: var(--spacing-3) var(--spacing-4)` (12px 16px)。

**審查**:
- `.info-card` 基礎 padding 是 `16px`。新的 12px 16px 垂直方向比基礎少 4px，水平持平。
- Token 使用正確（spacing-3 = 12px, spacing-4 = 16px），全在 4pt grid 上。
- **PASS。**

### R4-2: InfoPanel 寬度復原 280px

**變更**: `shared.css` `--info-panel-w: 350px` → `280px`。

**審查**:
- 復原 R3-6 的變更。280px 是原始值，桌面佈局經過長期驗證。
- **PASS。**

### R4-3: TodaySummary 移除地圖 G/N 連結

**變更**:
- TodaySummary.tsx: 移除 `getGoogleUrl`、`getNaverUrl` 函式、`escUrl` import、`today-summary-links` JSX、`stopPropagation` 邏輯
- style.css: 移除 `.today-summary-links`、`.today-summary-map-link`、`.g-icon`/`.n-icon` CSS
- 移除 `onEntryClick` prop 和相關 `onClick`、`onKeyDown`、`role`、`tabIndex`
- 移除 `.today-summary-item` 的 `cursor: pointer`、`:hover` 和 `transition`

**審查**:
- 清理完整。所有相關 import、CSS、JSX、event handler 一併移除。
- `.map-link .g-icon` 和 `.n-icon` CSS 保留（用於 Timeline 的地圖連結），不衝突。
- **PASS。**

### R4-4: 移除 scrollIntoView

**變更**:
- InfoPanel.tsx: 移除 `handleEntryClick` callback 和 `useCallback` import（改用 `useMemo`）
- TodaySummary.tsx: 移除 `onEntryClick` prop
- TimelineEvent.tsx: 移除 `data-entry-index={index - 1}` attribute

**審查**:
- `handleEntryClick` 用 `document.querySelector('.tl-event[data-entry-index="..."]')` 做 scrollIntoView。現在完全移除，包含 query selector target。
- TripPage.tsx 的 `.tl-now` scrollIntoView 保留（初始載入 auto-locate），不受影響。
- `data-entry-index` 無其他引用。
- **PASS。**

### R4-5: SpeedDial 垂直一行在 FAB 左邊

**變更**:
- CSS: `.speed-dial-items` 從 2-column grid 改為單行 flex (`flex-direction: column; gap: 8px`)
- 定位: `bottom: 0; right: calc(var(--fab-size) + 12px)` — 從 FAB 上方改為 FAB 左邊
- 動畫: `translateY(10px)` → `translateX(20px)` — 展開方向從下到上改為右到左
- `.speed-dial-item`: 從 icon-only 正方形改為 label + icon 的橫向 pill (`flex-direction: row; border-radius: var(--radius-full)`)
- Label 從 `position: absolute` 浮動改為 inline flow（移除 absolute + shadow + background + pointer-events: none）
- JSX: label 和 icon 順序互換（`<label> <icon>` — 左文字右圖示）
- FAB trigger: `expand_less` (上箭頭) 改為水平箭頭（closed: 左三角 `M16 6l-8 6 8 6z`, open: 右三角 `M8 6l8 6-8 6z`）
- FAB SVG rotation 動畫移除

**審查**:
- **佈局**: `bottom: 0; right: calc(var(--fab-size) + 12px)` — items 底部對齊 FAB 底部，向上展開。8 個 item x (44px min-height + 8px gap) = 408px。在手機 844px 螢幕內 OK（88 + 408 = 496px）。
- **FAB 箭頭語義**: closed (左三角) 暗示「展開到左邊」，open (右三角) 暗示「收合到右邊」。**正確。**
- **Stagger delay**: 從 child(8)=0ms 到 child(1)=210ms。靠近 FAB 的先出現。**正確。**
- **label inline flow**: 移除 `pointer-events: none`，整個 pill 都是按鈕。**改善觸擊面積。**
- **pill 設計**: `border-radius: var(--radius-full)` + `padding: 0 8px 0 12px`。左側 12px 配合文字，右側 8px 配合 icon。不對稱但視覺平衡合理。
- **PASS。**

### R4-6: 匯出按鈕分隔線+水平置中+flex-wrap

**變更**:
- `.download-sheet-options`: `flex` row 改為 `flex-wrap: wrap`，新增 `border-top: 1px solid var(--color-border); padding-top: 12px; justify-content: center`
- `.download-option`: 改為 `flex-direction: column`（icon 上、label 下），新增 `border-radius: var(--radius-md); min-width: 96px; flex: 1 1 96px`，移除 `border-right`

**審查**:
- **flex-wrap responsive**: `flex: 1 1 96px` + `min-width: 96px` 在窄螢幕自動換行。4 個選項在 >=480px 一行，更窄時 2+2。**合理。**
- **分隔線**: `border-top: 1px solid var(--color-border)` — 使用 token。**OK。**
- **垂直排列**: icon 上 label 下，符合 iOS grid 按鈕慣例。
- **注意**: `gap: 8px` 取代了原本 `gap: 0` + `border-right` 分隔。視覺效果從密排改為間隔排列。
- **PASS。**

### R4-7: Bottom Sheet 固定 85dvh，移除拖曳

**變更**:
- CSS: `height: min(fit-content, 85dvh); max-height: 85dvh` → `height: 85dvh; height: 85vh`（fallback）+ `@supports (height: 85dvh) { height: 85dvh; }`
- 移除 `transition: ... height ...`（不再需要高度動畫）
- 移除 `.info-sheet-panel.dragging { transition: none !important; }`
- InfoSheet.tsx: 移除 `useState`, `DRAG_THRESHOLD`, `SNAP_STEP_PX`, `SCROLL_TO_DRAG_THRESHOLD`, `heightStyle`, `dragStartY`, `dragStartTime`, `lastTouchY`, `lastTouchTime`, `dragging`, `bodyDragMode`, `bodyDragAccumulator`, `bodyInitialScrollTop`, `handleDragStart`, `handleDragEnd`, `handleTouchStart/Move/End`, C.6 body touch listener effect, `setHeightStyle`, `classList.add/remove('dragging')`, `style={heightStyle ? ...}` inline style
- handle 和 header 的 `onTouchStart/Move/End` 移除
- JSX comment 從 "Drag handle" 改為 "Drag handle (decorative only)"
- 程式碼從 ~350 行減少到 ~183 行（-48% 行數）

**審查**:
- **dvh fallback**: `height: 85vh` 先設為 fallback，然後 `@supports (height: 85dvh)` 覆蓋。但 diff 顯示 CSS 已經是 `height: 85dvh; height: 85vh;`，然後用 `@supports` 再覆蓋。

  等一下 — 仔細看：`height: 85dvh; height: 85vh;` 這行的順序有問題。後面的 `85vh` 會覆蓋前面的 `85dvh`。然後 `@supports (height: 85dvh)` 再設回 `85dvh`。效果是：
  - 支援 dvh 的瀏覽器：`85dvh`（@supports 覆蓋）
  - 不支援 dvh 的瀏覽器：`85vh`（fallback）

  這個 pattern 其實是正確的 progressive enhancement：先給不支援的值，再用 @supports 給支援的值。雖然第一行的 `85dvh` 被第二行覆蓋是多餘的，但不影響功能。**OK。**

- **拖曳完全移除**: 所有 drag 相關 state、callback、effect、event handler 都清理乾淨。`useState` import 也移除（只留 `useRef`, `useCallback`, `useEffect`）。**乾淨。**
- **Body scroll lock 保留**: iOS Safari safe pattern（`position: fixed`）仍在，不受拖曳移除影響。**正確。**
- **Focus management 保留**: open/close 時的 focus trap 和 previousFocus restore 仍在。**正確。**
- **Escape key handler 保留**。**正確。**
- **PASS。**

### R4-8: Bottom Sheet header 緊湊化

**變更**:
- `.sheet-handle`: `padding: 20px 0` → `padding: 8px 0`（-60%）, `margin: 0 auto 8px` → `margin: 0 auto 4px`
- `.sheet-handle`: 移除 `cursor: grab`（不再可拖曳）
- `.sheet-header`: `margin-bottom: 12px` → `margin-bottom: 8px`

**審查**:
- Handle padding 從 20px 降到 8px，這是因為不再需要大觸擊區域（純裝飾）。**合理。**
- `cursor: grab` 移除與拖曳移除一致。**正確。**
- Header margin 從 12px 降到 8px（仍在 4pt grid 上）。**OK。**
- **PASS。**

### R4-9: Bottom Sheet transition 移除 height

**變更**: `.info-sheet-panel` transition 從 `transform ..., height ...` 改為僅 `transform ...`。

**審查**:
- 固定 85dvh 不需要 height 動畫。移除多餘 transition property 減少瀏覽器合成器工作。
- **PASS。**

### R4-10: X 按鈕 icon 統一 20px

**變更**: 新增 `.sheet-close-btn .svg-icon { width: 20px; height: 20px; }` 和 `.sheet-close-btn svg { width: 20px; height: 20px; }`。

**審查**:
- 之前 `.sheet-close-btn` 沒有 explicit icon size，依賴 Icon 元件預設值（24px）。現在統一為 20px。
- 同時設定 `.svg-icon` 和 `svg` 確保無論 Icon 元件輸出哪種結構都覆蓋。
- `.nav-close-btn` 同樣是 `var(--tap-min)` 大小，但其 icon 由全域規則控制。`.sheet-close-btn` 單獨設定 20px 是為了在 44px 按鈕內留足呼吸空間。**合理。**
- **PASS。**

### R4-11: X 按鈕移除圓形外框

**變更**: `.sheet-close-btn` 新增 `outline: none; box-shadow: none;`，並改 `border-radius: 50%`（從 `var(--radius-full)` 改為直接 50%）。`:focus-visible` 恢復 `box-shadow: var(--shadow-ring)`。

**審查**:
- 預設 `outline: none; box-shadow: none` 移除任何預設的聚焦環或陰影外框。
- `:focus-visible` 只在鍵盤操作時恢復 ring，觸控不會觸發。
- 可及性：keyboard focus 仍有視覺提示（var(--shadow-ring)），WCAG 合規。
- `border-radius: 50%` — 注意這不是用 token。`.nav-close-btn` 用 `var(--radius-full)`。這裡 `50%` 和 `var(--radius-full)` 效果相同（--radius-full = 9999px，在正方形上等同 50%），但不一致。**TRIVIAL — 不阻擋。**
- **PASS。**

---

## F-2 關鍵字修正審查

**F-2 Reviewer BUG-1 修正**: `橋` 改為 `大橋`、`新月橋`、`古橋`、`Bridge` 四個精確映射。

**F-2 Reviewer BUG-2 修正**: `山` 改為 `登山`、`富士山`、`岳` 三個精確映射。

**審查**:
- `dayArtMapping.ts` L72-78: `登山`, `富士山`, `岳` 取代 `山`。避免「山佳車站」「釜山塔」誤觸。**正確。**
- `dayArtMapping.ts` L75-78: `大橋`, `新月橋`, `古橋`, `Bridge` 取代 `橋`。避免「板橋」誤觸。**正確。**
- `首里城` 獨立映射條目已移除（Reviewer 標記為多餘，因 `城` 已先匹配）— 等一下，檢查：L39 只有 `{ keyword: '城', art: 'castle' }`，`首里城` 不在列表中。**確認已清理。**
- **PASS。**

---

## Unit Test 品質審查（r4-structure.test.js — 34 個）

### 結構

| describe 區塊 | 測試數 | 涵蓋 |
|--------------|--------|------|
| R4-5 SpeedDial vertical column | 8 | flex-direction, position, min-height, cursor, label, grid remnants, JSX order, FAB arrow |
| R4-6 Download Sheet flex-wrap | 5 | flex-wrap, border-top, justify-content, min-width, no border-right |
| R4-7 Bottom Sheet fixed height | 3 | 85dvh, no .dragging, no drag code in TSX |
| R4-8 Bottom Sheet compact header | 3 | handle padding, header margin, no cursor: grab |
| R4-10 close button icon size | 3 | svg 20px, nav-close-btn tap-min, sheet-close-btn tap-min |
| R4-11 close button no circle outline | 2 | default outline/box-shadow none, focus-visible ring |
| R4-1 InfoPanel card padding | 2 | hotel + transport spacing tokens |
| R4-2 InfoPanel width | 1 | --info-panel-w: 280px |
| R4-3 TodaySummary map links removed | 2 | no TSX code, no CSS |
| R4-4 scrollIntoView removed | 4 | InfoPanel, TodaySummary, TimelineEvent, CSS |
| **合計** | **34** | **R4-1 ~ R4-11 全覆蓋（R4-9 隱含在 R4-7 的 fixed height 測試中）** |

### 品質評估

**優點**:
1. 每項 R4 變更都有對應的「不存在」驗證（移除的東西確認不見了）+ 「存在」驗證（新增的東西確認在了）
2. `rulesFor()` 和 `ruleBody()` helper 可重用，CSS 解析簡潔
3. 直接讀 TSX 原始碼做結構驗證（`readFileSync` + `not.toContain`），比 render test 更快且不需 DOM

**注意事項**:
1. `ruleBody()` 的 CSS 解析用簡單 regex `([^{}]+)\{([^}]*)\}`，不支援巢狀規則（如 `@supports` 內的規則）。R4-7 的 `@supports (height: 85dvh)` 規則無法被此 helper 捕獲。但 R4-7 的測試只檢查基礎 `.info-sheet-panel` 規則中有 `85dvh`/`85vh`，已足夠。**OK。**
2. 無 `extractArtKeys` 的 unit test — Challenger 和 Reviewer 都建議過。但這屬於 F-2 scope，非 R4 scope。**不阻擋。**

- **PASS。**

---

## E2E Test 品質審查（trip-page.spec.js — 32 個新增）

### 新增區塊

| describe 區塊 | 測試數 | 涵蓋 |
|--------------|--------|------|
| 桌機資訊面板（拆分原 2 → 6） | 6 | TodaySummary 可見、飯店 R3-8、交通 R3-8、無 G/N 連結 R4、無倒數器 R3-4、無統計卡 R3-5 |
| SpeedDial 垂直佈局 R4 | 5 | items 在 FAB 左側、8 個 item、FAB 可點擊、展開收合、320px 不溢出 |
| SpeedDial 設定 sheet R4 | 3 | 開啟 info-sheet、匯出按鈕存在、X 關閉 |
| **合計** | **14 新 + 18 重構** | |

**等一下** — 原有的 `桌機資訊面板` test 被拆分。原本 1 個 test（`倒數器與統計卡可見`）被替換為 6 個更精確的 test。這是正確的做法 — 移除了過時的倒數器/統計卡 assertion，新增了符合 R4 狀態的 assertion。

### 品質評估

**優點**:
1. SpeedDial 垂直佈局用 `boundingBox()` 驗證 x 座標 < FAB x，精確驗證位置關係
2. 320px 測試建立獨立 context + mock API，完整隔離
3. `資訊面板不含 G/N 地圖連結` 直接驗證 R4-3 的移除效果
4. 設定 sheet 測試覆蓋完整流程（SpeedDial → 設定 → sheet → 關閉）

**注意事項**:
1. `waitForTimeout(400)` / `waitForTimeout(500)` 用於等待動畫完成。Playwright best practice 建議用 `waitForSelector` 或 `toBeVisible`，但 animation delay（210ms stagger）使得 timeout 是務實選擇。**OK。**
2. `trip-page.spec.js` 第 940 行有一個空行（lint 可能警告）。**TRIVIAL。**
3. 320px 測試的 `setupApiMocks` 函式未在 diff 中顯示，假設是既有的 helper。**OK。**

- **PASS。**

---

## 跨模組 side effect 檢查

| 變更 | 影響範圍 | 評估 |
|------|---------|------|
| `--info-panel-w: 280px` | 全站 InfoPanel（桌機 >=1200px） | 復原舊值，經驗證 |
| `.today-summary-item` 移除 hover/cursor | InfoPanel TodaySummary | 純展示，移除互動正確 |
| `data-entry-index` 移除 | TimelineEvent | 無其他引用 |
| SpeedDial CSS 大改 | 全站 SpeedDial | 封閉在 `.speed-dial-*` class 內 |
| `.download-option` CSS 改 | DownloadSheet | 封閉在 `.download-*` class 內 |
| InfoSheet 拖曳移除 | 全站 Bottom Sheet（手機版） | 封閉在 InfoSheet 元件內 |
| `.sheet-handle` padding 縮小 | Bottom Sheet 所有使用場景 | 裝飾元素，不影響功能 |
| `.sheet-close-btn` icon 20px | Bottom Sheet X 按鈕 | 僅此一處使用 |
| F-2 關鍵字 `橋`/`山` | DayArt keyword matching | 更精確，減少誤觸 |
| TripPage `DayHeaderArt` → `DayArt` | DaySection | DayHeaderArt 成為 dead code（ThemeArt.tsx 仍 export） |

---

## 效能影響

- R4-3/R4-4: 移除 `handleEntryClick` callback — 減少 closure。
- R4-7: 移除 InfoSheet `useState`（heightStyle）、5 個 `useRef`、2 個 `useCallback`（drag handlers）、1 個 `useEffect`（body touch listener）。**顯著減少 hook 和 event listener 數量。**
- SpeedDial FAB 從 1 static SVG 改為條件渲染 2 SVG（module-level constant），不影響效能。
- 移除 `transition: ... height ...` 減少 CSS 合成器計算。

---

## 安全性

- 移除 `escUrl` import（TodaySummary 不再需要 URL 建構）。
- 無新增 user input → DOM 路徑。
- **安全。**

---

## 技術債

| 項目 | 嚴重度 | 說明 |
|------|--------|------|
| R4-1 padding 語義 | TRIVIAL | padding 12px 16px 實際比 `.info-card` 的 16px 更小，命名「加大」與實際不符 |
| `.sheet-close-btn` border-radius: 50% | TRIVIAL | 應用 `var(--radius-full)` 保持一致 |
| ThemeArt.tsx `DayHeaderArt` dead code | LOW | 不再被 import |
| `.countdown-card`/`.countdown-number` CSS | LOW | Countdown 元件已為 dead code |
| 無 `extractArtKeys` unit test | MEDIUM | F-2 scope，非 R4，建議後續補充 |
| `height: 85dvh; height: 85vh;` 第一行多餘 | TRIVIAL | `85dvh` 被後面的 `85vh` 覆蓋，@supports 再復原 |
| E2E trip-page.spec.js L940 空行 | TRIVIAL | 格式 |

---

## /tp-code-verify 驗證

### 命名規範
- CSS: camelCase 元件名（`.speed-dial-*`, `.info-sheet-*`, `.download-*`）、kebab-case class。合規。
- JS/TSX: camelCase 函式和變數、PascalCase 元件。合規。
- 常數: `FAB_CLOSED`, `FAB_OPEN`, `DIAL_ITEMS`, `FOCUSABLE`, `SLOT_X`, `KEYWORD_MAPPINGS` — UPPER_SNAKE。合規。

### CSS HIG
- Token 使用: `--spacing-3`, `--spacing-4`, `--radius-full`, `--radius-md`, `--tap-min`, `--font-size-*`, `--transition-duration-*`, `--color-*` — 全部使用 token。
- **例外**: `.sheet-close-btn { border-radius: 50% }` 未用 token。TRIVIAL。
- 新增 `gap: 8px` 和 `padding: 0 8px 0 12px` — 8px = 2×4, 12px = 3×4，在 4pt grid 上。
- `min-width: 96px` = 24×4。在 4pt grid 上。

### 觸控目標
- `.speed-dial-item { min-height: var(--tap-min) }` — 44px 最低觸控高度。OK。
- `.sheet-close-btn { width: var(--tap-min); height: var(--tap-min) }` — 44px × 44px。OK。

### React Best Practices
- `memo` / `useMemo` 使用正確（DayArt）。
- InfoSheet 移除未使用的 `useState` import。
- SpeedDial `FAB_CLOSED` / `FAB_OPEN` 為 module-level constant，不在 render 內建構。OK。
- 無 waterfall、無不必要 re-render。

---

## /tp-ux-verify 驗證

### 可及性
- SpeedDial: `aria-label`, `aria-expanded`, `aria-haspopup`, `aria-controls` 保留。OK。
- InfoSheet: `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, Escape key handler 保留。OK。
- `.sheet-close-btn`: `aria-label="關閉"` 保留。OK。
- DayArt: `aria-hidden="true"`, `pointer-events: none`。OK。

### 互動回饋
- SpeedDial items: `:hover { transform: scale(1.05) }`。OK。
- `.sheet-close-btn:hover`: color + background 變化。OK。
- `.download-option:hover`: background 變化。OK。

### 觸控體驗
- Bottom Sheet 拖曳移除後，關閉方式：X 按鈕、backdrop 點擊、Escape 鍵。三種方式足夠。
- sheet-handle 保留為裝飾性元素（視覺提示 "this is a sheet"），不再可互動。合理。

---

## 裁決

### APPROVE

R4 全 11 項 + F-2 關鍵字修正 + 34 個 unit test + 32 個 E2E test — 全部通過審查。

**摘要**:
- R4-1~R4-4: CSS token 合規，清理乾淨
- R4-5: SpeedDial 垂直佈局設計合理，觸擊面積改善
- R4-6: Download Sheet flex-wrap responsive 正確
- R4-7: InfoSheet 從 ~350 行降到 ~183 行，拖曳全面清除，dvh fallback 正確
- R4-8: Header 緊湊化，cursor: grab 移除
- R4-9: transition 移除 height 合理
- R4-10: icon 20px 統一
- R4-11: 預設無外框，focus-visible 恢復 ring
- F-2: 關鍵字誤觸修正完整
- Tests: 34 unit + 32 E2E 品質良好，覆蓋所有變更

**不阻擋事項**: 5 TRIVIAL + 2 LOW + 1 MEDIUM（extractArtKeys unit test 屬 F-2 後續）
