## Why

全站 CSS 色彩系統存在 24 項問題，橫跨淺色與深色模式。根本原因包括：`--gray-light` 與 `--white` 值相同導致多處 UI 不可見、深色模式大量硬寫色碼未用變數、缺少語意色變數（error/success）與統一 hover 變數、CSS specificity 衝突導致送出按鈕深色模式 bug，以及 `opacity: 0.7` 疊加低對比文字造成可讀性不足。這些問題需要一次性系統化修正，確保兩模式視覺一致且可維護。

## What Changes

### 色彩變數系統擴充
- 修正 `--gray-light` 值，使其與 `--white` 區分（淺色 `#EDEBE8`，深色維持 `#343130`）
- 新增 `--hover-bg` 變數（淺色 `#EDE8E0`，深色 `#3D3A37`），統一全站 hover 底色
- 新增語意色變數：`--error`、`--error-bg`、`--success`，兩模式各一套值

### 深色模式硬寫色碼改為變數
- `body.dark .edit-send-btn` 限定 `:disabled` — 修正 enabled 狀態無橘色 bug
- `body.dark .info-header` 移除 `!important`，改用變數
- `body.dark .hw-block`、`.info-box.*`、`.trip-btn` 改用 `--hover-bg` 或 `--card-bg`
- `body.dark .map-link:hover`、`.apple:hover`、`.mapcode:hover` 統一用 `--hover-bg`

### 淺色模式修正
- `.map-link:hover` 從 `#333` 改為變數方案
- `.map-link.apple` color/fill 從 `#333` 改為 `var(--text)`
- `.edit-input-card` 從 `#FFFFFF` 改為 `var(--white)`
- `.sidebar` border 從 `var(--gray-light)` 改為 `var(--border)`
- `.menu-drawer` 背景從 `var(--gray-light)` 改為 `var(--card-bg)`
- 移除 `.hw-update-time`、`.countdown-date` 的 `opacity: 0.7`

### 兩模式共同修正
- `.sheet-handle` 背景改用 `var(--border)` 確保可見
- `.tl-event::before` border 從 `var(--white)` 改為 `var(--card-bg)`
- `.color-mode-preview` border 改用 `var(--border)`
- `.trip-error`、`.driving-stats-badge` 加入深色覆蓋
- `.status-dot.open` 改用 `var(--success)`
- stickyNav 加 `margin-bottom` 與 Day 1 間隔

## Capabilities

### New Capabilities
- `semantic-colors`: 定義 `--error`、`--error-bg`、`--success` 等語意色 CSS 變數，兩模式各一套值，取代全站硬寫的紅/綠色碼
- `hover-system`: 定義 `--hover-bg` 統一 hover 變數，規範全站互動元素的 hover 底色行為

### Modified Capabilities
- `light-mode-colors`: 修正 `--gray-light` 值使其與 `--white` 區分、修正淺色模式的對比度與不可見元素
- `warm-neutral-palette`: 擴充變數系統，加入 `--hover-bg` 與語意色至 `:root` 與 `body.dark`

## Impact

- **CSS 檔案**：`shared.css`（變數定義）、`style.css`（主頁深淺覆蓋）、`edit.css`（送出按鈕 bug）、`menu.css`（sidebar/drawer 背景與邊線）、`setting.css`（預覽邊線）
- **JS 檔案**：無需變更
- **HTML 檔案**：無需變更
- **JSON 資料**：無需變更
- **測試**：需更新包含舊色碼的測試斷言（如有），E2E 視覺測試可能需要更新 snapshot
