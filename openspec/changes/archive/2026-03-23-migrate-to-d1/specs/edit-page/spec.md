## MODIFIED Requirements

### Requirement: edit.html 重新導向
原 edit.html SHALL 保留但加入 `<meta http-equiv="refresh" content="0;url=/manage/">` 自動重新導向到 `/manage/`。原有的 GitHub Issues 功能全部移除。

#### Scenario: 存取 edit.html
- **WHEN** 使用者存取 `/edit.html`（例如舊書籤）
- **THEN** 自動重新導向到 `/manage/`

#### Scenario: 帶 query parameter
- **WHEN** 使用者存取 `/edit.html?tripId=xxx`
- **THEN** 重新導向到 `/manage/`（tripId 由 manage 頁面自行從 API 取得，不需帶過去）
