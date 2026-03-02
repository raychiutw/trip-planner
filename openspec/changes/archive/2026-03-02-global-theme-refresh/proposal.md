## Why

現有 CSS 中配色（`--blue: #C4704F` 棕色）與字型大小（兩級變數加大量硬編碼值）缺乏一致系統，維護成本高且視覺風格不統一。本次改版對齊 Claude AI 暖中性色系，並將全站 font-size 整併為四級 CSS variable，消除硬編碼值，提升可維護性與設計一致性。

## What Changes

- **配色**：移除 `--blue: #C4704F` 棕色 accent，改為暖中性色系
  - Light mode：背景 `#FFFFFF`、card-bg `#F5F0E8`、使用者氣泡 `#F0EDE8`、文字 `#1A1A1A`、次要文字 `#6B6B6B`、邊線 `#E5E0DA`
  - Dark mode：背景 `#1A1A1A`、card-bg `#2B2B2B`、使用者氣泡 `#3D3A35`、文字 `#E8E8E8`、次要文字 `#9B9B9B`、邊線 `#3A3A3A`
  - Accent 改為中性暖灰（`--accent: #8B8580`），取代原 `--blue` 用於 Day pills、按鈕、連結、focus ring
- **Font-size**：現有 `--fs-lg: 1.25rem` + `--fs-md: 1.15rem` 兩級加大量硬編碼值，改為四級統一變數：
  - `--fs-display: 2.5rem`（大標題）
  - `--fs-lg: 1.25rem`（次標題，含 1.2rem、1.4rem 統一）
  - `--fs-md: 1.125rem`（body 預設，含 1.15rem、1rem、0.9rem 統一）
  - `--fs-sm: 0.875rem`（輔助文字，含 0.85rem、0.82rem、0.8em、0.75rem 統一）
  - Icon 內部細節尺寸（`10px`、`8px`）維持原樣，不納入變數系統
- 所有 CSS 檔案中的硬編碼 font-size 改為引用上述四級變數

## Capabilities

### New Capabilities

- `warm-neutral-palette`：全站配色切換為暖中性色系，light/dark 雙模式，CSS variables 定義於 `shared.css`
- `font-size-scale`：全站 font-size 統一為四級 CSS variable，禁止硬編碼，定義於 `shared.css`

### Modified Capabilities

- `light-mode-colors`：配色值全面替換（card-bg、accent/blue 等變數值變更），原 `#C4704F` 棕色 accent 改為暖灰色系

## Impact

- `css/shared.css`：CSS variables 定義（`:root` 與 `body.dark`），新增 `--fs-display`、`--fs-sm`，更新既有色彩變數
- `css/style.css`：配色引用更新、所有硬編碼 font-size 替換為 CSS variables
- `css/menu.css`：硬編碼 font-size 替換（`0.75rem`、`1rem` 等）、dark mode 配色更新
- `css/edit.css`：硬編碼 font-size 替換（`1.4rem`、`0.9rem`、`0.85em` 等）、配色更新
- `css/setting.css`：硬編碼 font-size 替換（`0.85rem`、`0.82rem` 等）、配色更新
- 無 JS/HTML/JSON 結構變更，不影響 checklist/backup/suggestions 連動邏輯
