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
