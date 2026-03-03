## Approach

本次變更分兩個獨立修正，均為最小範圍的點狀補丁，不涉及架構異動。

### Item 9：收合 sidebar 尺寸與 toggle outline 修正

**問題根因**

`--sidebar-w-collapsed: 56px` 是在假設無捲動條或捲動條不佔寬度的前提下設計的。Chromium 系瀏覽器預設捲動條寬度約 6px（專案自訂），icon 本身 24px，加上 `padding: 8px` × 2 後需 40px，空間本已緊繃；出現捲動條時 icon 即遭裁切。

**解法**：將 `--sidebar-w-collapsed` 增至 `64px`（+8px），捲動條顯示時 icon 仍有完整顯示空間。

`.sidebar-header` 在收合狀態的 `padding: 8px` 是對稱設定，但在 64px 寬度下 toggle 按鈕（32px）左右各剩 16px，視覺上偏左。調整為 `padding: 8px 4px` 使左右空間更對稱（(64 - 32) / 2 = 16px，padding 4px + icon center = 視覺置中）。

**sidebar-toggle outline 清除**

`.sidebar-toggle` 在 `css/shared.css` 的 `button:focus-visible { outline: none; }` 全域規則已覆蓋標準 focus outline，且 `.sidebar-toggle:focus-visible` 明確指定 `box-shadow: 0 0 0 2px var(--blue)` 作為替代。出現橘/深色 outline 代表有其他來源的 `outline` 或 `border` 規則未被覆蓋（可能來自瀏覽器 UA stylesheet 或 `.sidebar-toggle:focus`）。

**解法**：在 `css/menu.css` 的 `.sidebar-toggle` 規則中補加 `outline: none;`，並確認無 `:focus`（非 `:focus-visible`）的 outline/border 規則存在。

### Item 16：`isDesktop()` 改用視窗寬度

**問題根因**

`navigator.userAgent` 反映的是「裝置類型」，不反映「目前視窗寬度」。桌機瀏覽器縮小視窗至手機寬度時：

1. CSS 媒體查詢 `@media (max-width: 767px)` 生效 → sidebar `display: none`
2. `isDesktop()` 仍回傳 `true` → `toggleSidebar()` 走 sidebar 分支
3. sidebar 已被 CSS 隱藏，toggle 操作無任何視覺效果
4. 漢堡選單點擊完全無反應

**解法**

```js
// 舊
function isDesktop() { return !/Mobi|Android.*Mobile|iPhone|iPod|Opera Mini/i.test(navigator.userAgent); }

// 新
function isDesktop() { return window.innerWidth >= 768; }
```

`window.innerWidth >= 768` 與 CSS `@media (min-width: 768px)` breakpoint 對齊，確保 JS 行為與 CSS 視覺狀態永遠一致。

**呼叫端影響分析**

| 呼叫點 | 舊行為 | 新行為 |
|--------|--------|--------|
| `toggleSidebar()` | UA 判斷，桌機縮窗時走錯分支 | 寬度判斷，正確路由 |
| `closeMobileMenuIfOpen()` | UA 判斷，桌機縮窗時不關 drawer | 寬度判斷，正確關閉 |
| swipe gesture `touchend` | UA 判斷，桌機縮窗仍觸發 swipe | 寬度判斷，<768px 才處理 |
| resize handler | UA 判斷，桌機縮窗仍觸發關 drawer | 寬度判斷，≥768px 才關閉 |

所有呼叫點均直接受益，無需個別修改——函式簽名不變，只替換判斷邏輯。

## Files Changed

| 檔案 | 變更說明 |
|------|---------|
| `css/shared.css` | `--sidebar-w-collapsed` 從 `56px` 改為 `64px` |
| `css/menu.css` | `.sidebar-toggle` 補 `outline: none;`；`.sidebar.collapsed .sidebar-header` padding 從 `8px` 改為 `8px 4px` |
| `js/menu.js` | `isDesktop()` 實作從 UA 判斷改為 `window.innerWidth >= 768` |
