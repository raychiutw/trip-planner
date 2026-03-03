## MODIFIED Requirements

### Requirement: 三頁統一導航連結顯示名稱

參考 `openspec/specs/unified-menu/spec.md`（三頁統一選單結構、區段一導航連結定義）。

選單（drawer `#menuGrid`）與側邊欄（`#sidebarNav`）中，三頁導航連結的顯示文字 SHALL 更新為以下新名稱：

| 項目 | Icon | 連結 | 舊文字 | 新文字 |
|------|------|------|--------|--------|
| 我的行程 | `plane` | `index.html` | 行程頁 | 我的行程 |
| 編輯行程 | `pencil` | `edit.html?trip={slug}` | 編輯頁 | 編輯行程 |
| 設定 | `gear` | `setting.html` | 設定頁 | 設定 |

側邊欄連結的 `title` 屬性 SHALL 與可見文字保持一致（同步更新為新名稱）。

#### Scenario: index 頁選單顯示新名稱

- **GIVEN** 使用者在 `index.html`（行程主頁）
- **WHEN** 使用者開啟 drawer 選單或桌機側邊欄
- **THEN** 導航區段 SHALL 顯示「我的行程」、「編輯行程」、「設定」三個連結，不再顯示「行程頁」、「編輯頁」、「設定頁」

#### Scenario: edit 頁選單顯示新名稱

- **GIVEN** 使用者在 `edit.html`（編輯行程頁）
- **WHEN** 使用者開啟 drawer 選單或桌機側邊欄
- **THEN** 導航區段 SHALL 顯示「我的行程」、「編輯行程」、「設定」三個連結，不再顯示「行程頁」、「編輯頁」、「設定頁」

#### Scenario: setting 頁選單顯示新名稱

- **GIVEN** 使用者在 `setting.html`（設定頁）
- **WHEN** 使用者開啟 drawer 選單或桌機側邊欄
- **THEN** 導航區段 SHALL 顯示「我的行程」、「編輯行程」、「設定」三個連結，不再顯示「行程頁」、「編輯頁」、「設定頁」

#### Scenario: 側邊欄 title 屬性與可見文字一致

- **WHEN** 桌機側邊欄渲染導航連結
- **THEN** 每個連結的 `title` 屬性 SHALL 與其可見文字相同（「我的行程」、「編輯行程」、「設定」）

---

### Requirement: edit.html 頁面標題反映編輯行程定位

參考 `openspec/specs/edit-page/spec.md`（edit.html 頁面整體定位）。

`edit.html` 的 `<title>` 標籤 SHALL 為「編輯行程 — Trip Planner」，移除「AI 修改行程」字樣，與新導航連結名稱「編輯行程」對齊。

#### Scenario: edit.html 初始 title 標籤

- **WHEN** 瀏覽器請求 `edit.html`（JS 尚未執行）
- **THEN** 瀏覽器標籤頁標題 SHALL 顯示「編輯行程 — Trip Planner」

---

## ADDED Requirements

### Requirement: index.html meta 標籤通用化

`index.html` 的靜態 meta 標籤 SHALL 不包含任何特定行程地名（如「沖繩」），使站台 HTML 可通用於任意行程資料。

| 屬性 | 新值 |
|------|------|
| `meta[name=description]` | `旅遊行程規劃：每日景點、餐廳推薦、地圖導航、天氣預報、預算規劃，一頁搞定。` |
| `meta[property=og:title]` | `Trip Planner` |
| `meta[property=og:description]` | `旅遊行程規劃：每日景點、餐廳推薦、地圖導航、天氣預報、預算規劃，一頁搞定。` |
| `<title>` | `Trip Planner` |

JS 動態覆蓋行為不變：`app.js` 載入行程資料後仍以 `data.meta.title`、`data.meta.description`、`data.meta.ogDescription` 分別覆蓋 `document.title` 及對應 meta 標籤。

#### Scenario: 靜態 HTML 不含地名

- **WHEN** 直接讀取 `index.html` 原始碼（未執行 JS）
- **THEN** 所有 meta 標籤與 `<title>` 標籤 SHALL 不含「沖繩」或其他特定行程地名

#### Scenario: JS 載入後動態覆蓋仍正常

- **WHEN** `app.js` 完成行程資料載入
- **THEN** `document.title` SHALL 反映當前行程的 `data.meta.title`（來自 JSON），與靜態 `<title>` 無關
