## Why

手機版 sticky-nav 目前 `top: 12px` 有間距，滾動時卡片與頂部之間留白不自然。另外選單展開後漢堡圖示維持不變，缺乏視覺回饋讓使用者知道可以點擊關閉。這兩項是小型 UX 打磨，可以快速上線。

## What Changes

- sticky-nav 置頂無間距：`top: 12px` → `top: 0`，`margin: 12px 0` → `margin: 0`，保留 `border-radius: 12px` 圓角
- 手機選單展開時漢堡 ☰ → ✕ CSS 動畫：利用 `body.menu-open` 觸發 `.dh-menu .hamburger-icon` 三條線旋轉/隱藏，純 CSS 不需改 JS

## Capabilities

### New Capabilities
- `sticky-nav-flush`: sticky-nav 置頂無間距，桌機/手機皆貼齊視窗頂部
- `hamburger-close-animation`: 手機選單展開時漢堡圖示平滑變形為 ✕ 關閉圖示

### Modified Capabilities

（無既有 spec 需要修改）

## Impact

- 影響檔案：`css/style.css`（sticky-nav 定位）、`css/menu.css`（漢堡動畫）
- 不涉及 JS 變更、不涉及 JSON 結構變更
- 桌機與手機皆受影響，需驗證兩種裝置的表現
