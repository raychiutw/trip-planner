## ADDED Requirements

### Requirement: textarea 字數上限

edit.html 的修改請求 textarea SHALL 設定 `maxlength="65536"`，對應 GitHub Issue body 的上限。

#### Scenario: 達到字數上限
- **WHEN** 使用者輸入達到 65536 字元
- **THEN** textarea SHALL 停止接受更多輸入

### Requirement: textarea 字體大小

edit.html 的修改請求 textarea SHALL 使用 `var(--fs-sm)`（0.875rem / 14px）作為字體大小。

#### Scenario: 手機與桌機一致
- **WHEN** 在手機或桌機瀏覽 edit.html
- **THEN** textarea 字體大小 SHALL 皆為 `var(--fs-sm)`

### Requirement: textarea 最大高度

edit.html 的修改請求 textarea 最大高度 SHALL 為 `25vh`（約視窗高度的 1/4）。

#### Scenario: 大量文字輸入
- **WHEN** 使用者輸入多行文字超過 25vh 高度
- **THEN** textarea SHALL 出現捲軸，不超過 25vh

### Requirement: Issue 建立時掛雙 label

建立 GitHub Issue 時 SHALL 同時掛 `trip-edit` 和當前行程 slug 兩個 label。

#### Scenario: 送出修改請求
- **WHEN** 使用者在釜山行程的 edit.html 送出修改請求
- **THEN** 建立的 Issue labels SHALL 為 `['trip-edit', 'busan-trip-2026-CeliaDemyKathy']`

#### Scenario: trip-edit label 保留
- **WHEN** 建立 Issue
- **THEN** `trip-edit` label SHALL 始終存在，供 tp-issue skill 全局掃描使用

### Requirement: Issue 查詢按行程 slug 過濾

`loadIssues` SHALL 使用當前行程的 slug label 過濾查詢，只顯示當前行程的 Issues。

#### Scenario: 查詢當前行程的 Issues
- **WHEN** 使用者在釜山行程的 edit.html 頁面
- **THEN** API 查詢 SHALL 使用 `?labels=busan-trip-2026-CeliaDemyKathy&state=all&per_page=20`

#### Scenario: 不同行程看到不同 Issues
- **WHEN** 使用者切換到沖繩行程的 edit.html
- **THEN** SHALL 只顯示 label 含 `okinawa-trip-2026-Ray` 的 Issues
