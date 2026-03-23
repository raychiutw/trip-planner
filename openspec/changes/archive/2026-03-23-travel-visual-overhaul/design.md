## Context

行程規劃網站 Phase 1 已完成三套色彩主題（sun / sky / zen）× 淺深切換，CSS 變數（`--theme`、`--bg`、`--card-bg` 等）已就位。目前 `body` 直接使用 `var(--bg)` 純色，缺乏視覺深度；Sticky nav 右側有列印與設定按鈕，但在手機版小螢幕上空間擁擠；Speed Dial 已有 6 個功能項目但僅手機顯示，桌機使用者的快速操作依賴 sidebar，入口路徑不一致。

## Goals / Non-Goals

**Goals:**
- 以 SVG 插畫背景提升旅遊情境感，插畫 opacity 烘托而不干擾閱讀
- 卡片半透明化使底圖透出，增加層次，同時維持文字對比度合規
- Speed Dial 整合列印/設定，消除 nav-actions 的手機版空間問題
- Sticky nav 顯示行程名稱，讓使用者隨時確認當前行程
- 全平台統一使用 Speed Dial 作為主功能入口

**Non-Goals:**
- 不新增 SVG 動畫（效能考量，保持靜態插畫）
- 不修改 sidebar / info-panel 透明度（只處理 timeline 卡片）
- 不變更色彩主題切換邏輯（Phase 1 已完成）
- 不修改 ManagePage / AdminPage / SettingPage 的 nav 結構

## Decisions

### D1：SVG 插畫以 CSS background-image 引用，而非 `<img>` 或 inline SVG

**選擇**：SVG 放 `images/` 目錄，CSS 以 `background-image: url('../images/bg-{theme}-{mode}.svg')` 引用，`background-size: cover; background-attachment: fixed`。

**理由**：
- `background-attachment: fixed` 自然產生視差靜止感，不需 JS
- CSS 類別切換（`.theme-sun`, `.theme-sky`, `.theme-zen`, `body.dark`）即可換圖，無需 React state
- SVG 由瀏覽器快取，切換主題時無閃爍

**替代方案排除**：
- inline SVG：DOM 過大，影響 hydration 效能
- `<img>` 覆蓋層：需額外 z-index 管理，與 backdrop-filter 相容性複雜
- Canvas 動畫：效能成本不符旅遊工具定位

### D2：Opacity 寫入 SVG 而非 CSS

**選擇**：SVG 元素的透明度直接在 SVG 檔案內以 `opacity` 屬性設定（淺色 40–50%、深色 22–30%），CSS 不額外疊加 opacity。

**理由**：SVG 內部各元素（天空、植物、水波）可個別控制透明度，比整體 CSS opacity 更細膩；同時避免 `opacity` 與 `backdrop-filter` 的合成層衝突。

### D3：卡片改用 rgba + backdrop-filter，不用整體 opacity

**選擇**：`#tripContent section` 改為 `background: rgba(255,255,255,0.92); backdrop-filter: blur(6px)`（淺色），深色用 `rgba(var(--bg-secondary-rgb), 0.92)`。

**理由**：整體 `opacity` 會連帶影響子元素文字，造成對比度不合規；`rgba` 僅作用於背景色，文字不受影響。

**注意**：Safari 需 `-webkit-backdrop-filter` 前綴；`backdrop-filter` 在不支援的瀏覽器優雅退化為不透明背景（`rgba` alpha 仍作用）。

### D4：Speed Dial 新增 printer / settings，改由 props 注入 action

**選擇**：`SpeedDial` 接收 `onPrint?: () => void` 與 `settingsHref?: string` props；printer item 呼叫 `onPrint`，settings item 以 `<a href>` 導航。

**理由**：維持 SpeedDial 可測試性（action 從外部注入），TripPage 持有 togglePrint 函式參考，傳入即可；避免 SpeedDial 直接依賴 window.location。

### D5：桌面版 Speed Dial 顯示，移除 `@media (min-width: 768px) { display: none }`

**選擇**：確認 `css/style.css` 中無媒體查詢隱藏 Speed Dial（目前已無此規則，但需驗證並確保桌面版 z-index 與 InfoPanel 不衝突）。

**理由**：Speed Dial 整合列印/設定後，桌面版也需要快速入口；InfoPanel 已固定於右側，與右下角 Speed Dial 無重疊。

## Risks / Trade-offs

- **backdrop-filter 效能**：大量半透明元素在低端 Android 裝置可能造成掉幀。→ 緩解：blur 半徑限 6px，僅套用於可見 section，不套用於隱藏元素
- **background-attachment: fixed 在 iOS Safari 限制**：iOS Safari 對 `background-attachment: fixed` 支援不完整，可能顯示為 `scroll`。→ 緩解：視覺效果仍可接受（插畫隨內容滾動），不影響功能
- **SVG 檔案大小**：每個 SVG 插畫若過於複雜會增加載入時間。→ 緩解：插畫元素控制在 20 個以內，使用簡單幾何路徑，目標每檔 < 8KB
- **nav-brand 資料依賴**：`trip.name` 在 trip 尚未載入時為空，nav 短暫顯示空白。→ 緩解：加 fallback `trip?.name || 'Trip Planner'`，與載入前體驗一致

## Migration Plan

1. 建立 `images/` SVG 插畫（6 檔）
2. 更新 `css/shared.css`：新增卡片透明度規則
3. 更新 `css/style.css`：新增背景插畫 CSS 引用（依主題 + 模式 class 切換）
4. 更新 `src/components/trip/SpeedDial.tsx`：新增 printer / settings item，調整 props 介面
5. 更新 `src/pages/TripPage.tsx`：nav-brand 動態化、移除 nav-actions、傳入新 SpeedDial props
6. 執行 `npm run build` 確認無 TypeScript 錯誤
7. 更新 E2E tests

**回滾策略**：所有變更均可透過 git revert 回滾，SVG 檔案可直接刪除，CSS 變更可還原至 Phase 1 狀態。

## Open Questions

- SVG 插畫風格確認：線條粗細、色系是否與各主題 `--accent` 對齊，還是獨立配色？（建議使用主題 accent 色系的低飽和版本）
- `trip.name` 與 `trip.title` 的差異：哪個更適合顯示於 nav-brand？（建議 `trip.name` 因較短）
- Speed Dial 在桌面版的定位是否需要調整（目前右下角，桌面版 InfoPanel 佔據右側）？
