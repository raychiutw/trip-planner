## 1. CSS 優先度樣式

- [x] 1.1 `style.css`：新增 `.sg-priority-high` 亮色背景 `rgba(239, 68, 68, 0.08)`
- [x] 1.2 `style.css`：新增 `.sg-priority-medium` 亮色背景 `rgba(234, 179, 8, 0.08)`
- [x] 1.3 `style.css`：新增 `.sg-priority-high`、`.sg-priority-medium` 深色模式背景（opacity 0.12）
- [x] 1.4 `style.css`：新增 `.sg-priority-high::before`、`.sg-priority-medium::before`、`.sg-priority-low::before` 圓點樣式（8px、對應顏色）

## 2. JS 渲染邏輯

- [x] 2.1 `app.js`：`renderSuggestions()` 為每張卡片加上 `.sg-priority-{level}` class
- [x] 2.2 `app.js`：`renderInfoPanel()` 新增建議摘要卡片，顯示各等級項目數量與對應圓點
- [x] 2.3 更新 `renderSuggestions()` 相關單元測試（驗證 class 有加上）
- [x] 2.4 更新 `renderInfoPanel()` 相關單元測試（驗證建議摘要卡片渲染）

## 3. 驗證

- [x] 3.1 執行全部測試確認通過
