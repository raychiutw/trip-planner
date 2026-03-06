## ADDED Requirements

### Requirement: meta.countries 欄位

每個行程 JSON 的 `meta` 物件 SHALL 包含 `countries` 欄位，值為 ISO 3166-1 alpha-2 國碼字串陣列（如 `["KR"]`、`["JP"]`、`["TW"]`、`["KR", "JP"]`）。此欄位 SHALL 為必填，不得為空陣列。

#### Scenario: 單一國家行程
- **WHEN** 行程目的地為釜山
- **THEN** `meta.countries` SHALL 為 `["KR"]`

#### Scenario: 多國行程
- **WHEN** 行程橫跨韓國與日本
- **THEN** `meta.countries` SHALL 包含 `["KR", "JP"]`

#### Scenario: tp-create 自動填入
- **WHEN** 使用 tp-create 建立新行程
- **THEN** Phase 1 SHALL 根據行程目的地自動判斷國碼填入 `meta.countries`

### Requirement: location.naverQuery 欄位

行程 JSON 中的 location 物件 SHALL 支援 `naverQuery` 選填欄位，值為 Naver Map URL 字串。

#### Scenario: 精確 place URL
- **WHEN** 查得到 Naver place ID
- **THEN** `naverQuery` SHALL 使用 `https://map.naver.com/v5/entry/place/{placeId}` 格式

#### Scenario: 搜尋式 URL fallback
- **WHEN** 查不到 Naver place ID
- **THEN** `naverQuery` SHALL 使用 `https://map.naver.com/v5/search/{韓文關鍵字}` 格式

#### Scenario: naverQuery URL 驗證
- **WHEN** `naverQuery` 欄位存在
- **THEN** 值 SHALL 以 `https://map.naver.com/` 開頭

### Requirement: Naver Map 按鈕渲染

`renderMapLinks` SHALL 在 location 物件含有 `naverQuery` 欄位時渲染 Naver Map 按鈕。

#### Scenario: 有 naverQuery 時顯示 Naver Map 按鈕
- **WHEN** location 物件含有 `naverQuery` 且值為合法 URL
- **THEN** SHALL 渲染一個連結至該 URL 的 Naver Map 按鈕，class 含 `naver`，以 `<span class="n-icon">N</span>` 為 icon

#### Scenario: 無 naverQuery 時不顯示
- **WHEN** location 物件不含 `naverQuery`
- **THEN** SHALL 不渲染 Naver Map 按鈕

#### Scenario: naverQuery 為不安全 URL 時 fallback
- **WHEN** `naverQuery` 值不以 `https://` 開頭
- **THEN** SHALL 不渲染 Naver Map 按鈕（與 mapcode 相同，有就顯示、不安全就略過）

### Requirement: Naver Map 按鈕樣式

Naver Map 按鈕 SHALL 與 Google Map / Apple Map 按鈕視覺一致，僅 icon 與品牌色不同。

#### Scenario: N icon 綠色底色
- **WHEN** 渲染 Naver Map 按鈕
- **THEN** `.n-icon` SHALL 使用 Naver 品牌色 `#03C75A` 為背景色，白色文字，圓角樣式與 `.g-icon` 一致

#### Scenario: 按鈕文字
- **WHEN** 渲染 Naver Map 按鈕
- **THEN** 按鈕文字 SHALL 為 `N Map`（與 `G Map`、Apple `Map` 風格一致）

### Requirement: mapcode 渲染維持有值就顯示

`renderMapLinks` 對 mapcode 的渲染邏輯 SHALL 維持現行行為：有 `loc.mapcode` 就顯示，不檢查 countries 或 selfDrive。

#### Scenario: 有 mapcode 就顯示
- **WHEN** location 物件含有 `mapcode` 欄位
- **THEN** SHALL 渲染 mapcode 顯示區塊（現行行為不變）

### Requirement: template.json 同步更新

`data/examples/template.json` SHALL 同步新增 `meta.countries` 和 `location.naverQuery` 欄位範例。

#### Scenario: template 含 countries
- **WHEN** 讀取 `data/examples/template.json`
- **THEN** `meta` 物件 SHALL 含有 `countries` 欄位示例

#### Scenario: template 含 naverQuery
- **WHEN** 讀取 `data/examples/template.json` 的 location 物件
- **THEN** SHALL 含有 `naverQuery` 欄位示例（空字串或示範值）

### Requirement: 既有行程 JSON 補齊 countries

所有 `data/trips/*.json` SHALL 補上 `meta.countries` 欄位。韓國行程 SHALL 同時補上所有 POI 的 `naverQuery`。

#### Scenario: 沖繩行程
- **WHEN** 讀取沖繩行程 JSON
- **THEN** `meta.countries` SHALL 為 `["JP"]`

#### Scenario: 釜山行程
- **WHEN** 讀取釜山行程 JSON
- **THEN** `meta.countries` SHALL 為 `["KR"]`，且所有 POI 的 location SHALL 含有 `naverQuery`

#### Scenario: 京都行程
- **WHEN** 讀取京都行程 JSON
- **THEN** `meta.countries` SHALL 為 `["JP"]`

#### Scenario: 板橋行程
- **WHEN** 讀取板橋行程 JSON
- **THEN** `meta.countries` SHALL 為 `["TW"]`
