## Why

深色模式存在兩個問題：(1) `--card-bg` 在 `body.dark` 中未定義，導致桌機版卡片在深色模式下顯示亮色底 `#EDE8E3`；(2) 亮色模式大量硬編碼 `#C4704F` 而非使用 `var(--blue)`，導致深色模式需要額外寫覆蓋規則，產生約 18 條冗餘的 `body.dark` CSS 規則。

## What Changes

- 在 `body.dark` 補上 `--card-bg: #292624`，修復深色模式卡片白底問題
- 亮色模式中約 8 處硬編碼 `#C4704F` 改為 `var(--blue)`，讓深色模式自動套用 `--blue` 的值
- 刪除約 18 條與 CSS 變數值重複的 `body.dark` 覆蓋規則（跨 style.css / menu.css / edit.css / setting.css）
- 保留真正有差異的深色模式覆蓋規則（如 `.hw-block`、`.info-box.*`、`.menu-drawer` 等）

## Capabilities

### New Capabilities

- `dark-mode-tokens`: 深色模式 CSS 變數完整性與覆蓋規則清理

### Modified Capabilities

- `light-mode-colors`: 將硬編碼色碼改為 CSS 變數引用（`#C4704F` → `var(--blue)`），不改變視覺呈現

## Impact

- 影響檔案：`css/shared.css`、`css/style.css`、`css/menu.css`、`css/edit.css`、`css/setting.css`
- 不影響 JS / HTML / JSON 結構
- 視覺效果：深色模式卡片底色從錯誤的亮色修正為 `#292624`；亮色模式外觀完全不變
- 無 breaking change
