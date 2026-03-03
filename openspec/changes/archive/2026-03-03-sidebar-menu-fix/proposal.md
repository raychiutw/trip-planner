## Why

收合狀態 sidebar 寬度 56px 過窄，icon 在捲動條顯示時遭裁切；`.sidebar-toggle` 在 focus 時出現橘/深色 outline，與全站 focus-visible box-shadow 規範不一致；`isDesktop()` 使用 `navigator.userAgent` 判斷，導致桌機瀏覽器縮小至手機寬度時仍回傳 `true`，使漢堡選單點擊觸發 sidebar 收合邏輯而非 mobile drawer 開關——sidebar 在 <768px 已被 CSS 隱藏（`display: none`），點擊無任何反應，漢堡選單功能完全失效。

## What Changes

- **sidebar 收合寬度**：`css/shared.css` 中 `--sidebar-w-collapsed` 從 `56px` 增加至 `64px`，為 icon + 捲動條保留足夠空間
- **sidebar-header padding（收合時）**：`css/menu.css` 中 `.sidebar.collapsed .sidebar-header { padding: 8px; }` 調整為 `padding: 8px 4px`，在新寬度下維持 toggle 按鈕視覺置中
- **sidebar-toggle focus outline 移除**：`css/shared.css` 中 `.sidebar-toggle:focus-visible` 的 `box-shadow` 規則保留，但移除所有狀態（`:focus`、`:focus-within`、`-webkit-` prefix）下殘留的 `outline` 或 `border`；`css/menu.css` 中 `.sidebar-toggle` 確認無 `outline`/`border` 殘留
- **`isDesktop()` 改為視窗寬度判斷**：`js/menu.js` 中 `isDesktop()` 改為 `return window.innerWidth >= 768`，與 CSS 媒體查詢 breakpoint 一致；所有呼叫端（`toggleSidebar`、`closeMobileMenuIfOpen`、swipe gesture handler、resize handler）行為隨之修正，無需個別修改

## Scope

**包含：**
- `css/shared.css`：`--sidebar-w-collapsed` 值調整、`.sidebar-toggle` focus 狀態 outline 清除
- `css/menu.css`：`.sidebar.collapsed .sidebar-header` padding 微調、`.sidebar-toggle` 所有狀態無殘留 outline/border 確認
- `js/menu.js`：`isDesktop()` 函式實作替換

**不包含：**
- sidebar 展開寬度（`--sidebar-w: 260px`）不變
- sidebar 動畫、顏色、背景不變
- menu drawer（`.menu-drawer`）邏輯不變
- HTML 結構不變
- 測試檔（測試為純 CSS/JS 行為，不需新增 test case；現有 test suite 通過即可）
- 任何 JSON 資料變更
