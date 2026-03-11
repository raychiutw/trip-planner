## MODIFIED Requirements

### Requirement: Edit 頁面字級對齊行程頁

edit.html 的各元素字級 SHALL 與 index.html 同類元素對齊，確保跨頁面閱讀體驗一致。

#### Scenario: Issue 標題字級（mobile）

- **WHEN** viewport width < 768px
- **THEN** `.issue-item-title` 的 font-size SHALL 為 `var(--fs-callout)`

#### Scenario: Issue 標題字級（desktop）

- **WHEN** viewport width ≥ 768px
- **THEN** `.issue-item-title` 的 font-size SHALL 為 `var(--fs-title3)`

#### Scenario: Issue body 預覽字級

- **WHEN** 渲染 issue body 預覽
- **THEN** `.issue-item-body` 的 font-size SHALL 為 `var(--fs-callout)`

#### Scenario: Issue meta 字級

- **WHEN** 渲染 issue meta 資訊
- **THEN** `.issue-item-meta` 的 font-size SHALL 為 `var(--fs-footnote)`

#### Scenario: Reply 本文字級

- **WHEN** 渲染 issue 回覆內容
- **THEN** `.issue-reply` 的 font-size SHALL 為 `var(--fs-body)`

#### Scenario: Reply 內 code 字級

- **WHEN** 渲染回覆內的 inline code
- **THEN** `.issue-reply code` 的 font-size SHALL 為 `var(--fs-callout)`

#### Scenario: Mode pill 字級

- **WHEN** 渲染模式切換 pill
- **THEN** `.edit-mode-pill` 的 font-size SHALL 為 `var(--fs-callout)`
