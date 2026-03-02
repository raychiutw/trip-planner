## Context

全站存在 8 項 UI 細節問題，橫跨 CSS（shared/style/menu/edit/setting）與 JS（shared/app）。這些問題互不相依，可獨立修正，但歸為同一批次以減少零散 commit。

現有架構：
- CSS 變數定義在 `shared.css`（`:root` + `body.dark`），各頁面 CSS 引用變數
- `shared.js` IIFE 負責頁面載入時套用色彩模式
- `app.js` 負責天氣區塊渲染（收合/展開）
- 捲軸樣式散落各 CSS 檔案，無統一規範

## Goals / Non-Goals

**Goals:**
- 消除桌機 sticky-nav 漢堡選單重複問題
- 統一 map-link 底色與 hover 效果
- 修正 timeline 圓點對齊
- 改善天氣收合區塊排版與箭頭符號
- 修復 hw-now 日期框線被裁切
- 建立全站統一捲軸樣式
- 修正色彩模式預設行為（auto）
- 統一 edit/setting 頁面底色

**Non-Goals:**
- 不重構 sticky-nav 架構（僅修正顯示規則）
- 不變更行程 JSON 結構
- 不修改選單功能邏輯

## Decisions

### D1: sticky-nav 漢堡選單

**選擇**：刪除 `menu.css` 中 `.sidebar.collapsed ~ .container .sticky-nav .dh-menu { display: flex }` 規則。

**理由**：sidebar collapsed 時使用者仍可透過 sidebar 上方的 toggle 按鈕展開，不需在 sticky-nav 額外顯示漢堡。移除此規則最簡單，不影響手機版。

**edit/setting 頁**：桌機版（≥768px）隱藏 `.sticky-nav`（加 `display: none`），手機版保留。

### D2: map-link 底色統一

**選擇**：`.map-link { background: transparent }` + `.map-link:hover { background: #333; color: #fff }`，深色模式 hover 改 `#5A5651`。

**理由**：原本 `.map-link` 和 `.map-link.mapcode` 有不同底色，統一為透明讓視覺更乾淨。hover 色取自原 Apple Maps 連結的底色。

### D3: timeline 圓點對齊

**選擇**：修正 `.tl-event::before` 的 `left` 值，從 `-24px` 微調為正確對齊位置（需配合 padding 計算）。

**理由**：圓點相對於時間軸線存在 ~1px 偏移，純數值修正。

### D4: 天氣收合排版

**選擇**：
1. `.hw-summary` 的 `justify-content` 從 `space-between` 改為 `flex-start`，項目間用 `gap` 控制間距
2. 收合箭頭從 `▸`（旋轉三角）改為 `+`/`-` 文字符號

**理由**：`space-between` 導致內容只有兩個元素時拉很遠。`+`/`-` 比旋轉箭頭更直觀表達可展開/收合。

### D5: hw-now 框線修復

**選擇**：`.hw-grid` 加 `padding-top: 2px`。

**理由**：`.hw-now` 使用 `box-shadow: 0 0 0 2px var(--blue)` 模擬邊框，但父元素 `.hourly-weather`（或 `.hw-grid`）的 `overflow: hidden` 裁切上方 shadow。加 2px padding 給 shadow 空間。

### D6: 全站自訂捲軸

**選擇**：在 `shared.css` 全域定義捲軸樣式（Webkit `::-webkit-scrollbar` + Firefox `scrollbar-width`/`scrollbar-color`）。

**亮色**：軌道透明，滑塊 `#C4C0BB`（hover `#9B9590`），圓角
**深色**：軌道透明，滑塊 `#5A5651`（hover `#7A7570`），圓角
寬度 6px。

移除各檔案散落的 `scrollbar-width: thin` 宣告，改由全域規則覆蓋。

### D7: 色彩模式預設 auto

**選擇**：修改 `shared.js` IIFE 的 else 分支。當 localStorage 無 `color-mode` key 時，使用 `window.matchMedia('(prefers-color-scheme: dark)').matches` 判斷，而非讀取舊的 `dark` key。

**理由**：舊邏輯會讀已棄用的 `dark` boolean key，新使用者首次載入時應依系統偏好自動套用。

### D8: edit/setting 底色

**選擇**：在 `edit.css` 和 `setting.css` 的容器（`.edit-page`、`.setting-page`）加 `background: var(--card-bg)`。

**理由**：sidebar 已使用 `var(--card-bg)`（亮色 `#EDE8E3`，深色 `#292624`），內容區也應一致。目前使用預設 `var(--white)` 在亮色模式會是白色，與 sidebar 的 `#EDE8E3` 不搭。

## Risks / Trade-offs

- [捲軸全域樣式覆蓋] → 可能影響未預期的元素；透過 `*` 選擇器或 `html` 層級限定，測試各頁面確認
- [移除 sticky-nav 漢堡] → sidebar collapsed 時桌機少一個入口；但 sidebar toggle 仍在，影響不大
- [hw-grid padding-top] → 可能微幅影響天氣區塊上方間距；值僅 2px，視覺影響極小
