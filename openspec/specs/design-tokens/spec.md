# design-tokens — ⚰️ 已退役（2026-07-25）

## Purpose

**這份 spec 已退役。** 它是 Tailwind v4 遷移前的 token 定義 delta，記錄「當時在 `css/shared.css` 加了哪些 token」。該檔案已不存在，多數 token 已改名。

保留為 tombstone：記錄退役原因與各 Requirement 去向，**不要照原內容重建**。

## Requirements

### Requirement: 本 capability 已退役

`design-tokens` SHALL 不再被視為 active spec。token 現況以 `css/tokens.css` 為權威、`DESIGN.md` 為設計 SoT、`.claude/skills/tp-ux-verify/references/tokens.md` 為速查表。

#### Scenario: 有人想重建這份 spec

- **WHEN** 未來有人要為 design token 建立 spec
- **THEN** SHALL 先讀本 tombstone 的去向表，確認規則是否已在 `tokens.css` 或 `DESIGN.md`

## 為什麼退役

2026-07-25 逐條對照 `css/tokens.css`：提及 28 個 token，**20 個不存在**。引用的 `css/shared.css` 整個檔案已不存在（`css/` 下只有 `tokens.css`）。

## 各 Requirement 去向

| 原 Requirement | 去向 |
|---|---|
| Shadow token | **搬** — `--shadow-sm/-md/-lg/-ring` 仍在 `tokens.css`，但值已改為暖棕 rgba（原文寫 `rgba(0,0,0,…)`）。`--shadow-ring` 現引用 `var(--color-accent)` 而非舊名 `var(--accent)`。 |
| Radius token | **搬** — 現為 `--radius-xs/-sm/-md/-lg/-xl/-full`（多了 `-xl`）；`--radius-full` 是 `9999px` 非原文的 `99px`。 |
| Overlay token | **搬（改名）** — 現名 `--color-overlay`。 |
| Priority 色彩 token | **搬（改名）** — 現名 `--color-priority-high/medium/low-bg` 與 `-dot`。 |
| Color Mode Preview token | **丟** — `--cmp-*` 系列已全數刪除，無對應。 |
| Motion token | **搬（改名）** — `--duration-*` → `--transition-duration-*`；`--ease-apple` → `--transition-timing-function-apple`。另有 sheet 專用 `--ease-spring`/`--ease-sheet-close`/`--duration-sheet-open`/`-close`。 |
