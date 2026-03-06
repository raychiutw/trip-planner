## ADDED Requirements

### Requirement: POI source 欄位定義

每個 POI 物件 SHALL 包含 `"source"` 欄位，值為 `"user"` 或 `"ai"`。

#### Scenario: source 欄位存在於所有 POI 類型
- **WHEN** 讀取行程 JSON 中任何 POI（restaurant、event、hotel、shop、gasStation）
- **THEN** 該物件 SHALL 包含 `source` 屬性，值為 `"user"` 或 `"ai"`

#### Scenario: hotel 豁免對象不需 source
- **WHEN** hotel 的 name 為「家」或以「（」開頭
- **THEN** 該 hotel 不需要 `source` 欄位

#### Scenario: travel 類 event 不需 source
- **WHEN** timeline event 包含 `travel` 屬性
- **THEN** 該 event 不需要 `source` 欄位

### Requirement: tp-create source 標記

tp-create 產出的所有 POI SHALL 標記 `source: "ai"`。

#### Scenario: tp-create 新行程
- **WHEN** 使用 tp-create 產生新行程
- **THEN** 所有 POI 的 source SHALL 為 `"ai"`

### Requirement: tp-edit source 標記

tp-edit 修改或新增 POI 時 SHALL 依使用者描述判斷 source。

#### Scenario: 使用者明確指定 POI 名稱
- **WHEN** 使用者描述包含具體 POI 名稱（如「午餐換成一蘭拉麵」）
- **THEN** 該 POI 的 source SHALL 為 `"user"`

#### Scenario: 使用者給模糊描述
- **WHEN** 使用者描述未指定具體名稱（如「Day 3 加個午餐」）
- **THEN** AI 選擇的 POI 的 source SHALL 為 `"ai"`

### Requirement: tp-issue source 標記

tp-issue 處理 GitHub Issue 時 SHALL 依 Issue 內容判斷 source，邏輯同 tp-edit。

#### Scenario: Issue 指定具體 POI
- **WHEN** Issue text 包含具體 POI 名稱
- **THEN** 該 POI 的 source SHALL 為 `"user"`

#### Scenario: Issue 描述模糊
- **WHEN** Issue text 未指定具體名稱
- **THEN** AI 選擇的 POI 的 source SHALL 為 `"ai"`

### Requirement: 既有資料遷移

所有既有行程 JSON 中的 POI SHALL 遷移為 `source: "ai"`。

#### Scenario: 既有 POI 預設為 ai
- **WHEN** 對既有行程 JSON 執行遷移
- **THEN** 所有符合條件的 POI SHALL 新增 `source: "ai"`

### Requirement: template.json 更新

`data/examples/template.json` 中的 POI 範例 SHALL 包含 `source` 欄位。

#### Scenario: template 包含 source 欄位
- **WHEN** 讀取 template.json 中的 POI 範例
- **THEN** 每個 POI SHALL 包含 `"source": "ai"` 作為預設範例值
