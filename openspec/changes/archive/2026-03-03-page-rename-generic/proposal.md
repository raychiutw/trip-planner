## Why

選單與側邊欄中的頁面名稱（行程頁、編輯頁、設定頁）語意模糊，使用者無法一眼辨識各頁功能定位。「行程頁」不如「我的行程」具體，「編輯頁」未說明編輯什麼，「設定頁」則多餘加了「頁」字。`edit.html` 的 `<title>` 標籤「AI 修改行程」與頁面實際定位（編輯行程）不符。`index.html` 的 meta description、og:title、og:description、`<title>` 標籤硬寫了「沖繩」，使站台無法通用於任何行程；title 標籤在 JS 載入後雖由 `data.meta.title` 覆蓋，但初始 HTML 仍帶有沖繩字樣，影響 SEO 通用性與可維護性。

## What Changes

### Item 4：頁面名稱重新命名

選單（drawer #menuGrid）與側邊欄（#sidebarNav）中三個導航連結的顯示文字與 `title` 屬性一律改為：

| 原文 | 新文 |
|------|------|
| 行程頁 | 我的行程 |
| 編輯頁 | 編輯行程 |
| 設定頁 | 設定 |

涉及函式：`buildMenu()`（`js/app.js`，menu ×2、sidebar ×2）、`buildEditMenu()`（`js/edit.js`，menu ×1、sidebar ×1）、`buildSettingMenu()`（`js/setting.js`，menu ×1、sidebar ×1）。

### Item 5：移除 index.html 硬寫的沖繩文字

| 元素 | 原值 | 新值 |
|------|------|------|
| `meta[name=description]` | 沖繩自由行行程規劃：… | 旅遊行程規劃：每日景點、餐廳推薦、地圖導航、天氣預報、預算規劃，一頁搞定。 |
| `meta[property=og:title]` | 沖繩旅遊行程表 — Trip Planner | Trip Planner |
| `meta[property=og:description]` | 沖繩自由行行程規劃：… | 旅遊行程規劃：每日景點、餐廳推薦、地圖導航、天氣預報、預算規劃，一頁搞定。 |
| `<title>` | 沖繩旅遊行程表 — Trip Planner | Trip Planner |

`edit.html` 的 `<title>` 從「AI 修改行程 — Trip Planner」改為「編輯行程 — Trip Planner」，與新頁面名稱對齊。

## Scope

**包含：**
- `js/app.js`：`buildMenu()` 中 menu 與 sidebar 各 3 個導航連結文字與 `title` 屬性
- `js/edit.js`：`buildEditMenu()` 中 menu 與 sidebar 各 3 個導航連結文字與 `title` 屬性
- `js/setting.js`：`buildSettingMenu()` 中 menu 與 sidebar 各 3 個導航連結文字與 `title` 屬性
- `index.html`：第 7、9、10、13 行的 meta、og、title 標籤
- `edit.html`：第 8 行的 `<title>` 標籤
- `tests/e2e/edit-page.spec.js`：斷言 `設定頁` 文字的測試行需同步更新為 `設定`

**不包含：**
- `data/trips/*.json`：行程 JSON 資料不動
- `data/trips.json`：索引不動
- JS 動態覆蓋邏輯（`app.js` 載入後以 `data.meta.title` 覆蓋 title 的行為不變）
- CSS / HTML 結構
- 單元測試（`render.test.js` 中的「沖繩そば」、「沖繩海景飯店」為測試資料名稱，非硬寫地名，不動）
- E2E 測試中驗證 `沖繩` 出現於標題與 footer 的斷言（來自 JSON 資料，不受此變更影響）
