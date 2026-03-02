## Why

設定頁有三個 UI/UX 問題：(1) 桌機版頂部顯示一條無用的 sticky-nav 色帶，因 CSS selector 匹配錯誤未被隱藏；(2) 行程卡片選中時外框粗細不一（左邊 5px vs 其他 2px），因 border-left 與 box-shadow 疊加；(3) 選完行程後留在設定頁，使用者需手動切換到行程頁。

## What Changes

- 修正 sticky-nav 在 setting 頁的隱藏邏輯，移除頂部色帶
- 統一行程卡片選中狀態的外框粗細（移除 border-left，改用均勻 box-shadow 或 border）
- 選擇行程後自動導向 `index.html` 載入該行程

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `setting-page`: 修正 sticky-nav 隱藏邏輯、統一選中框線粗細、選擇行程後跳轉

## Impact

- 影響檔案：`css/setting.css`、`js/setting.js`
- 不涉及 HTML 結構變更
- 不涉及 JSON 結構變更
