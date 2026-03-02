## Context

`edit.html` 目前的 UI 由三個垂直區塊組成：問候語區（靜態卡片）、issue 歷史列表（獨立捲動）、底部輸入卡片（fixed 定位）。這種佈局在視覺上是表單式的，與「對話」使用情境不符。

本次改版參考 Claude Code App（手機版）與 Claude.ai Web（桌機版）的聊天 UI 慣例，將頁面改為 chat 對話流，讓使用者對修改建議的送出流程更直覺。

技術棧限制：原生 HTML/CSS/JS，無框架，需相容 GitHub Pages 靜態部署。

## Goals / Non-Goals

**Goals:**
- 改寫 `css/edit.css` 為 flex column chat container layout
- 訊息區域（系統問候 + issue 氣泡）可獨立捲動
- 底部輸入框 sticky 在視窗底部
- 系統訊息左對齊、使用者訊息右對齊氣泡
- 桌機版 chat 內容限寬居中（max-width: 60vw）
- 修改 `js/edit.js` 的 `renderEditPage()` 與 `renderIssues()` 產生新 HTML 結構

**Non-Goals:**
- 不改動 GitHub API 呼叫邏輯（fetch issues、POST issue）
- 不改動行程決定邏輯（`?trip=` / localStorage / trips.json fallback）
- 不改動行程下拉選單邏輯
- 不加入即時串流或 WebSocket
- 不改動 `shared.css`、`menu.css`、`shared.js`、`menu.js`

## Decisions

### 決策 1：Chat Container 用 `100dvh - sticky-nav 高度` 而非 `100vh`

**選擇**：使用 `100dvh`（dynamic viewport height）搭配 CSS 變數 `--nav-h`（sticky nav 實際高度）計算 chat container 高度。

**理由**：手機瀏覽器工具列會動態收縮，`100vh` 在 iOS Safari 會導致底部輸入框被工具列遮擋；`100dvh` 可隨工具列收縮正確計算可視高度。

**替代方案**：`calc(100vh - 56px)` 硬編碼 nav 高度 → 若 nav 高度變動時需手動同步，排除。

### 決策 2：訊息區域用 `flex: 1; overflow-y: auto`，輸入框不進入捲動區

**選擇**：chat container 為 `display: flex; flex-direction: column`，訊息區域 `flex: 1; overflow-y: auto`，輸入框在 chat container 底部（不使用 `position: fixed`）。

**理由**：使用 flex 子元素控制捲動比 `position: fixed` 更易維護，且不需處理底部安全區 padding（`env(safe-area-inset-bottom)`）的堆疊問題。

**替代方案**：整個頁面 `overflow: hidden`，輸入框 `position: fixed; bottom: 0` → 需額外處理軟鍵盤彈出時的位移，排除。

### 決策 3：桌機版限寬用 `max-width: 60vw; margin: 0 auto` 套在訊息內容 wrapper

**選擇**：在 `@media (min-width: 768px)` 時，訊息區域的內層 wrapper 設 `max-width: 60vw; margin: 0 auto`，sidebar 與 chat 分欄維持現有 CSS Grid 結構。

**理由**：訊息內容過寬在桌機版閱讀困難；限制訊息欄寬度使閱讀線更舒適，符合 Claude.ai Web 設計慣例。

### 決策 4：Issue 狀態標記用純 CSS 小圓點（非 icon）

**選擇**：open 狀態用 `background: var(--color-success)`（綠色）小圓點（`width: 8px; height: 8px; border-radius: 50%`）；closed 狀態用 `background: var(--color-text-secondary)`（暗色）。

**理由**：全站 inline SVG 規範針對功能性 icon，狀態指示小圓點屬裝飾性元素，用純 CSS 圓點更輕量且易於維護。不需新增 icon 至 `icons.js`。

## Risks / Trade-offs

- **[風險] 手機軟鍵盤彈出時輸入框被遮擋** → 使用 flex layout（非 fixed）可讓瀏覽器自行處理 resize，通常無問題；若仍有問題可補 `env(safe-area-inset-bottom)` padding。
- **[風險] 現有 E2E 測試依賴舊 CSS selector 或 DOM 結構** → 改版後需檢視 `tests/e2e/` 相關測試，確保 selector 更新。
- **[取捨] `100dvh` 在老舊瀏覽器不支援** → 加 `height: calc(100vh - var(--nav-h)); height: calc(100dvh - var(--nav-h))` fallback。
