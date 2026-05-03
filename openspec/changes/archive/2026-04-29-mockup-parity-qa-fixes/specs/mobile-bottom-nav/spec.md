## ADDED Requirements

### Requirement: Mobile bottom nav label MUST 使用 11/14/700 字級

`/` 路由的 mobile bottom nav 在 viewport <1024px 時 SHALL render 每顆 tab 的 label 使用 `font-size: 11px / line-height: 14px / font-weight: 700`。對應 mockup `terracotta-preview-v2.html` Section 02 line 5227 `Icon 18px、label 11px / 14px / 700` 規範。

#### Scenario: Mobile bottom nav label 字級對齊

- **WHEN** 使用者在 390×844 viewport 開啟 `/account` 並 inspect bottom nav 第一顆 tab 的 span
- **THEN** `getComputedStyle(span).fontSize` SHALL 為 `'11px'`、`lineHeight` SHALL 為 `'14px'`、`fontWeight` SHALL 為 `'700'`
