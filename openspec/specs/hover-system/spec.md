# hover-system — ⚰️ 已退役（2026-07-25）

## Purpose

**這份 spec 已退役。** 它是「把散落各處的硬編碼 hover 色碼收斂成單一變數」的一次性遷移 delta，該遷移已完成；用的變數名與元素 class 都屬遷移前架構。

保留為 tombstone，**不要照原內容重建**。

## Requirements

### Requirement: 本 capability 已退役

`hover-system` SHALL 不再被視為 active spec。hover 現況以 `css/tokens.css` 為權威、`DESIGN.md` 為設計 SoT。

#### Scenario: 有人想重建這份 spec

- **WHEN** 未來有人要為 hover 態建立 spec
- **THEN** SHALL 使用現行 `--color-hover`，並注意另有 `--hover-brightness` 供濾鏡式 hover 使用

## 為什麼退役

2026-07-25 逐條對照 `css/tokens.css`：提及 2 個 token，**2 個都不存在**（`--hover-bg`、`--text`）。套用對照表列的 class（`.map-link`、`.hw-block`、`.trip-btn`）屬 pre-SPA 架構。

## 各 Requirement 去向

| 原 Requirement | 去向 |
|---|---|
| hover 背景色 CSS 變數 | **搬（改名）** — `--hover-bg` → `--color-hover`。 |
| 全站 hover 底色統一使用 --hover-bg | **丟**（收斂動作已完成；對照的 class 屬 pre-SPA 架構）＋ 🔶 **孤兒殘留** — 「不硬編碼 hover 色」的原則仍該成立，但沒有明文歸屬：`DESIGN.md` 只定義了 hover 用哪些 token（`--color-accent-deep` hover/pressed、`--color-accent-subtle` hover 底），**沒有禁止硬編碼的條款**，也無守護測試。 |
| 深色模式硬寫 hover 色碼改為變數 | **丟** — 一次性遷移指令，已完成。 |
