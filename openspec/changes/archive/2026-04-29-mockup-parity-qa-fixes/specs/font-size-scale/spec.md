## MODIFIED Requirements

### Requirement: 11 級 Apple Text Style font-size token 定義於 shared.css

系統 SHALL 在 `css/shared.css` 與 `css/tokens.css` 的 `:root` 中定義且僅定義 11 個 font-size 變數（`--fs-*` 與 `--font-size-*` alias），對齊 Apple HIG Text Styles + mockup `terracotta-preview-v2.html` 規範。

| 變數 | 值 | mockup 對應角色 |
|------|----|-----------------|
| `--fs-body` / `--font-size-body` | `1rem` (16px) | mockup body / card-title compact |
| `--fs-footnote` / `--font-size-footnote` | `0.875rem` (14px) | mockup support |

**Δ vs 既有 spec**：
- `body`：`1.0625rem` (17px) → **`1rem` (16px)** 對齊 mockup body
- `footnote`：`0.8125rem` (13px) → **`0.875rem` (14px)** 對齊 mockup support

#### Scenario: body 預設 font-size 為 16px

- **WHEN** 任何頁面載入完成
- **THEN** `getComputedStyle(document.body).fontSize` SHALL 為 `'16px'`

#### Scenario: footnote token 解析為 14px

- **WHEN** 任何 element 套 `font-size: var(--font-size-footnote)`
- **THEN** computed font-size SHALL 為 `14px`
