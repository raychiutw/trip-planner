# tailwind-v4-theme — ⚰️ 已退役（2026-07-25）

## Purpose

**這份 spec 已退役。** 它記錄的是一次性的 Tailwind CSS v4 遷移（舊 token 名 → `--color-*` namespace），該遷移早已完成。作為 active spec 保留下來後從沒更新過，內容已與現況嚴重脫節：它描述的檔案、色值、主題 class、token 名多數**都不存在**。

保留此檔作為 tombstone：記錄退役原因與各 Requirement 去向，供日後查證，**不要照原內容重建**。

## Requirements

### Requirement: 本 capability 已退役

`tailwind-v4-theme` SHALL 不再被視為 active spec。Tailwind v4 + `@theme` 的**決策**記錄於 `docs/adr/0003-tailwind-4-theme-tokens.md`；token 的**現況**以 `css/tokens.css` 為權威、`DESIGN.md` 為設計 SoT。

#### Scenario: 有人想重建這份 spec

- **WHEN** 未來有人要為 Tailwind theme token 建立 spec
- **THEN** SHALL 先讀本 tombstone 的去向表，確認該規則是否已在 ADR-0003 或 `DESIGN.md`，避免重蹈「spec 停在遷移當下、之後沒人回來更新」的覆轍

## 為什麼退役

2026-07-25 逐條對照 `css/tokens.css` 驗證，結果：

- **引用的檔案不存在** —— 通篇寫 `css/shared.css`（4 處）。`css/` 底下現在只有 `tokens.css`。
- **色值全錯** —— 斷言 `--color-accent: #E86A4A`（Sun 橘）。實際是 `#A97A4A`（柔褐）。
- **主題 class 不存在** —— 有 `body.theme-sky` 與 `body.theme-sun.dark` 兩條 Scenario。多主題已退場，只剩 `body.dark` 與 `body.theme-print`，且 `tests/unit/tokens-css.test.ts` 明文斷言 `theme-sun`/`sky`/`zen`/`forest`/`sakura`/`night` 都不存在。
- **token 名大量過期** —— 提及 70 個 token，其中 **47 個在 `tokens.css` 找不到**。

**根本問題**：這份 spec 的內容是「這次遷移改了什麼」，不是「系統現在該是什麼」。前者在遷移完成的那一刻就凍結為歷史，卻被放在 `openspec/specs/` 當成持續有效的規格。

## 各 Requirement 去向

| # | 原 Requirement | 去向 |
|---|---|---|
| 1 | `@theme` 為色彩 token 唯一定義處 | **搬** — 決策見 `docs/adr/0003`；現況權威是 `css/tokens.css`（非 `shared.css`）。原文的舊名→新名對照表已完成使命。 |
| 2 | Theme override 定義於 `@layer base`（`body.theme-*`） | **丟** — 多主題已退場。現行只有 `body.dark` 與 `body.theme-print`，由 `tests/unit/tokens-css.test.ts` 守護。 |
| 3 | Tailwind CSS v4 Vite 整合 | **丟** — `vite.config.ts` 使用 `@tailwindcss/vite` 仍成立，但那是建置設定，壞了 build 直接失敗，不需要 spec 守。原文三條 Scenario（build 成功／tsc 零錯誤／測試通過）是通用 CI 檢查，非本 capability 專屬。 |
| 4 | 非色彩 token 保留於 `:root` | **過期** — 列的 `--fs-*`、`--font-system`、`--lh-*`、`--ease-apple`、`--duration-*`、`--tap-min`、`--z-*`、`--content-max-w`、`--info-panel-w`、`--nav-h`、`--padding-h` 全部已改名或刪除。現行對照見 `.claude/skills/tp-ux-verify/references/tokens.md`。 |

## 現行命名對照（供讀到舊文件的人查）

| 遷移前舊名 | 現名 |
|---|---|
| `--accent` | `--color-accent` |
| `--bg` | `--color-background` |
| `--text` / `--text-muted` | `--color-foreground` / `--color-muted` |
| `--hover-bg` | `--color-hover` |
| `--overlay` | `--color-overlay` |
| `--fs-*` | `--font-size-*` |
| `--lh-*` | `--line-height-*` |
| `--ease-apple` | `--transition-timing-function-apple` |
| `--duration-fast/normal/slow` | `--transition-duration-fast/normal/slow` |
| `--tap-min` | `--spacing-tap-min` |
| `--nav-h` | `--spacing-nav-h` |
| `--padding-h` | `--spacing-padding-h` |
| `--cmp-*`、`--content-max-w`、`--info-panel-w`、`--fab-size` | 已刪除，無對應 |
