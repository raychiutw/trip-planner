## Why

全站 CSS accent 色（`--accent: #C4956A`）與瀏覽器 theme-color meta（`#C4704F`）存在色差——一個偏奶茶棕、一個偏赤陶橘。視覺上不統一。同時，edit 頁送出按鈕的紙飛機圖示風格過時，需改為圓形填色向上箭頭（參考 Claude App 風格），並統一深淺模式配色。

## What Changes

- 全站 `--accent` 從 `#C4956A`（奶茶棕）改為 `#C4704F`（赤陶橘），與 theme-color 統一
- 深色模式 `--accent` 從 `#C4845E` 調整為 `#D4845E`（同色相提亮版）
- 同步更新 `--sand`、print-mode 等硬寫的舊色碼
- edit 頁送出按鈕 SVG 從紙飛機改為 filled 向上箭頭（↑）
- 按鈕尺寸（36px）、hover/active 效果、disabled 邏輯維持不變

## Capabilities

### New Capabilities

- `send-button-icon`: edit 頁送出按鈕圖示改為 filled 向上箭頭 SVG

### Modified Capabilities

- `warm-neutral-palette`: 全站 accent 色碼從 #C4956A 系列統一為 #C4704F 系列，深色模式對應調整
- `light-mode-colors`: 淺色模式 accent 相關色值連動更新

## Impact

- **CSS**：`shared.css`（`:root` + `body.dark` 宣告）、`style.css`（print-mode 硬寫值）
- **HTML**：`edit.html`（送出按鈕 SVG path）
- **JS**：無（theme-color meta 已使用 `#C4704F`，不需改動）
- **JSON**：無影響
- **測試**：E2E 測試中若有 accent 色碼斷言需對應更新
