# css-hig-discipline — ⚰️ 已退役（2026-07-23）

## Purpose

**這份 spec 已退役。** 它曾用靜態分析守 7 條 CSS HIG 紀律，但指定的守護測試 `tests/unit/css-hig.test.js` 與引用的 `css/shared.css` 都已不存在、多條規則的 target token 也不存在（見下）。保留此檔作為 tombstone：記錄退役原因與各規則去向，供日後查證，**不要照原內容重建**。

## Requirements

### Requirement: 本 capability 已退役

`css-hig-discipline` SHALL 不再被視為 active spec。CSS HIG 紀律的 SoT 改為 `DESIGN.md`（Accessibility / Color / Material 段）；原 7 條規則的去向見下方表格（搬進 `DESIGN.md` 或丟棄）。

#### Scenario: 有人想重建這份 spec

- **WHEN** 未來有人要為 CSS HIG 紀律建立 spec
- **THEN** SHALL 先讀本 tombstone 的去向表，確認規則是否已在 `DESIGN.md`，避免重蹈「守護測試不存在、規則悄悄漂走」的覆轍

## 為什麼退役

大範圍腐爛，且**指向多個已不存在的東西**：
- 引用的 `css/shared.css` — 不存在
- 指定的守護測試 `tests/unit/css-hig.test.js` — 不存在（規則 7 因此自我證偽）
- 規則 2 的 `--overlay` token — `css/tokens.css` 中不存在（grep = 0）
- 規則 5 的 `--text-on-accent` token — 同樣不存在

因為守護測試消失，這份 spec 的規則從未被自動執行，也就悄悄漂走了（focus-ring 規則實際在 `8ead450b` 被違反、無人擋下）。這正是 wayfinder map #1110 / ticket #1116 揭露的問題。

## 7 條規則的去向

| # | Requirement | 去向 |
|---|---|---|
| 1 | focus-visible 移除 outline 時提供替代焦點指示 | **搬進 `DESIGN.md`**（Accessibility 段的 Focus 條目，已補上 `box-shadow: var(--shadow-ring)` 要求 + 誤刪紀錄） |
| 2 | backdrop/overlay 用 `--overlay` token | **丟** — `--overlay` token 根本不存在，規則從一開始就對不上現況 |
| 3 | sticky-nav frosted glass | **丟** — `DESIGN.md`（Material & Effects 的 Glass 段 + TitleBar/Sidebar 章）已有更完整、更新的 glass 規範 |
| 4 | dark mode 覆寫不得冗餘 | **搬進 `DESIGN.md`**（Color / Approach 段尾） |
| 5 | `color: #fff` 改 `--text-on-accent` | **丟** — target token `--text-on-accent` 不存在，搬了等於叫人改成一個沒有的東西（僅 3 處疑似硬寫白，未來若要收斂應以當時真實 token 重寫規則） |
| 6 | 4pt grid spacing | **丟** — `DESIGN.md`（Spacing / Base Unit 段）已有更完整版，含 micro-spacing 例外 |
| 7 | css-hig.test.js 自動守護（≥12 條靜態分析） | **丟** — 該測試檔已不存在；守護機制的重建屬 wayfinder #1110 的 P2 落差（focus-ring 補回時要一併恢復守護，避免再次靜默漂移） |

搬遷前每條都查過現況，沒有把未驗證的斷言盲搬進 DESIGN.md。
