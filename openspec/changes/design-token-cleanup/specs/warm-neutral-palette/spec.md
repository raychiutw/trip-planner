## MODIFIED Requirements

### Requirement: 全站 CSS 色彩變數定義於 shared.css（更新）

系統 SHALL 在 `css/shared.css` 的 `:root` 與 `body.dark` 兩個區塊中集中定義所有色彩 CSS variables，並依照本次重命名規則調整變數定義。舊的 `--blue`、`--blue-light`、`--sand`、`--sand-light` 別名 MUST 刪除，改以語意正確的 `--accent-light` 與 `--accent-muted` 取代。

更新後的完整色彩變數列表（僅列出本次新增與異動項目）：

| 變數 | Light 值 | Dark 值 | 用途 | 變動 |
|------|----------|---------|------|------|
| `--accent` | `#C4704F` | `#D4845E` | 強調色（已存在） | 無異動 |
| `--accent-light` | `#F5EDE8` | `#302A25` | 強調色淺色背景 | 新增（取代 `--blue-light`） |
| `--accent-muted` | `#F5EDE0` | `#302A22` | 強調色柔和背景 | 新增（取代 `--sand-light`） |
| `--blue` | — | — | 茶赭色別名 | **刪除** |
| `--blue-light` | — | — | 淺色別名 | **刪除** |
| `--sand` | — | — | 重複別名 | **刪除** |
| `--sand-light` | — | — | 柔和色別名 | **刪除** |

其餘色彩變數（`--bg`、`--card-bg`、`--hover-bg`、`--bubble-bg`、`--text`、`--text-muted`、`--border`、`--gray`、`--gray-light`、`--white`、`--error`、`--error-bg`、`--success`）維持原定義不變。

#### Scenario: --accent-light 在 light mode 存在且值正確

- **WHEN** 載入 `css/shared.css`
- **THEN** `:root` 中 SHALL 存在 `--accent-light: #F5EDE8`，且 SHALL 不存在 `--blue-light`

#### Scenario: --accent-muted 在 light mode 存在且值正確

- **WHEN** 載入 `css/shared.css`
- **THEN** `:root` 中 SHALL 存在 `--accent-muted: #F5EDE0`，且 SHALL 不存在 `--sand-light`

#### Scenario: --blue 與 --sand 別名已刪除

- **WHEN** 靜態分析 `css/shared.css`
- **THEN** `:root` 中 SHALL 不存在 `--blue`、`--sand` 的宣告（print mode 與 body 覆蓋區塊亦同）

#### Scenario: --accent-light 在 dark mode 正確覆蓋

- **WHEN** `<body>` 元素含有 `.dark` class
- **THEN** `body.dark` 區塊 SHALL 覆蓋 `--accent-light: #302A25`、`--accent-muted: #302A22`

---

### Requirement: 全站 CSS 不得引用已刪除的別名變數

所有 CSS 檔案 MUST 將 `var(--blue)`、`var(--blue-light)`、`var(--sand)`、`var(--sand-light)` 替換為對應的新變數，替換規則如下：

| 舊引用 | 新引用 |
|--------|--------|
| `var(--blue)` | `var(--accent)` |
| `var(--blue-light)` | `var(--accent-light)` |
| `var(--sand)` | `var(--accent)` |
| `var(--sand-light)` | `var(--accent-muted)` |

#### Scenario: style.css 不含舊別名引用

- **WHEN** 靜態分析 `css/style.css`
- **THEN** 檔案中 SHALL 不出現 `var(--blue)`、`var(--blue-light)`、`var(--sand)`、`var(--sand-light)` 字串（print mode 區塊亦同）

#### Scenario: menu.css 不含舊別名引用

- **WHEN** 靜態分析 `css/menu.css`
- **THEN** 檔案中 SHALL 不出現 `var(--blue)`、`var(--blue-light)` 字串

#### Scenario: shared.css focus-visible 使用 --accent

- **WHEN** 靜態分析 `css/shared.css`
- **THEN** `focus-visible` 的 `box-shadow` 宣告 SHALL 引用 `var(--accent)` 而非 `var(--blue)`

#### Scenario: print mode 變數宣告更新

- **WHEN** 靜態分析 `.print-mode` 與 `@media print` 區塊
- **THEN** 區塊中 SHALL 不宣告 `--blue`、`--blue-light`、`--sand`、`--sand-light`（可替換為 `--accent`、`--accent-light`、`--accent-muted`）
