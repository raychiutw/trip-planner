## ADDED Requirements

### Requirement: 頁面組件化
每個頁面 SHALL 有獨立的 React 頁面組件（TripPage、SettingPage、ManagePage、AdminPage），透過各自的入口 TSX mount。

#### Scenario: TripPage 載入行程
- **WHEN** 使用者開啟首頁
- **THEN** 顯示行程內容（天導航、時間軸、餐廳、地圖連結等），功能等同現有 app.js

#### Scenario: SettingPage 選擇行程
- **WHEN** 使用者開啟設定頁
- **THEN** 顯示上架行程清單和色彩模式選擇，功能等同現有 setting.js

#### Scenario: ManagePage 送出請求
- **WHEN** 使用者開啟 manage 頁
- **THEN** 顯示請求紀錄和送出表單，功能等同現有 manage.js

#### Scenario: AdminPage 管理權限
- **WHEN** 管理者開啟 admin 頁
- **THEN** 顯示行程選擇、成員清單、新增表單，功能等同現有 admin.js

### Requirement: app.js 拆解為獨立組件
`app.js`（1,789 行）SHALL 拆解為獨立 React 組件：Timeline、DayCard、DayNav、Restaurant、Shop、InfoBox、Hotel、MapLinks、HourlyWeather、InfoPanel、SpeedDial、Footer、Countdown、DrivingStats。

#### Scenario: 組件獨立可測試
- **WHEN** 渲染任一組件並傳入 props
- **THEN** 正確渲染對應 HTML，無副作用

### Requirement: 共用模組 TypeScript 化
`shared.js`、`icons.js`、`map-row.js` SHALL 轉為 TypeScript 模組，匯出型別安全的函式。

#### Scenario: mapRow 型別安全
- **WHEN** 呼叫 `mapRow(dbRow)` 傳入 D1 row
- **THEN** 回傳型別正確的前端物件（camelCase 欄位名）

### Requirement: CSS 保持不變
現有 CSS 檔案 SHALL 保持不變，React 組件透過 `className` 字串引用現有 class name。

#### Scenario: 組件使用現有 CSS class
- **WHEN** 渲染 Timeline 組件
- **THEN** 產出的 HTML class name 與現有 CSS 完全一致
