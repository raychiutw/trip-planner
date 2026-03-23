## MODIFIED Requirements

### Requirement: CSS 變數結構主題化
`:root` SHALL 僅保留非色彩相關的基礎 token（spacing、radius、font-size、duration、font-family 等）。所有色彩相關變數 SHALL 移至主題 class 選擇器中定義。

#### Scenario: :root 不含色彩變數
- **WHEN** 檢查 `:root` 選擇器
- **THEN** 不包含 `--accent`、`--bg`、`--text`、`--border`、`--error`、`--success` 等色彩變數

#### Scenario: 主題選擇器包含完整色彩變數
- **WHEN** 檢查 `body.theme-sun` 選擇器
- **THEN** 包含所有色彩相關 CSS 變數（accent、bg、text、border、error、success、shadow、scrollbar、overlay 等）

#### Scenario: 深色主題覆寫
- **WHEN** 檢查 `body.theme-sun.dark` 選擇器
- **THEN** 覆寫所有色彩變數為該主題的深色版本
