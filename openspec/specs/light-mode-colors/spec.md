# light-mode-colors — ⚰️ 已退役（2026-07-25）

## Purpose

**這份 spec 已退役。** 它是一次 light mode 調色的 delta（首行原本就是 `## MODIFIED Requirements`），描述的色盤與元素 class 都已不存在。

保留為 tombstone，**不要照原內容重建**。

## Requirements

### Requirement: 本 capability 已退役

`light-mode-colors` SHALL 不再被視為 active spec。色彩現況以 `css/tokens.css` 為權威、`DESIGN.md` 為設計 SoT。

#### Scenario: 有人想重建這份 spec

- **WHEN** 未來有人要為 light mode 色彩建立 spec
- **THEN** SHALL 直接讀 `css/tokens.css` 的 `@theme` 區塊，不要參考本文件的任何色值

## 為什麼退役

2026-07-25 逐條對照 `css/tokens.css`：提及 11 個 token，**11 個全部不存在**。

它斷言 `--accent` 為 `#C4956A`（並註明「已從 `#C4704F` 更新」）—— 現行是 `#A97A4A`，隔了兩代。它還定義 `--sand`/`--blue`/`--white`/`--gray-light` 這些它自己就標為「別名」「向後相容」的變數，全數已刪除。

## 各 Requirement 去向

| 原 Requirement | 去向 |
|---|---|
| CSS 變數 | **丟** — 整張表的變數名與值都已不存在。現況見 `css/tokens.css`。 |
| Light mode accent 改為 Claude 橘 | **丟** — 該次調色已被柔褐 `#A97A4A` 取代。 |
| Light mode day-header 背景改為卡片色 | **丟** — `.day-header` 屬 pre-SPA class。 |
| 元素對照 | **丟** — 對照的 class 多屬 pre-SPA 架構。 |
| 邊線與分隔線可見性 | **搬** — 意圖仍成立（邊線要可辨識），現由 `--color-border`/`--color-line-strong` 承載，規範在 `DESIGN.md`。 |
| 文字對比度 | **搬** — 意圖仍成立且更重要。現行守護見 `tests/unit/tokens-css.test.ts` 與 `tests/e2e/a11y-axe.spec.js`；已知缺口與修法見 issue #1150。 |
| apple map-link 使用 CSS 變數 | **丟** — `.map-link` 屬 pre-SPA class。 |
