## ADDED Requirements

### Requirement: app.js 從 API 載入行程
`app.js` SHALL 將所有 `fetch('data/dist/...')` 呼叫改為 `fetch('/api/trips/...')`。

#### Scenario: 載入行程 meta
- **WHEN** app.js 初始化
- **THEN** fetch('/api/trips') 取得行程列表，fetch('/api/trips/:id') 取得 meta

#### Scenario: 載入某天行程
- **WHEN** 使用者點擊 Day N pill
- **THEN** fetch('/api/trips/:id/days/:num') 取得完整一天 JSON

#### Scenario: 載入航班等附屬資訊
- **WHEN** 使用者開啟 Speed Dial 的航班/checklist 等
- **THEN** fetch('/api/trips/:id/docs/:type') 取得內容

### Requirement: setting.js 從 API 載入行程清單
`setting.js` SHALL 從 `/api/trips` 取得行程列表取代 `data/dist/trips.json`。

#### Scenario: 設定頁行程列表
- **WHEN** 開啟 setting.html
- **THEN** fetch('/api/trips') 取得行程清單渲染行程按鈕

### Requirement: API JSON 結構對齊 dist JSON
API 回傳的 JSON 結構 SHALL 與現有 dist JSON 語義對齊，最小化 render 函式的改動。

#### Scenario: day JSON 結構
- **WHEN** GET /api/trips/:id/days/:num
- **THEN** 回傳包含 id、date、dayOfWeek、label、weather、hotel、timeline 的 JSON，render 函式可直接使用

### Requirement: CSP 更新
`index.html` 的 Content-Security-Policy SHALL 允許 connect-src 連接自身 API（'self' 已涵蓋）。

#### Scenario: API 請求不被 CSP 阻擋
- **WHEN** app.js fetch('/api/trips/...')
- **THEN** CSP connect-src 'self' 允許通過
