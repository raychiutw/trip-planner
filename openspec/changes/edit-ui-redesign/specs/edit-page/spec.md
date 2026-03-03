## MODIFIED Requirements

### Requirement: Issue 歷史紀錄

Issue 歷史 SHALL 透過 GitHub API（`--label trip-edit --state all --per_page 20`）拉取，每筆 issue 以左對齊列表項目渲染，項目之間以虛線分隔。每項 SHALL 包含 status dot（`●` 綠色 open / `○` 灰色 closed）、標題連結、issue 編號、建立時間與狀態文字。載入中顯示「載入中…」，失敗顯示「無法載入紀錄」。

#### Scenario: Issues 以左對齊列表項目顯示

- **WHEN** GitHub API 成功回傳 issue 列表
- **THEN** 每筆 issue SHALL 渲染為左對齊列表項目，包含 status dot、標題（可點擊跳轉 GitHub）、meta 行顯示 `#N · 時間 · open/closed`

#### Scenario: Issue 項目之間以虛線分隔

- **WHEN** issue 列表有多筆資料
- **THEN** 每筆 issue 項目之間 SHALL 有 `1px dashed var(--border)` 虛線分隔，最後一筆不顯示底部虛線

#### Scenario: Open issue 顯示綠色狀態

- **WHEN** 渲染一筆 state 為 open 的 issue
- **THEN** 左側顯示 `●` 綠色圓點（`var(--success)`），meta 行顯示「open」文字

#### Scenario: Closed issue 顯示灰色狀態

- **WHEN** 渲染一筆 state 為 closed 的 issue
- **THEN** 左側顯示 `○` 灰色圓點（`var(--text-muted)`），meta 行顯示「closed」文字

#### Scenario: 載入中狀態

- **WHEN** GitHub API 請求進行中
- **THEN** 訊息區域顯示「載入中…」文字

#### Scenario: 載入失敗狀態

- **WHEN** GitHub API 請求失敗
- **THEN** 訊息區域顯示「無法載入紀錄」文字

#### Scenario: 無紀錄狀態

- **WHEN** GitHub API 回傳空列表
- **THEN** 訊息區域顯示「尚無修改紀錄」文字

## ADDED Requirements

### Requirement: 問候語空頁面垂直置中

當 issue 列表為空（無紀錄或載入中）時，問候語卡片 SHALL 在可視訊息區域內垂直居中顯示。當有 issue 資料時，問候語 SHALL 回到頂部對齊。

#### Scenario: 無 issue 時問候語垂直居中

- **WHEN** GitHub API 回傳空列表或頁面初次載入
- **THEN** 問候語卡片 SHALL 在 `.chat-messages` 區域內垂直居中，上下留白均等

#### Scenario: 有 issue 時問候語頂部對齊

- **WHEN** GitHub API 回傳至少一筆 issue
- **THEN** 問候語卡片 SHALL 位於訊息區域頂部，issue 列表緊接在下方

### Requirement: 送出後樂觀插入列表

送出 issue 成功後，系統 SHALL 立即將新 issue 以列表項目格式插入 issue 列表頂部（樂觀更新），隨後再透過 API 重新拉取完整資料。

#### Scenario: 送出成功後新 issue 立即出現

- **WHEN** 使用者送出修改需求且 API 回傳 201
- **THEN** 新 issue SHALL 立即以 `.issue-item` 格式出現在列表最上方，狀態為 open，不等待 `loadIssues()` 完成

#### Scenario: API 重拉後列表更新為完整資料

- **WHEN** 樂觀插入後 `loadIssues()` API 回傳完成
- **THEN** 列表 SHALL 以 API 回傳的完整資料覆蓋，包含正確的 issue number 和時間
