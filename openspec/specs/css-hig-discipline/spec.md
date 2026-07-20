### Requirement: focus-visible 移除 outline 時必須提供替代焦點指示

所有 `:focus-visible` 規則中使用 `outline: none` 時 SHALL 同時宣告 `box-shadow: var(--shadow-ring)` 作為替代焦點指示器。

例外：表單輸入元素（`textarea`、`input`、`.edit-textarea`）使用文字游標作為焦點指示，不需 `box-shadow`。

#### Scenario: button focus-visible 有 box-shadow

- **WHEN** 靜態分析所有 CSS 檔案中含 `:focus-visible` 的規則
- **THEN** 若該規則包含 `outline: none` 且選擇器非表單輸入，SHALL 同時包含 `box-shadow` 宣告

#### Scenario: shared.css 提供全局 button focus-visible

- **WHEN** 載入 `css/shared.css`
- **THEN** SHALL 存在 `button:focus-visible { outline: none; box-shadow: var(--shadow-ring); }` 規則

---

### Requirement: backdrop/overlay 使用 --overlay token

所有含 `backdrop` 或 `overlay` 關鍵字的選擇器 SHALL 使用 `var(--overlay)` 作為背景色，不得硬寫 `rgba(0,0,0,...)` 值。

#### Scenario: 無硬寫 backdrop rgba

- **WHEN** 靜態分析所有 CSS 檔案中含 `backdrop` 或 `overlay` 的選擇器（排除 `:root` 與 `body.dark` 定義區塊）
- **THEN** 背景色 SHALL 為 `var(--overlay)`，不得出現 `rgba(0,0,0,...)`

---

### Requirement: chrome 使用單一 Regular Glass 材質

全站 chrome（titlebar、底部膠囊、page bottom bar、sheet、stack panel header、chat composer）
SHALL 使用同一組材質 token：`background: var(--glass-tint)`、`backdrop-filter: var(--glass-filter)`、
`border: var(--glass-rim)`、`box-shadow: var(--glass-specular), var(--glass-shadow)`。

chrome 背景 SHALL NOT 使用品牌色 `color-mix(in srgb, var(--color-background|secondary|accent) N%, transparent)`。
Apple HIG 明令「glass 不上 tint，顏色留給 content layer」，且 Regular 變體的定義是
「provides legibility regardless of context」—— 依背景分軌代表材質本身做錯了。
2026-07-20 實證：品牌染色玻璃在同色相頁面上必然糊掉，且調整 opacity（62%→72%→88%）完全無效，
根因是 tint 的**色相**不是數值。

> 沿革：本條原文為「`.sticky-nav` 背景 SHALL 使用 `color-mix(var(--bg) 85%)` … 不得使用 `rgba()`」，
> 與 Regular Glass 收斂正面衝突（`--glass-tint` 正是中性 `rgba()`）而反轉。

已核可例外（各有測試守護）：`DesktopSidebar` 的 macOS vibrancy（`blur(30px)`，唯一保留品牌 tint 的 chrome）、
≤32px 浮動小按鈕的 `blur(8px)`。

#### Scenario: chrome 無品牌染色背景

- **WHEN** 靜態分析 chrome 選擇器（`.tp-titlebar` / `.tp-global-bottom-nav` / `.tp-page-bottom-bar` / `.tp-map-day-tabs` / `.tp-bottom-nav`）
- **THEN** `background` SHALL 為 `var(--glass-tint)`，SHALL NOT 為含 `--color-background` / `--color-secondary` / `--color-accent` 的 `color-mix()`

#### Scenario: 隨主題變值的材質 token 放置正確

- **WHEN** 檢查 `css/tokens.css` 中 `--glass-tint` / `--glass-rim` / `--glass-specular` / `--glass-shadow` 的宣告位置
- **THEN** 淺色值 SHALL 在 `@theme` block 內、深色覆寫 SHALL 在 `@layer base { body.dark }` 內
- **AND** SHALL NOT 出現在未分層的 `body {}` —— 未分層宣告勝過任何 `@layer`，會使深色覆寫永不生效

#### Scenario: a11y 降級齊備

- **WHEN** 檢查 `css/tokens.css`
- **THEN** SHALL 存在 `@media (prefers-reduced-transparency: reduce)`、`@media (prefers-contrast: more)`
  與 `@supports not (backdrop-filter: …)` 三個降級 block

---

### Requirement: dark mode 覆寫不得冗餘

若 base 規則已使用 `var(--token)` 且該 token 在 `body.dark` 中已有覆寫值，則 SHALL NOT 另寫 `body.dark .class { property: var(--token); }` 規則（冗餘，因 token 值已自動切換）。

#### Scenario: 無冗餘 dark mode 覆寫

- **WHEN** 靜態分析所有 CSS 檔案
- **THEN** `body.dark .class` 規則中的屬性值若與 base 規則完全相同（皆為同一 `var(--token)`），該規則 SHALL 被移除

---

### Requirement: color: #fff 改用語意 token

CSS 中 `color: #fff` / `color: #FFF` / `color: #ffffff` SHALL 改為 `color: var(--text-on-accent)`。

例外：brand icon 選擇器（`.g-icon`、`.n-icon`）及 color mode preview（`.cmp-*`）。

#### Scenario: 無硬寫 color: #fff

- **WHEN** 靜態分析所有 CSS 檔案（排除 `:root`、`body.dark`、print mode、brand icon）
- **THEN** 不得出現 `color: #fff` 或等效硬寫值

---

### Requirement: 4pt grid spacing

所有 `margin`、`padding`、`gap` 的 px 值 SHALL 為 4 的倍數。

例外：
- 裝飾性 pseudo-element（`::before`/`::after`）中的 `.ov-card h4::before`、`.cmp-*`
- scrollbar 元素
- `@page` print margin
- 使用 `var()` 或 `calc()` 的值

#### Scenario: padding 值為 4 的倍數

- **WHEN** 靜態分析所有 CSS 檔案中的 `padding` 相關宣告
- **THEN** 所有 px 值 SHALL 為 4 的倍數（0 除外）

#### Scenario: margin 值為 4 的倍數

- **WHEN** 靜態分析所有 CSS 檔案中的 `margin` 相關宣告
- **THEN** 所有 px 值 SHALL 為 4 的倍數（0 除外）

#### Scenario: gap 值為 4 的倍數

- **WHEN** 靜態分析所有 CSS 檔案中的 `gap` 相關宣告
- **THEN** 所有 px 值 SHALL 為 4 的倍數（0 除外）

---

### Requirement: CSS HIG 回歸測試自動守護

`tests/unit/css-hig.test.js` SHALL 包含至少 12 條自動化靜態分析測試，涵蓋上述所有 HIG 紀律規則。每次 CSS 變更須通過所有測試。

#### Scenario: npm test 包含 CSS HIG 測試

- **WHEN** 執行 `npm test`
- **THEN** `css-hig.test.js` 中所有測試 SHALL 通過
