## ADDED Requirements

### Requirement: Closed issue 顯示最後一則回覆

對於 `state === 'closed'` 且 `comments > 0` 的 issue，系統 SHALL 非同步載入該 issue 的最後一則 comment，並以純文字顯示在 issue item 的 meta 資訊下方。

#### Scenario: Closed issue 有 comment 時顯示回覆

- **WHEN** issue `state` 為 `closed` 且 `comments > 0`
- **THEN** issue item SHALL 在 meta 下方顯示該 issue 最後一則 comment 的 `body` 內容（純文字，不解析 markdown）

#### Scenario: Open issue 不顯示回覆區

- **WHEN** issue `state` 為 `open`
- **THEN** issue item SHALL NOT 包含回覆區域

#### Scenario: Closed 但無 comment 不顯示回覆區

- **WHEN** issue `state` 為 `closed` 且 `comments === 0`
- **THEN** issue item SHALL NOT 包含回覆區域

### Requirement: 回覆載入中 placeholder

回覆區在 comment 資料尚未載入時 SHALL 顯示「讀取回覆中…」灰字 placeholder。

#### Scenario: Comment 尚在載入時顯示 placeholder

- **WHEN** issue 列表渲染完成但 comment 資料尚未回傳
- **THEN** 回覆區 SHALL 顯示「讀取回覆中…」，字級 `--fs-sm`、顏色 `--text-muted`

#### Scenario: Comment 載入完成後替換 placeholder

- **WHEN** comment API 回傳成功
- **THEN** 回覆區 SHALL 以最後一則 comment 的 `body` 純文字內容取代 placeholder

### Requirement: 回覆載入失敗處理

comment fetch 失敗時 SHALL 顯示「無法載入回覆」。

#### Scenario: Comment API 回傳錯誤

- **WHEN** comment API 回傳非 200 狀態碼或網路錯誤
- **THEN** 回覆區 SHALL 顯示「無法載入回覆」，字級 `--fs-sm`、顏色 `--text-muted`

### Requirement: 回覆區樣式

回覆區（`.issue-reply`）SHALL 使用 `--fs-sm` 字級、`--text-muted` 顏色，位於 `.issue-item-meta` 下方。

#### Scenario: 回覆區視覺樣式

- **WHEN** 回覆內容成功載入並顯示
- **THEN** 回覆文字 SHALL 使用 `--fs-sm` 字級、`--text-muted` 顏色，與 meta 對齊
