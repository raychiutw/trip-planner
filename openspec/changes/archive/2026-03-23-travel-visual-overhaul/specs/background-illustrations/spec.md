## ADDED Requirements

### Requirement: SVG 背景插畫檔案集
系統 SHALL 提供 6 個 SVG 背景插畫檔案，放置於 `images/` 目錄，命名規則為 `bg-{theme}-{mode}.svg`，涵蓋三個主題（sun、sky、zen）× 兩個模式（light、dark）。每個 SVG 檔案大小 SHALL 小於 8KB，元素數量 SHALL 控制在 20 個以內。

- `sun-light`：椰子樹、太陽光芒、海浪、飛機、雲朵（暖橘黃色系）
- `sun-dark`：同元素，低明度深色版
- `sky-light`：熱氣球、海鷗、雲朵、帆船、海浪（天藍色系）
- `sky-dark`：同元素，低明度深色版
- `zen-light`：鳥居、櫻花枝、飄落花瓣、遠山、禪圓（紫粉色系）
- `zen-dark`：同元素，低明度深色版

SVG 內部元素的透明度 SHALL 直接以 `opacity` 屬性設定：淺色版 40–50%、深色版 22–30%，CSS 不額外疊加 opacity。

#### Scenario: 正確載入 sun-light 插畫
- **WHEN** 使用者選擇 sun 主題且頁面為 light mode
- **THEN** `body` 的 `background-image` SHALL 解析為 `images/bg-sun-light.svg`，插畫可見於頁面背景

#### Scenario: 正確載入 zen-dark 插畫
- **WHEN** 使用者選擇 zen 主題且切換至 dark mode
- **THEN** `body` 的 `background-image` SHALL 解析為 `images/bg-zen-dark.svg`，插畫以低明度深色版本顯示

#### Scenario: SVG 檔案大小合規
- **WHEN** 建置產物產出後檢查 `images/` 目錄中的 SVG 檔案
- **THEN** 每個 SVG 檔案大小 SHALL 小於 8KB

### Requirement: CSS 背景插畫掛載
系統 SHALL 在 `css/style.css` 中以 CSS 選擇器切換背景插畫，使用 `background-image`、`background-size: cover`、`background-attachment: fixed`、`background-position: center` 組合。切換邏輯依賴已有的主題 class（`.theme-sun`、`.theme-sky`、`.theme-zen`）與深色模式 class（`body.dark`）。

```css
/* 示例結構（實際實作時填入各主題） */
body.theme-sun:not(.dark) { background-image: url('../images/bg-sun-light.svg'); }
body.theme-sun.dark       { background-image: url('../images/bg-sun-dark.svg'); }
/* sky / zen 同理 */

body {
  background-size: cover;
  background-attachment: fixed;
  background-position: center;
}
```

#### Scenario: 主題切換時背景插畫同步切換
- **WHEN** 使用者在設定頁切換主題，從 sun 切換至 sky
- **THEN** 行程頁重載後 `body` 的 `background-image` SHALL 對應 sky 主題的 SVG，舊主題插畫 SHALL 不再顯示

#### Scenario: 深淺模式切換時背景插畫同步切換
- **WHEN** 使用者切換深色模式
- **THEN** `body` 的 `background-image` SHALL 從對應主題的 light SVG 切換為 dark SVG（或反之）

#### Scenario: 無主題 class 時不顯示背景插畫
- **WHEN** `body` 未附加任何主題 class（例如主題尚未載入）
- **THEN** 背景插畫 SHALL 不顯示，頁面回退至 `var(--bg)` 純色背景

### Requirement: 列印模式下隱藏背景插畫
系統 SHALL 在列印模式（`.print-mode` class 或 `@media print`）下移除背景插畫，確保列印輸出乾淨。

```css
.print-mode body, @media print { body { background-image: none !important; } }
```

#### Scenario: 列印模式下背景插畫不顯示
- **WHEN** 使用者啟動列印模式（`body` 含 `.print-mode` class）
- **THEN** `body` 的 `background-image` SHALL 為 `none`，背景插畫不出現於列印預覽或輸出
