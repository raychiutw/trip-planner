---
name: tp-hig
description: 網頁 HIG 設計規範（Apple-inspired）。適用於新增或修改 HTML/CSS 時，確保 UI 符合專案的視覺與互動標準。
---

# tp-hig

網頁 HIG 設計規範（Apple-inspired）。

## 規則來源

完整 CSS HIG 規則（H1-H12）、Dark mode 規則、新增頁面 checklist、常見陷阱：
→ `../references/css-hig-rules.md`

Design tokens 速查表（Color、Typography、Spacing、Radius、Motion、Shadow）：
→ `references/css-hig.md`（含 tokens）

## 核心原則

- 所有 px 值必須符合 4pt grid（4 的倍數）。
- 嚴格限定 `font-size` 與 `transition duration` 使用指定的 token。
- `color: #fff` 改用 `var(--text-on-accent)`。
- `.sticky-nav` 永遠用 `color-mix` + `backdrop-filter` frosted glass。
