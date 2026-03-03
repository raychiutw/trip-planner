## ADDED Requirements

### Requirement: 四級 font-size CSS variables 定義於 shared.css

系統 SHALL 在 `css/shared.css` 的 `:root` 中定義且僅定義以下四個 font-size 變數，任何 CSS 檔案 MUST NOT 使用硬編碼 px/rem/em 作為 font-size 值（icon 內部細節尺寸如 `10px`、`8px` 除外）。

| 變數 | 值 | 用途 |
|------|----|------|
| `--fs-display` | `2.5rem` | 大標題 |
| `--fs-lg` | `1.25rem` | 次標題 |
| `--fs-md` | `1.125rem` | body 預設 |
| `--fs-sm` | `0.875rem` | 輔助文字 |

#### Scenario: 四個變數存在且值正確

- **WHEN** 載入 `css/shared.css`
- **THEN** `:root` 中 SHALL 存在 `--fs-display: 2.5rem`、`--fs-lg: 1.25rem`、`--fs-md: 1.125rem`、`--fs-sm: 0.875rem` 四個變數

#### Scenario: body 預設 font-size 為 --fs-md

- **WHEN** 任何頁面載入完成
- **THEN** `body` 的計算 `font-size` SHALL 等同於 `--fs-md`（`1.125rem` / 18px）

---

### Requirement: 各 CSS 檔案不得出現硬編碼 font-size

`css/style.css`、`css/menu.css`、`css/edit.css`、`css/setting.css` 中的所有 `font-size` 宣告 MUST 使用 `var(--fs-display|lg|md|sm)` 形式，硬編碼 rem/em/px 值（icon 細節除外）SHALL 不存在。

#### Scenario: style.css 無硬編碼 font-size

- **WHEN** 靜態分析 `css/style.css`
- **THEN** 所有 `font-size` 宣告 SHALL 使用 CSS variable，不得出現數值單位（`rem`、`em`、`px`）直接賦值

#### Scenario: menu.css 無硬編碼 font-size

- **WHEN** 靜態分析 `css/menu.css`
- **THEN** 所有 `font-size` 宣告 SHALL 使用 CSS variable，不得出現如 `0.75rem`、`1rem` 等硬編碼值

#### Scenario: edit.css 無硬編碼 font-size

- **WHEN** 靜態分析 `css/edit.css`
- **THEN** 所有 `font-size` 宣告 SHALL 使用 CSS variable，不得出現如 `1.4rem`、`0.9rem`、`0.85em` 等硬編碼值

#### Scenario: setting.css 無硬編碼 font-size

- **WHEN** 靜態分析 `css/setting.css`
- **THEN** 所有 `font-size` 宣告 SHALL 使用 CSS variable，不得出現如 `0.85rem`、`0.82rem` 等硬編碼值

---

### Requirement: 硬編碼值對映至最近視覺比例的變數

font-size 替換時 MUST 依照以下對映規則，以保持最接近原始視覺比例：

- `2.5rem` → `var(--fs-display)`
- `1.4rem`、`1.25rem`、`1.2rem` → `var(--fs-lg)`
- `1.15rem`、`1rem`、`0.9rem`、`0.9em` → `var(--fs-md)`
- `0.85rem`、`0.85em`、`0.82rem`、`0.8em`、`0.75rem` → `var(--fs-sm)`

#### Scenario: 原 1.4rem 標題替換後呈現 --fs-lg

- **WHEN** 原 CSS 中有 `font-size: 1.4rem` 的元素渲染於頁面
- **THEN** 該元素的計算 `font-size` SHALL 等同於 `var(--fs-lg)`（`1.25rem` / 20px）

#### Scenario: 原 0.75rem 小字替換後呈現 --fs-sm

- **WHEN** 原 CSS 中有 `font-size: 0.75rem` 的元素渲染於頁面
- **THEN** 該元素的計算 `font-size` SHALL 等同於 `var(--fs-sm)`（`0.875rem` / 14px）

#### Scenario: icon 內部細節尺寸維持原值

- **WHEN** CSS 中存在專為 icon 內部設計的 `font-size: 10px` 或 `font-size: 8px`
- **THEN** 該宣告 SHALL 維持原硬編碼值，不替換為 CSS variable

---

## MODIFIED Requirements

參考 `openspec/specs/font-size-scale/spec.md`（四級 font-size CSS variables 定義、禁止硬編碼規則）。

### Requirement: 桌機 font-size 覆蓋（media query）

系統 SHALL 在 `css/shared.css` 中新增 `@media (min-width: 768px)` 區塊，在 `:root` 內覆蓋四個 font-size 變數為更小值，使桌機視窗下文字密度更精緻。行動版（< 768px）的基底值 SHALL 維持不變。

| 變數 | 行動版值（:root 基底） | 桌機覆蓋值（media query） |
|------|----------------------|--------------------------|
| `--fs-display` | `2.5rem` | `2rem` |
| `--fs-lg` | `1.25rem` | `1.125rem` |
| `--fs-md` | `1.125rem` | `1rem` |
| `--fs-sm` | `0.875rem` | `0.8125rem` |

#### Scenario: 桌機視窗套用縮小後的 font-size 變數

- **WHEN** 視窗寬度 ≥ 768px
- **THEN** CSS 解析後 `--fs-display` SHALL 為 `2rem`、`--fs-lg` SHALL 為 `1.125rem`、`--fs-md` SHALL 為 `1rem`、`--fs-sm` SHALL 為 `0.8125rem`

#### Scenario: 行動版 font-size 變數不受影響

- **WHEN** 視窗寬度 < 768px
- **THEN** `--fs-display` SHALL 為 `2.5rem`、`--fs-lg` SHALL 為 `1.25rem`、`--fs-md` SHALL 為 `1.125rem`、`--fs-sm` SHALL 為 `0.875rem`（與原 `:root` 基底一致）

#### Scenario: 桌機文字元素反映縮小後的字型大小

- **WHEN** 視窗寬度 ≥ 768px 且渲染使用 `var(--fs-md)` 的 body 文字
- **THEN** 計算後 `font-size` SHALL 等同於 `1rem`（16px），比行動版的 `1.125rem`（18px）小
