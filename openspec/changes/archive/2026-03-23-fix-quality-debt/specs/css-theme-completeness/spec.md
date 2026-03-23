## ADDED Requirements

### Requirement: 所有 light theme 包含 badge 和 plan tokens
`shared.css` 的每個 light theme（zen, forest, sakura, night, sky）SHALL 宣告以下 tokens：
- `--color-badge-open`
- `--color-badge-closed`
- `--color-plan-bg`
- `--color-plan-text`
- `--color-plan-hover`

#### Scenario: zen light theme 有完整 badge tokens
- **WHEN** 套用 `body.theme-zen`（light mode）
- **THEN** `--color-badge-open` 和 `--color-badge-closed` SHALL 有值，不 fallback 到 `:root`

#### Scenario: 所有 light theme token 對比度足夠
- **WHEN** badge token 顏色搭配該 theme 的背景色
- **THEN** 對比度 SHALL 符合 WCAG AA 標準（≥ 4.5:1）

### Requirement: 移除重複的 theme token 宣告
`shared.css` 中 `body.theme-sun.dark` 區塊 SHALL 不包含重複的 `--color-badge-open` 和 `--color-badge-closed` 宣告。

#### Scenario: theme-sun.dark 無重複
- **WHEN** 檢查 `body.theme-sun.dark` CSS 規則
- **THEN** `--color-badge-open` 和 `--color-badge-closed` SHALL 各只出現一次
