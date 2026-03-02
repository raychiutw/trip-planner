## Context

設定頁（setting.html）有三個 bug/UX 問題：
1. sticky-nav 色帶在桌機版未被隱藏（CSS selector `.setting-page .sticky-nav` 匹配不到，因 DOM 中兩者不是祖孫關係）
2. 行程卡片選中框線粗細不一（border-left: 3px + box-shadow: 2px 疊加，左邊 5px vs 其他 2px）
3. 選完行程停留在設定頁，需手動切換

## Goals / Non-Goals

**Goals:**
- 移除設定頁頂部的空色帶（sticky-nav）
- 行程卡片選中狀態外框四邊等粗
- 選擇行程後自動跳轉至 index.html

**Non-Goals:**
- 不重新設計設定頁 layout
- 不調整外觀（色彩模式）區塊
- 不修改 index.html 行程載入邏輯

## Decisions

### 1. sticky-nav 隱藏方式
在 setting.css 中直接隱藏 `.sticky-nav`（不限 media query），因為設定頁在手機和桌機都不需要 day pills 導航。手機版漢堡選單由 drawer 提供，不依賴 sticky-nav 內的按鈕。

修正後 CSS：`.sticky-nav { display: none; }` 置於 setting.css 頂部或 setting-page 區塊內。

### 2. 選中框線統一
移除 `.trip-btn` 的 `border-left: 3px solid transparent`，active 狀態改用統一的 `box-shadow: 0 0 0 2px var(--accent)` 四邊等粗。非 active 狀態無 border-left 偏移。

### 3. 選擇行程跳轉
在 `renderTripList()` 的 click handler 中，`lsSet` 後加 `window.location.href = 'index.html'`。不需 timeout 或動畫延遲，直接跳轉。

## Risks / Trade-offs

- sticky-nav 隱藏可能影響手機版漢堡選單入口 → 無影響，手機版有獨立的 `.dh-menu` 按鈕在 sticky-nav 內，但 setting 頁的漢堡選單由 drawer 機制觸發（menu.js 監聽 body click），不依賴 sticky-nav 內的按鈕
- 跳轉後使用者想改色彩模式需再回設定頁 → 可接受，行程切換是主要操作，色彩模式設定較少變動
