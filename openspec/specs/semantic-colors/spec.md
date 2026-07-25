# semantic-colors — ⚰️ 已退役（2026-07-25）

## Purpose

**這份 spec 已退役。** 語意色的概念仍成立，但它用的 token 名與套用的元素 class 都屬 Tailwind v4 遷移前、pre-SPA 的架構。

保留為 tombstone，**不要照原內容重建**。

## Requirements

### Requirement: 本 capability 已退役

`semantic-colors` SHALL 不再被視為 active spec。語意色現況以 `css/tokens.css` 為權威、`DESIGN.md` 為設計 SoT。

#### Scenario: 有人想重建這份 spec

- **WHEN** 未來有人要為語意色建立 spec
- **THEN** SHALL 使用現行 `--color-destructive`/`--color-success`/`--color-warning`/`--color-info` 命名

## 為什麼退役

2026-07-25 逐條對照 `css/tokens.css`：提及 7 個 token，**5 個不存在**。套用對照表列的 class（`.trip-warnings`、`.trip-error`、`.edit-status`、`.status-dot`、`.driving-stats-badge`）屬 pre-SPA 架構。

## 各 Requirement 去向

| 原 Requirement | 去向 |
|---|---|
| 語意色 CSS 變數命名對齊 | **丟** — 別名清除是一次性遷移指令，已完成。 |
| 語意色 CSS 變數定義 | **搬（改名）** — `--error`/`--error-bg` → `--color-destructive`/`-bg`；`--success` → `--color-success`（另有 `-bg`/`-deep`）。現行還多了 `--color-warning`/`--color-info` 兩組。 |
| 錯誤元素使用語意色變數 | **丟** — 對照的 class 屬 pre-SPA 架構。原則（錯誤態一律用語意色 token、不硬編碼）仍成立，SoT 為 `DESIGN.md`。 |
