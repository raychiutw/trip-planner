# ADR-0004：Tailwind CSS 4 + `@theme`，不用 CSS modules

- **Status**：Accepted
- **來源**：自 `ARCHITECTURE.md` 的 Key Architectural Decisions 搬入（2026-07-22）

## Context

需要支援 6 套主題（color theme × dark mode）的樣式切換。

## Decision

用 Tailwind CSS 4 的 `@theme` + CSS custom property 做 token 切換；元件層全用 utility class。不採用 CSS modules。

## Consequences

- 主題切換只需換 custom property 值，不需要重新編譯或載入不同 stylesheet。
- Utility class 減少 dead CSS。
- **代價**：token 命名與層級需要紀律（見 `DESIGN.md`）；`@theme` 的 tree-shake 行為曾造成 token 失蹤，新增 token 要確認有 consumer。
