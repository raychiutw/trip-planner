## MODIFIED Requirements

### Requirement: edit 頁面底色

`.edit-page` 容器背景 SHALL 為 `var(--card-bg)`，與 sidebar 底色一致。亮色模式為 `#EDE8E3`，深色模式為 `#292624`。

#### Scenario: edit 頁亮色底色

- **WHEN** 亮色模式下開啟 edit.html
- **THEN** `.edit-page` 背景 SHALL 為 `var(--card-bg)`（`#EDE8E3`）

#### Scenario: edit 頁深色底色

- **WHEN** 深色模式下開啟 edit.html
- **THEN** `.edit-page` 背景 SHALL 為 `var(--card-bg)`（`#292624`）
