## Why

Edit 頁的 issue 列表目前僅以左邊框顏色（綠/灰）區分 open/closed 狀態，辨識度低。Closed issue 以 `opacity: 0.55` 呈現，整體偏暗難讀。此外，issue 被處理後（close）會留一則回覆 comment 說明處理結果，但目前無法在列表中直接看到，需點進 GitHub 才能確認。桌機版 issue 標題字級過小（`--fs-sm`），在寬螢幕上閱讀體驗不佳。

## What Changes

### Issue 狀態 Badge
- 在 `.issue-item-header` 中 title 前方加入 GitHub-style pill badge
- Open：綠色底（`#238636`）+ circle-dot 圖示 + 白字
- Closed：紫色底（`#8957e5`）+ check-circle 圖示 + 白字
- 移除原有的左邊框狀態指示（`border-left-color`）
- 移除 closed 的 `opacity: 0.55`

### Close Reply 非同步載入
- 對 closed + `comments > 0` 的 issue，非同步 fetch 最後一則 comment
- 載入中顯示「讀取回覆中…」（`--text-muted` 灰字）
- 載入完成後以 `textContent` 直接顯示回覆內容（不解析 markdown）
- fetch 失敗顯示「無法載入回覆」
- 回覆文字樣式：`--fs-sm`、`--text-muted`

### 桌機版 Title 放大
- 桌機版（≥768px）`.issue-item-title` 字級從 `--fs-sm` 改為 `--fs-md`

## Capabilities

### New Capabilities
- `issue-status-badge`: Issue 列表的 Open/Closed pill badge 視覺指示
- `issue-close-reply`: Closed issue 非同步載入並顯示最後一則回覆 comment

### Modified Capabilities
（無既有 spec 需修改）

## Impact

### 檔案影響範圍
- **CSS**: `css/edit.css`（新增 badge pill 樣式、回覆區樣式、移除左邊框/opacity、桌機版 title 字級）
- **JS**: `js/edit.js`（`buildIssueItemHtml` 加 badge HTML + reply placeholder、新增 comment fetch 邏輯、DOM patch）
- **HTML**: 無變更
- **JSON**: 無結構變更
- **測試**: 新增 badge 渲染測試、comment fetch 非同步測試
