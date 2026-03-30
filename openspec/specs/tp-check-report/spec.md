## ADDED Requirements

### Requirement: tp-check 品質驗證 report

`/tp-check` skill SHALL 對指定行程 JSON 逐項檢查 R1-R12 品質規則，輸出紅綠燈格式的驗證 report。report 不修改任何檔案，僅輸出驗證結果。

#### Scenario: 獨立執行

- **WHEN** 使用者執行 `/tp-check {tripSlug}`
- **THEN** SHALL 讀取 `data/trips/{tripSlug}.json` 並逐項檢查 R1-R12
- **AND** 輸出完整模式 report

#### Scenario: 未指定 tripSlug

- **WHEN** 使用者執行 `/tp-check` 未帶參數
- **THEN** SHALL 讀取 `data/trips.json` 列出所有行程供選擇

#### Scenario: 只讀不改

- **WHEN** tp-check 執行期間
- **THEN** SHALL NOT 修改任何檔案（包括行程 JSON、js、css、html、tests）

### Requirement: 紅綠燈狀態定義

每條規則 SHALL 標記為三種狀態之一：passed（🟢）、warning（🟡）、failed（🔴）。

#### Scenario: passed 狀態

- **WHEN** 規則完全符合
- **THEN** SHALL 標記為 🟢

#### Scenario: warning 狀態

- **WHEN** 規則有瑕疵但屬 warn 級（如 R11 location 缺失、R12 googleRating 缺失）或部分缺失不影響主結構
- **THEN** SHALL 標記為 🟡

#### Scenario: failed 狀態

- **WHEN** 規則不符合且屬 strict 級
- **THEN** SHALL 標記為 🔴

### Requirement: 完整模式 report 格式

完整模式 report SHALL 包含表頭（tripSlug + 時間戳）、summary 行（三色計數）、規則明細表（每條規則一行）、warnings 清單、failures 清單。

#### Scenario: 表頭格式

- **WHEN** 輸出完整模式 report
- **THEN** 表頭 SHALL 包含 tripSlug 和執行時間戳

#### Scenario: summary 行

- **WHEN** 輸出完整模式 report
- **THEN** summary 行 SHALL 顯示 `🟢 N passed  🟡 N warnings  🔴 N failed`

#### Scenario: 規則明細表

- **WHEN** 輸出完整模式 report
- **THEN** SHALL 逐列顯示 R1-R12 的編號、名稱、狀態、detail（有問題時）

#### Scenario: 問題清單

- **WHEN** 有 🟡 或 🔴 項目
- **THEN** SHALL 分別列出 warnings 和 failures 的具體描述（含規則編號、Day/項目名稱、缺失內容）

### Requirement: 精簡模式 report 格式

精簡模式 report SHALL 為單行 summary，適合嵌入其他 skill 尾部。

#### Scenario: 精簡輸出

- **WHEN** 以精簡模式執行 tp-check
- **THEN** SHALL 輸出單行：`tp-check: 🟢 N  🟡 N  🔴 N`

### Requirement: tp-check 嵌入策略

修改行程 JSON 的 skill SHALL 在適當時機執行 tp-check。

#### Scenario: tp-rebuild 嵌入

- **WHEN** `/tp-rebuild` 執行
- **THEN** SHALL 在修正前執行一次 tp-check（完整模式，before-fix）
- **AND** 修正後再執行一次 tp-check（完整模式，after-fix）

#### Scenario: tp-edit 嵌入

- **WHEN** `/tp-edit` 完成局部修改後
- **THEN** SHALL 執行一次 tp-check（精簡模式）

#### Scenario: tp-issue 嵌入

- **WHEN** `/tp-issue` 處理完每個 Issue 後
- **THEN** SHALL 執行一次 tp-check（精簡模式）


#### Scenario: tp-rebuild-all 嵌入

- **WHEN** `/tp-rebuild-all` 逐趟執行
- **THEN** 每趟完成後 SHALL 執行一次 tp-check（完整模式，after-fix）
