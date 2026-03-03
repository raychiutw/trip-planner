## MODIFIED Requirements

### Requirement: 選單區段二（僅 index.html）

功能跳轉項目 + 列印模式：

- AI行程亮點（icon: `sparkle`，target: `sec-highlights`）
- AI 行程建議（icon: `lightbulb`，target: `sec-suggestions`）
- 航班資訊、交通統計、出發前確認、颱風備案、緊急聯絡
- 列印模式（`data-action="toggle-print"`）

#### Scenario: 選單包含 AI 項目

- **WHEN** index.html 的選單渲染完成
- **THEN** drawer 和 sidebar SHALL 包含「AI行程亮點」和「AI 行程建議」兩個跳轉項目

#### Scenario: AI 項目排列順序

- **WHEN** index.html 的選單渲染完成
- **THEN**「AI行程亮點」SHALL 排在「AI 行程建議」前面，兩者都在「航班資訊」前面
