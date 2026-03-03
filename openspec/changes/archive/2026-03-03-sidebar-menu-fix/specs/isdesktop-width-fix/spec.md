# Spec: isdesktop-width-fix

將 `isDesktop()` 從 UA 字串偵測改為視窗寬度判斷，修復桌機縮窗後漢堡選單失效問題。

## 問題描述

**復現步驟：**
1. 在桌機瀏覽器開啟頁面（視窗寬度 ≥768px）
2. 將瀏覽器視窗縮小至 <768px（模擬手機寬度）
3. 點擊 sticky nav 漢堡按鈕（`.dh-menu`）

**預期**：行動選單 drawer（`.menu-drawer`）開啟
**實際**：無任何反應

**根因**：`isDesktop()` 回傳 `true`（UA 為桌機），`toggleSidebar()` 走 sidebar 分支，但 sidebar 在 CSS 已被 `display: none` 隱藏，操作無效果。

## 函式規格

```js
// js/menu.js

// 修正前
function isDesktop() {
    return !/Mobi|Android.*Mobile|iPhone|iPod|Opera Mini/i.test(navigator.userAgent);
}

// 修正後
function isDesktop() {
    return window.innerWidth >= 768;
}
```

## Breakpoint 對齊

| 來源 | Breakpoint |
|------|-----------|
| `css/menu.css` sidebar 顯示 | `@media (min-width: 768px)` |
| `js/menu.js` `isDesktop()` | `window.innerWidth >= 768` |

兩者對齊後，sidebar 可見（CSS 顯示）等價於 `isDesktop()` 回傳 `true`，邏輯一致。

## 呼叫端行為（修正後）

### `toggleSidebar()`

```js
function toggleSidebar() {
    if (!isDesktop()) { toggleMenu(); return; }  // 寬度 <768px → 開 mobile drawer
    // 寬度 ≥768px → toggle sidebar collapsed 狀態
}
```

- 桌機寬視窗：toggle sidebar（正確）
- 桌機縮窗 / 手機：觸發 `toggleMenu()` 開啟 mobile drawer（修正後正確）

### `closeMobileMenuIfOpen()`

- `window.innerWidth >= 768` 時直接 return，不處理（正確）
- `window.innerWidth < 768` 時關閉已開啟的 mobile drawer（正確）

### swipe gesture `touchend` handler

- `window.innerWidth >= 768` 時直接 return，不處理滑動（正確）
- `window.innerWidth < 768` 時判斷滑動方向開/關 mobile drawer（正確）

### resize handler

```js
window.addEventListener('resize', function() {
    if (isDesktop()) {  // 視窗擴大回 ≥768px
        // 關閉任何已開啟的 mobile drawer
    }
});
```

- 縮窗後再擴大回桌機寬度時，自動關閉 mobile drawer（正確）

## 邊界條件

- `window.innerWidth` 在 resize 事件中即時更新，無需額外 debounce（現行 resize handler 無 debounce，保持不變）
- 精確在 768px 時：`window.innerWidth >= 768` 回傳 `true`，sidebar 顯示（CSS `@media (min-width: 768px)` 生效），一致
- 767px 時：回傳 `false`，走 mobile drawer 路徑，sidebar 隱藏，一致

## 模組匯出（Node.js / Vitest）

`module.exports` 中 `isDesktop` 指向同一函式，匯出不需變動。現有單元測試若有 mock `navigator.userAgent` 的測試案例，需確認測試環境提供 `window.innerWidth`（jsdom 預設為 1024，`isDesktop()` 修正後仍回傳 `true`，測試結果應一致）。
