## ADDED Requirements

### Requirement: meta.md 支援 published 欄位
每個行程的 `meta.md` YAML front matter SHALL 包含 `published` 欄位（boolean）。未指定時預設為 `true`。

#### Scenario: 上架行程
- **WHEN** `meta.md` 設定 `published: true`
- **THEN** build 後 `trips.json` 該行程的 `published` 為 `true`

#### Scenario: 下架行程
- **WHEN** `meta.md` 設定 `published: false`
- **THEN** build 後 `trips.json` 該行程的 `published` 為 `false`

#### Scenario: 未指定 published
- **WHEN** `meta.md` 未包含 `published` 欄位
- **THEN** build 後 `trips.json` 該行程的 `published` 為 `true`

### Requirement: 設定頁只顯示上架行程
`setting.html` 的行程清單 SHALL 只顯示 `published: true` 的行程。

#### Scenario: 上架行程顯示
- **WHEN** 使用者開啟設定頁
- **THEN** 只看到 `published: true` 的行程按鈕

#### Scenario: 下架行程不顯示
- **WHEN** 有行程 `published: false`
- **THEN** 該行程不出現在設定頁的行程清單中

### Requirement: 行程主頁偵測下架行程
`index.html` 載入時 SHALL 檢查 localStorage `trip-pref` 對應的行程是否上架。若已下架，顯示提示後導到設定頁。

#### Scenario: 選中上架行程
- **WHEN** localStorage `trip-pref` 對應 `published: true` 的行程
- **THEN** 正常載入行程內容

#### Scenario: 選中下架行程
- **WHEN** localStorage `trip-pref` 對應 `published: false` 的行程
- **THEN** 顯示「此行程已下架」提示
- **AND** 2 秒後導到 `setting.html`

### Requirement: manage 頁只顯示上架行程
`manage/index.html` 的行程選擇 SHALL 只顯示 `published: true` 的行程。

#### Scenario: manage 頁行程篩選
- **WHEN** 使用者開啟 manage 頁
- **THEN** 行程選擇清單只包含上架行程

### Requirement: admin 頁顯示全部行程含下架標記
`admin/index.html` 的行程選擇 SHALL 顯示全部行程，下架行程標題前加 `(已下架)` 前綴。

#### Scenario: admin 頁上架行程
- **WHEN** 行程 `published: true`
- **THEN** 標題正常顯示（無前綴）

#### Scenario: admin 頁下架行程
- **WHEN** 行程 `published: false`
- **THEN** 標題前加 `(已下架)` 前綴

### Requirement: 行程選擇用 name 顯示
所有頁面的行程選擇清單 SHALL 使用行程的 `name` 欄位顯示（如「Ray 的沖繩之旅」）。

#### Scenario: 行程選擇顯示名稱
- **WHEN** 頁面載入行程清單
- **THEN** 每個行程以 `name` 顯示
