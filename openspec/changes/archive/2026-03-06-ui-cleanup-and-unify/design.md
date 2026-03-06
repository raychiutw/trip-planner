## Architecture

整體策略：移除三層導航系統（sidebar + drawer + hamburger），統一為最簡結構。

```
改前：
  index.html   ── Speed Dial + nav pills + nav-actions
  edit.html    ── sidebar + drawer + hamburger + nav-title
  setting.html ── sidebar + drawer + hamburger + nav-title

改後：
  index.html   ── Speed Dial + nav pills + nav-actions（不變）
  edit.html    ── nav-title + X close（→ index.html）
  setting.html ── nav-title + X close（→ index.html）
```

## Key Decisions

### 1. X 關閉鈕設計

```
┌─ sticky-nav ─────────────────────────────────┐
│  標題文字 (--fs-lg, 700)               [X]   │
└───────────────────────────────────────────────┘
```

- X 按鈕使用既有 close icon SVG（Material Symbols `close`）
- 點擊行為：`window.location.href = 'index.html'`（非 history.back，避免外部來源誤導）
- 樣式：`.nav-close-btn`，與 `.nav-action-btn` 共用基底（圓角、hover 效果）
- edit 頁帶 `?trip=` 參數回 index：`index.html?trip=<slug>`

### 2. 三頁 header 統一

共用基底在 `shared.css`：
- `.sticky-nav`：position sticky, flex, align-items center, gap, padding, z-index
- `.nav-title`：font-size `--fs-lg`, font-weight 700, flex-grow 1, overflow ellipsis
- `.nav-close-btn`：flex-shrink 0, 圓角按鈕

頁面專屬：
- index: `.nav-brand` + `.dh-nav` pills + `.nav-actions`（已在 style.css）
- edit/setting: `.nav-title` + `.nav-close-btn`

### 3. 概況區底色

新增 CSS 變數：
```css
:root {
    --accent-lighter: #F9F3EF;
}
body.dark {
    --accent-lighter: #252220;
}
```

只改一處：`.day-overview { background: var(--accent-lighter); }`

色階：`--bg (#FAF9F5)` → `--accent-lighter (#F9F3EF)` → `--accent-light (#F5EDE8)` → `--accent (#C4704F)`

### 4. switchDay hash 更新

在 `switchDay()` 末尾加：
```js
history.replaceState(null, '', '#day' + dayId);
```

### 5. menu.js / menu.css 刪除策略

- 刪除 `js/menu.js` 整個檔案
- 刪除 `css/menu.css` 整個檔案
- 三頁 HTML 移除對應 `<script>` 和 `<link>` 標籤
- `shared.css` 已有 `.sticky-nav` 基底樣式，`style.css` 已有 index 專用 sticky-nav 樣式
- `menu.css` 中僅 `.sticky-nav .dh-menu { display: none }` 桌機規則需遷移至 shared.css（但移除 hamburger 後不需要了）
- app.js 的 `buildMenu()` 函式刪除，`renderTrip` 中的呼叫移除
- app.js 中所有 `closeMobileMenuIfOpen()` 呼叫移除
- edit.js / setting.js 中 `buildPageNav` 呼叫與 `menuGrid`/`sidebarNav` 操作移除
- `tests/setup.js` 不需調整（已在前次清理中移除相關 requiredIds）

### 6. highlights 移除

- 刪除 `renderHighlights()` 函式及其 CSS（`.highlight-tag` 等）
- 刪除 `renderTrip` 中 `sec-highlights` 的渲染
- 刪除 `renderInfoPanel` 中 highlights tags 區塊
- 刪除 `validateTripData` 中 `highlights` 必填檢查
- 從所有 `data/trips/*.json` 移除 `highlights` 欄位
- 更新 `data/examples/template.json`
- 移除 JSON schema tests 中 highlights 相關驗證

### 7. suggestions 僅保留 Speed Dial

- 刪除 `renderTrip` 中 `sec-suggestions` 的主頁面渲染
- 刪除 `renderSuggestionSummaryCard()` 函式
- 刪除 `renderInfoPanel` 中 suggestion summary 呼叫
- 保留 `renderSuggestions()` 函式（Speed Dial DIAL_RENDERERS 使用）
- 保留 `suggestions` 在 JSON 中（Speed Dial 內容來源）
- `validateTripData` 保留 suggestions 必填檢查

## File Changes

| 檔案 | 操作 |
|------|------|
| js/menu.js | 刪除 |
| css/menu.css | 刪除 |
| index.html | 移除 menu.js/menu.css 引用 |
| edit.html | 移除 sidebar/drawer/hamburger，加 X 鈕，移除 menu.js/menu.css 引用 |
| setting.html | 同 edit.html |
| css/shared.css | 新增 --accent-lighter、.nav-title、.nav-close-btn 樣式 |
| css/style.css | .day-overview 改用 --accent-lighter、移除 highlights/suggestions section CSS |
| css/edit.css | 移除 .dh-menu 相關、更新 .nav-title |
| css/setting.css | 同 edit.css |
| js/app.js | 移除 buildMenu、renderHighlights、renderSuggestionSummaryCard、closeMobileMenuIfOpen 呼叫、switchDay 加 hash |
| js/edit.js | 移除 buildPageNav/menuGrid/sidebarNav 操作 |
| js/setting.js | 同 edit.js |
| data/trips/*.json | 移除 highlights 欄位 |
| data/examples/template.json | 同步更新 |
| tests/ | 移除 highlights 相關測試、更新 E2E edit-page 測試 |
