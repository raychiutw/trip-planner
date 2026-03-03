## MODIFIED Requirements

參考 `openspec/specs/light-mode-colors/spec.md`（CSS 變數定義表、元素對照、focus 樣式）與 `openspec/specs/warm-neutral-palette/spec.md`（全站色彩變數集中於 shared.css）。

### Requirement: Light mode 頁面底色對齊

系統 SHALL 將 `css/shared.css` `:root` 中的以下兩個變數值更新：

| 變數 | 舊值 | 新值 |
|------|------|------|
| `--white` | `#FFFFFF` | `#FAF9F5` |
| `--bg` | `#FFFFFF` | `#FAF9F5` |
| `--gray-light` | `#FAF9F7` | `#FAF9F5` |

`--card-bg: #F5F0E8` SHALL 維持不變，以保留卡片與頁面底色之間的視覺層次對比。dark mode 中 `--white: #292624`、`--bg: #1A1A1A`、`--gray-light: #343130` SHALL 維持不變。

#### Scenario: Light mode 頁面底色為暖米白

- **WHEN** 頁面為 light mode（無 `.dark` class）
- **THEN** `body` 背景色 SHALL 顯示為 `#FAF9F5`（引用 `var(--white)` 或 `var(--bg)`）

#### Scenario: --white 與 --gray-light 值相同

- **WHEN** 載入 `css/shared.css` 且頁面為 light mode
- **THEN** `--white` 與 `--gray-light` 的解析值 SHALL 均為 `#FAF9F5`，不存在細微色差

#### Scenario: 卡片與頁面底色仍有層次差

- **WHEN** 頁面為 light mode 且同時顯示 `body` 背景與 `section`（卡片）背景
- **THEN** `body` 背景（`#FAF9F5`）與卡片背景（`#F5F0E8`）SHALL 呈現可辨識的視覺層次差

---

### Requirement: Light mode accent 改為 Claude 橘

系統 SHALL 將 `css/shared.css` `:root` 中的 `--accent` 值從 `#8B8580` 改為 `#C4956A`。`body.dark` 中的 `--accent: #C4845E` SHALL 維持不變。現有 `--blue: var(--accent)` 別名 SHALL 繼續存在，使所有引用 `var(--blue)` 的選擇器自動繼承新 accent 值。

#### Scenario: Light mode accent 為 Claude 橘

- **WHEN** 頁面為 light mode 且渲染引用 `var(--accent)` 的元素（如 Day header、focus ring、active trip-btn 邊線）
- **THEN** 這些元素的強調色 SHALL 顯示為 `#C4956A`

#### Scenario: Dark mode accent 不受影響

- **WHEN** 頁面為 dark mode（含 `.dark` class）且渲染 `.day-header`
- **THEN** 背景色 SHALL 維持 `#C4845E`（dark mode `--accent`），與本次變更前相同

#### Scenario: --blue 別名繼承新 accent 值

- **WHEN** 頁面為 light mode 且任何選擇器引用 `var(--blue)`
- **THEN** 解析顏色 SHALL 等同於 `var(--accent)`（`#C4956A`）

---

### Requirement: Light mode day-header 背景改為卡片色

系統 SHALL 在 `css/style.css` 中新增一條 light mode 限定規則，讓 `.day-header` 在 light mode 下使用卡片底色與深色文字，與 dark mode 下的橘色背景形成區分。

```css
body:not(.dark) .day-header {
    background: var(--card-bg);
    color: var(--text);
}
```

基底規則 `.day-header { background: var(--blue); color: var(--white); }` SHALL 保持不變（dark mode 繼承此規則顯示橘色）。

#### Scenario: Light mode day-header 顯示卡片底色

- **WHEN** 頁面為 light mode 且渲染 `.day-header`
- **THEN** 背景色 SHALL 為 `var(--card-bg)`（`#F5F0E8`），文字色 SHALL 為 `var(--text)`（`#1A1A1A`）

#### Scenario: Dark mode day-header 維持橘色背景

- **WHEN** 頁面為 dark mode（含 `.dark` class）且渲染 `.day-header`
- **THEN** 背景色 SHALL 為 `var(--blue)`（即 `var(--accent)` → `#C4845E` 橘色），文字色 SHALL 為 `var(--white)`
