## 1. Trip JSON 資料

- [x] 1.1 三個 trip JSON 新增 `highlights` 欄位（title + content.summary + content.tags），摘要 100-200 字
- [x] 1.2 三個 trip JSON 的 `suggestions.title` 改為「AI 行程建議」
- [x] 1.3 `banqiao-trip-2026-Onion.json` 補上 `suggestions` 欄位（含 cards 陣列）

## 2. Icon 註冊

- [x] 2.1 `js/icons.js`：ICONS 物件新增 `sparkle` icon（Material Symbols Rounded 風格 SVG）

## 3. 渲染邏輯

- [x] 3.1 `js/app.js`：新增 `renderHighlights(data)` 函式，渲染摘要段落 + 標籤 pill 列
- [x] 3.2 `js/app.js`：`renderTrip()` 在 Day 迴圈前插入 highlights section（id: `sec-highlights`）
- [x] 3.3 `js/app.js`：`renderTrip()` 在 highlights 之後、Day 迴圈前插入 suggestions section（id: `sec-suggestions`）
- [x] 3.4 `js/app.js`：從 `infoSections` 陣列移除 `{ key: 'suggestions', ... }`

## 4. 導航選單

- [x] 4.1 `js/app.js`：`buildMenu()` drawer 區新增「AI行程亮點」（sparkle, sec-highlights）和「AI 行程建議」（lightbulb, sec-suggestions），排在航班資訊前
- [x] 4.2 `js/app.js`：`buildMenu()` sidebar navItems 陣列同步更新

## 5. 資訊面板

- [x] 5.1 `js/app.js`：`renderInfoPanel()` 新增 highlights 摘要卡片（顯示標籤列表）

## 6. 驗證

- [x] 6.1 `js/app.js`：`validateTripData()` 新增 highlights 必填檢查
- [x] 6.2 `js/app.js`：`validateTripData()` 新增 suggestions 必填檢查

## 7. CSS 樣式

- [x] 7.1 `css/style.css`：新增 `.hl-summary` 段落樣式
- [x] 7.2 `css/style.css`：新增 `.hl-tags` flex wrap 容器 + `.hl-tag` pill 標籤樣式（accent 色系）

## 8. 測試

- [x] 8.1 執行 `npm test` 確認 unit/integration 測試全過
- [x] 8.2 執行 `npm run test:e2e` 確認 E2E 測試全過
