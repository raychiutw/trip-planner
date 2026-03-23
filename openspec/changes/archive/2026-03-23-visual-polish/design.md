## Context

目前主題插畫透過 `body.theme-*` 的 CSS `background-image` 載入 SVG 檔，因 `z-index` 層次被所有卡片元素覆蓋而幾乎不可見。深色模式下因整體亮度降低，插畫更難辨識。晴空（sky）與和風（zen）主題的 `--accent` 色碼在白色背景上對比度偏低，影響可及性與視覺精緻度。sticky nav 的 Day pills 目前緊接在行程名稱後，排版過於緊湊。

## Goals / Non-Goals

**Goals:**
- 插畫嵌入 DOM，置於卡片上層，確實可見
- 深色模式插畫以鮮豔原色呈現，不被暗化
- 晴空/和風淺色 accent 對比度符合視覺設計規範
- Day pills 靠右，改善 nav 呼吸感
- 所有修改通過既有 css-hig.test.js

**Non-Goals:**
- 不修改行程資料結構或 API
- 不調整深色模式 accent（已有足夠對比）
- 不做響應式插畫動畫

## Decisions

### 決策 1：插畫以 inline SVG React 元件實作，而非 CSS background-image 或 `<img>`

**選擇**：建立 `src/components/trip/ThemeArt.tsx`，以 React 元件形式輸出 inline SVG。

**理由**：
- inline SVG 可透過 `opacity`、`currentColor` 等 CSS 屬性直接控制外觀，無需額外 HTTP request
- 可以 props（`theme`、`dark`）控制分支邏輯，型別安全
- 置於 DOM 正確位置後不受 z-index 遮擋，無需 hack

**捨棄方案**：
- `<img src="bg-*.svg">`：無法用 CSS 控制 SVG 內部顏色；仍需管理靜態檔案
- CSS `background-image`（現況）：永遠在 DOM 最底層，被卡片遮擋

### 決策 2：元件拆為三個（DayHeaderArt / DividerArt / FooterArt），統一匯出

**理由**：三種插畫用途不同（標題裝飾 / 分隔線 / 頁尾），高度和 SVG viewBox 差異大，分開封裝可獨立測試、獨立置入 TripPage。

### 決策 3：透明度以 CSS `opacity` 設定於包裝 `<div>`，不嵌入 SVG fill alpha

**理由**：保持 SVG 原色定義清晰；opacity wrapper 方便後續微調，不需重寫 SVG path fill 值。淺色 50–55%、深色 35–45%。

### 決策 4：色碼修改集中於 `css/shared.css`，`useDarkMode.ts` 和 `SettingPage.tsx` 跟進

**理由**：`css/shared.css` 是色碼唯一來源（CSS 變數）；`THEME_COLORS`（meta-theme-color）和 `COLOR_THEMES`（swatch 顯示）為衍生值，須保持一致。

### 決策 5：Nav pills 靠右用 `margin-left: auto`，不改結構

**理由**：`margin-left: auto` 是最小侵入式做法，不需更動 flex container 結構，也不影響 pills 溢出捲動機制（`overflow-x: auto`）。

## Risks / Trade-offs

- [Risk] ThemeArt SVG 數量多（6 主題 × 3 位置 × 2 模式 = 36 個分支），維護成本高
  → 以物件 map `{ [theme]: { light: { header, divider, footer }, dark: {...} } }` 集中管理，未來擴充主題只需加一個 key
- [Risk] inline SVG 增加 DOM 節點，可能影響首次渲染效能
  → 插畫為裝飾性元素，SVG 節點數量可控；使用 `aria-hidden="true"` 排除 a11y 影響
- [Risk] 刪除 `images/bg-*.svg` 後若有其他地方引用會 404
  → 在實作前 grep 全專案確認無其他引用

## Migration Plan

1. 修改色碼（shared.css → useDarkMode.ts → SettingPage.tsx）
2. 刪除 body background-image CSS 規則
3. 建立 ThemeArt.tsx，先以空殼驗證 import 正確
4. 逐一填入 SVG 內容（陽光 → 晴空 → 和風）
5. 在 TripPage.tsx 中引入三個元件
6. 刪除 images/bg-*.svg 靜態檔案
7. 加 margin-left: auto 於 navPills
8. npm run build + npm test

**Rollback**：git revert 相關 commit 即可，無 DB migration，無 API 異動。

## Open Questions

- （無）所有技術決策已明確，可直接進入實作
