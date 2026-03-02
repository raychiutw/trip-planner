## Why

行程建議（suggestions）已有 `priority`（high/medium/low）欄位，但渲染時完全忽略優先度，所有建議卡片外觀相同，使用者無法快速辨識重要項目。需要用視覺差異化呈現優先等級，並在資訊面板提供各等級數量摘要。

## What Changes

- **建議卡片背景色**：high → 淡紅底色、medium → 淡黃底色、low → 無底色（保持原樣）
- **優先度圓點**：每張卡片標題前加上對應顏色的小圓點（high=紅、medium=黃、low=橘）
- **資訊面板統計**：在 info panel 新增建議摘要卡片，顯示 high/medium/low 各有幾個項目，附帶對應色彩圓點

## Capabilities

### New Capabilities

- `suggestion-visual-priority`：建議卡片依優先等級顯示不同底色與圓點標示

### Modified Capabilities

（無現有 spec 需修改）

## Impact

- **JS**：`js/app.js`（`renderSuggestions()` 加入優先度樣式、`renderInfoPanel()` 加入統計卡片）
- **CSS**：`css/style.css`（新增優先度底色 class 與圓點樣式，深色/亮色兩套）
- **HTML**：無變更
- **JSON**：無結構變更（既有 `priority` 欄位已存在）
