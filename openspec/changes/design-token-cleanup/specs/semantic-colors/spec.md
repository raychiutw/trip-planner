## MODIFIED Requirements

### Requirement: 語意色 CSS 變數命名對齊

本規格延伸 `openspec/specs/semantic-colors/` 的既有要求，新增以下對齊規則：以 `--blue` 為名的顏色別名 SHALL 不再作為語意色使用；所有語意色引用 MUST 改為使用 `--accent`、`--accent-light`、`--accent-muted` 等語意明確的變數名稱。

現有語意色變數（`--error`、`--error-bg`、`--success`）維持原定義不變。

#### Scenario: 語意色選擇器不含舊別名

- **WHEN** 靜態分析所有 CSS 檔案的語意色相關選擇器
- **THEN** `.trip-warnings`、`.trip-warning-item`、`.trip-error`、`.driving-stats-badge`、`.edit-status` 等元素 SHALL 引用 `var(--error)` 或 `var(--error-bg)`，不得引用 `var(--blue)` 或其他別名

---

### Requirement: 深色模式 info-box 統一（更新）

系統 SHALL 以單一通用選擇器統一所有 `.info-box` 型別在深色模式下的背景色，取代原本逐一列舉型別的寫法。

原本的分散選擇器：

```css
body.dark .info-box.reservation,
body.dark .info-box.parking,
body.dark .info-box.souvenir,
body.dark .info-box.restaurants { background: var(--blue-light); }
```

SHALL 替換為：

```css
body.dark .info-box { background: var(--accent-light); }
```

此規則同時覆蓋現有的 `.reservation`、`.parking`、`.souvenir`、`.restaurants`，並自動涵蓋過去缺漏的 `.shopping`、`.gas-station`，以及任何未來新增的型別。

#### Scenario: 所有 info-box 型別在 dark mode 套用相同背景

- **WHEN** 頁面為 dark mode 且渲染任何 `.info-box` 型別（包含 `.reservation`、`.parking`、`.souvenir`、`.restaurants`、`.shopping`、`.gas-station`）
- **THEN** 所有型別的背景色 SHALL 為 `var(--accent-light)`（dark mode 值：`#302A25`）

#### Scenario: .info-box.shopping 在 dark mode 有背景色

- **WHEN** 頁面為 dark mode 且渲染 `.info-box.shopping`
- **THEN** 背景色 SHALL 為 `var(--accent-light)`（`#302A25`），不得為 light mode 的淺色背景

#### Scenario: .info-box.gas-station 在 dark mode 有背景色

- **WHEN** 頁面為 dark mode 且渲染 `.info-box.gas-station`
- **THEN** 背景色 SHALL 為 `var(--accent-light)`（`#302A25`），不得為 light mode 的淺色背景

#### Scenario: 逐一列舉的舊選擇器已移除

- **WHEN** 靜態分析 `css/style.css`
- **THEN** 不得出現 `body.dark .info-box.reservation`、`body.dark .info-box.parking` 等逐一列舉型別的深色覆蓋選擇器；SHALL 改以 `body.dark .info-box` 單一選擇器涵蓋全部型別
