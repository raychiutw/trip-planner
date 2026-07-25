# font-size-scale — ⚰️ 已退役（2026-07-25）

## Purpose

**這份 spec 已退役。** 它定義的 11 級 Apple Text Style 階梯本身仍是現行設計，但它用的 token 名（`--fs-*`、`--lh-*`）在 Tailwind v4 遷移時已全數改名，且定義處 `css/shared.css` 已不存在。

保留為 tombstone，**不要照原內容重建**。

## Requirements

### Requirement: 本 capability 已退役

`font-size-scale` SHALL 不再被視為 active spec。字級現況以 `css/tokens.css` 為權威、`DESIGN.md` 為設計 SoT。

#### Scenario: 有人想重建這份 spec

- **WHEN** 未來有人要為字級階梯建立 spec
- **THEN** SHALL 使用現行 `--font-size-*` 命名，並注意值已與本文件不同（例如 body 從 `1.0625rem` 改為 `1rem`）

## 為什麼退役

2026-07-25 逐條對照 `css/tokens.css`：提及 15 個 token，**15 個全部不存在** —— `--fs-*`（11 個）與 `--lh-*`（3 個）皆為遷移前舊名。

## 各 Requirement 去向

| 原 Requirement | 去向 |
|---|---|
| 11 級 Apple Text Style font-size token | **搬（改名）** — `--fs-*` → `--font-size-*`。階梯仍是 11 級但值有調整（body `1rem`），另新增 `--font-size-eyebrow` 與 `--mobile-font-size-body`。 |
| 各 CSS 檔案不得出現硬編碼 font-size | 🔶 **孤兒** — 紀律仍該成立且仍有缺口（#1117 盤點出 58 處寫死 px 字級），但**目前沒有任何文件擁有這條禁令**：`DESIGN.md` 有字級表與手機放大規則，卻沒有「不得硬編碼」的明文條款；原文指定的守護測試也隨 `shared.css` 一起消失。**這條規則現在既無 SoT 也無自動守護** —— 要它生效得先在 `DESIGN.md` 寫明並補守護測試，見 #1150。 |
| Line height token | **搬（改名）** — `--lh-tight/normal/relaxed` → `--line-height-tight/-normal/-relaxed`。 |
