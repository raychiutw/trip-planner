## ADDED Requirements

### Requirement: 自動產生 trips.json registry
build 流程 SHALL 從各行程的 `data/dist/*/meta.json` 自動彙整產生 `data/dist/trips.json`，取代手動維護的 `data/trips.json`。

#### Scenario: registry 格式
- **WHEN** build 完成
- **THEN** `data/dist/trips.json` SHALL 為 JSON 陣列，每個元素包含 `slug`、`name`、`dates`、`owner`

#### Scenario: registry 資料來源
- **WHEN** build 掃描 `data/dist/*/meta.json`
- **THEN** `slug` SHALL 從目錄名取得
- **THEN** `name` SHALL 從 `meta.json` 的 `meta.name` 取得
- **THEN** `owner` SHALL 從 `meta.json` 的 `meta.owner` 取得
- **THEN** `dates` SHALL 從 `meta.json` 的 `footer.dates` 取得

### Requirement: 前端讀取 dist registry
`setting.js` 和 `edit.js` SHALL 從 `data/dist/trips.json` 讀取行程清單。

#### Scenario: setting.js 載入行程清單
- **WHEN** setting.html 頁面載入
- **THEN** SHALL fetch `data/dist/trips.json`
- **THEN** SHALL 用 `slug` 欄位直接設定 trip-pref（不再從 file 路徑轉換）
