# Challenge Report (Post-QC) — post-ux-fixes-round2

**Challenger**: Challenger (Post-QC)
**Date**: 2026-03-20
**基於**: Reviewer APPROVE + QC 9 PASS / 1 WARN / 1 PARTIAL

---

## C-PQ1. 線上版截圖比對缺口 — deploy 後需重新驗證

**視角**: 3 品質 / 8 相容性
**嚴重度**: 🟡中

**問題**: QC 報告第 2 項「截圖比對」為 PARTIAL，因線上版尚為舊版，無法比對 SpeedDial 4x2 垂直佈局、FAB 三角形 SVG、label 兩字化、交通統計卡片/表格切換、InfoPanel 圓角等所有視覺變更。本地程式碼只做了靜態分析確認，並未在真實瀏覽器中渲染比對。

**質疑**: Round 2 的核心就是 UX 視覺修正。如果 deploy 後不補做截圖比對驗證，等同最重要的交付物沒有經過視覺回歸測試。靜態分析能確認程式碼正確性，但無法捕捉 CSS 計算、字體渲染、響應式斷點在真實環境中的表現差異。

**建議**: Deploy 後安排一輪輕量視覺驗證（至少桌機 1280 + 手機 390 兩種尺寸），針對本輪變更的 SpeedDial、DrivingStats、InfoPanel、Countdown 四個元件截圖比對。

---

## C-PQ2. clsx 型別宣告問題 — 長期技術債風險

**視角**: 2 程式 / 3 品質
**嚴重度**: 🟡中

**問題**: `npx tsc --noEmit` 有 10 個 `TS2307: Cannot find module 'clsx'` 錯誤，影響 DayNav、DrivingStats、Hotel、HourlyWeather、InfoSheet、MapLinks、SpeedDial、TimelineEvent、ManagePage、SettingPage — 共 10 個檔案。QC 確認為 pre-existing 問題，非本輪引入。

**質疑**: 雖非本輪引入，但這 10 個錯誤已存在多輪未修。每輪 QC 都標註「pre-existing」然後跳過。隨著更多檔案引入 `clsx`（本輪 DrivingStats 新增），受影響檔案持續膨脹。tsc 型別檢查形同虛設 — 如果有新增的真實型別錯誤，會淹沒在這 10 個噪音中。

**建議**: 在下一輪修復中用 `npm install --save-dev @types/clsx` 或在專案 `src/types/` 新增 `declare module 'clsx'` 一行解決。成本極低（<5 分鐘），收益是讓 tsc 回到零錯誤狀態。

---

## C-PQ3. TodaySummary `<li>` 缺 onKeyDown — 無障礙缺陷

**視角**: 7 無障礙
**嚴重度**: 🟡中

**問題**: `TodaySummary.tsx:23-28` 為 `<li>` 元素設置了 `role="button"` + `tabIndex={0}` + `onClick`，但缺少 `onKeyDown` handler。原生 `<button>` 元素會自動處理 Enter/Space 觸發 click，但 `<li role="button">` 不會。鍵盤使用者 Tab 到該元素後按 Enter 或 Space，什麼都不會發生。

**質疑**: Reviewer 已標記此問題但歸類為「非阻擋」。然而 WCAG 2.1 SC 2.1.1（Keyboard）要求所有可操作元素必須可由鍵盤觸發。既然我們主動加了 `role="button"` 和 `tabIndex={0}`，就是在宣告這是一個可互動元素，卻不提供鍵盤支援，比完全不加 role/tabIndex 更糟 — 它會吸引鍵盤焦點但無法操作，造成困惑。

**建議**: 本輪應一併修復。修改量極小 — 新增一個 `onKeyDown` handler，在 Enter/Space 時呼叫 `onEntryClick?.(i)` 即可（約 3 行程式碼）。

---

## C-PQ4. #22 hover padding 只套用 3 個元素 — 與 Key User 指令的落差

**視角**: 1 需求
**嚴重度**: 🟢低

**問題**: tasks.md #22 描述為「全站可點擊元素 hover 色塊加 padding + negative margin + border-radius」。Engineer G 實際只新增/修改了 3 個元素（`.col-row`、`.today-summary-item`、`.hw-summary`），其餘 8 個評估後判定「已足夠，不動」。

**質疑**: Engineer G 的逐一評估策略是合理的（Reviewer 也認可），大多數元素確實已有足夠 padding。但這個「逐一評估」的過程和結論沒有回報給 Key User 確認。Key User 說「全站套用」，工程師自行判斷只做了 3 個 — 如果 Key User 對某些「已足夠」的元素有不同看法（例如 `.download-option` 的 `padding: 12px 8px` 是否真的「足夠」），目前沒有機制得知。

**建議**: PM 將 Engineer G 的評估表（哪些做了、哪些保持不動及原因）呈報 Key User 確認，避免 deploy 後才發現遺漏。

---

## C-PQ5. #1 ThemeArt 標記 no-op — Key User 看到的問題未被解釋

**視角**: 1 需求 / 9 資料完整
**嚴重度**: 🟡中

**問題**: Engineer I 分析 ThemeArt.tsx 程式碼後確認 content map 的 12 個 key 與 6 主題 x 2 模式完全匹配，標記為 no-op。根因推測為「build 產物過時或 worktree 未合併」。

**質疑**: Key User 提出 #1 時，是因為實際看到了某種視覺問題。Engineer I 的分析證明程式碼邏輯正確，但「根因推測」停留在推測層面 — 沒有實際驗證是 build cache、CDN cache、還是 worktree 合併問題。如果根因是 build 產物過時，那 deploy 後問題會自動消失；但如果是其他原因（例如某個主題在特定條件下 fallback 到錯誤的 SVG），deploy 後問題可能重現。

**建議**: Deploy 後 QC 應特別驗證 ThemeArt 在所有 6 主題（sun/sky/zen/forest/sakura/ocean）x 2 模式（light/dark）下的渲染結果，確認 Key User 回報的問題已消失。如仍存在，需重新調查。

---

## C-PQ6. 交通統計 `.ds-table-label` 使用 `!important`

**視角**: 2 程式
**嚴重度**: 🟢低

**問題**: `style.css:337` 使用 `text-align: left !important` 覆蓋同層 `.ds-table td { text-align: center }` 的設定。Reviewer 已標記但歸類為不影響功能。

**質疑**: 在 `@media (min-width: 768px)` scope 內，`.ds-table td` 和 `.ds-table-label` 都是同層級的選擇器。`.ds-table-label` 的 class specificity (0,1,0) 高於 `.ds-table td` 的 type+class specificity (0,1,1) — 等等，實際上 `.ds-table td` 是 (0,1,1)，`.ds-table-label` 是 (0,1,0)，所以 `.ds-table td` 的特異性更高，因此確實需要 `!important` 或更高特異性寫法。

可替代方案：`.ds-table td.ds-table-label { text-align: left; }` — 特異性 (0,2,1)，無需 `!important`。但這只是風格偏好，功能完全正確。

**建議**: 不阻擋。如果團隊希望維持零 `!important`（print 規則除外），後續可改用 `.ds-table td.ds-table-label` 提升特異性。

---

## C-PQ7. ThemeArt 1016 行 inline SVG — 長期膨脹風險

**視角**: 5 效能 / 2 程式
**嚴重度**: 🟢低

**問題**: `ThemeArt.tsx` 為 1016 行，包含 329 個 SVG shape 元素（path/circle/rect 等），覆蓋 12 種主題變體（6 主題 x 2 模式）x 4 種用途（DayHeader/Divider/Footer/Nav）。每次新增主題或用途，行數線性增長。

**質疑**: 目前 QC 測量 DOM Interactive 49ms，效能完全無問題。但 ThemeArt 的 SVG 是 inline JSX — 每個 path 都會進入 React VDOM diff。如果未來主題數從 6 增至 10+，或新增更複雜的 SVG（動畫、漸層），這個檔案可能膨脹到 2000+ 行且影響 bundle size。

**建議**: 不阻擋本輪。但如果未來計畫新增主題，建議考慮將 SVG 抽為靜態檔案（`.svg`）+ `<img>` 或 `dangerouslySetInnerHTML`，避免 VDOM diff 成本。目前 6 主題完全可控。

---

## C-PQ8. TRIP_TIMEZONE 硬編碼 — 新行程擴充性

**視角**: 9 資料完整 / 2 程式
**嚴重度**: 🟡中

**問題**: `TripPage.tsx:173-178` 的 `TRIP_TIMEZONE` 是硬編碼的 4 個 prefix → timezone mapping。目前 7 個行程都能正確匹配（okinawa x4、kyoto x1、busan x1、banqiao x1），但這個 mapping 需要手動維護。

**質疑**: 如果使用者新增一個不在 mapping 中的行程（例如 `bangkok-trip-2026-xxx`），`getLocalToday` 會 fallback 到使用者本地時區。對於同時區的使用者（如台灣使用者看曼谷行程，UTC+7 vs UTC+8）會有 1 小時差異，在午夜前後可能導致 auto-scroll 定位到錯誤的日期。

Reviewer 已標記此問題（建議 #4），但歸類為非阻擋。考慮到 `meta.md` 或 `meta.json` 中可能已有目的地資訊，理想方案是從行程資料中讀取時區，而非硬編碼。

**建議**: 不阻擋本輪。但 PM 應將此列入技術債追蹤，在新增非東亞行程前解決。短期可在 mapping 中新增常見目的地（bangkok → Asia/Bangkok、tokyo → Asia/Tokyo 等）作為緩衝。

---

## C-PQ9. Firefox / WebKit 未測試

**視角**: 8 相容性
**嚴重度**: 🟢低

**問題**: QC 報告第 5 項跨瀏覽器測試僅在 Chromium 完成，Firefox/WebKit 未測試（受限於本地環境無法啟動 dev server）。

**質疑**: 本輪修改涉及 CSS Grid（SpeedDial 4x2）、`overscroll-behavior`、`scrollbar-gutter`、`Intl.DateTimeFormat` 等特性。這些在 Firefox/Safari 的行為可能有細微差異：
- `overscroll-behavior: contain` — Firefox/Safari 支援良好，低風險
- CSS Grid `grid-auto-flow: column` — 全瀏覽器一致，低風險
- `Intl.DateTimeFormat('sv-SE', { timeZone })` — Safari 16+ 支援，低風險
- `scrollbar-gutter: stable` — Firefox 97+/Safari 不支援（graceful degradation）

整體風險不高，但有一個邊緣案例：SpeedDial label 的 `position: absolute; right: calc(100% + 8px)` 在 Safari 上的 containing block 計算可能不同。

**建議**: Deploy 後在 Safari（iOS）上快速驗證 SpeedDial 展開狀態的 label 位置。

---

## 總結

| # | 項目 | 嚴重度 | 是否阻擋 |
|---|------|--------|---------|
| C-PQ1 | Deploy 後需重新截圖比對驗證 | 🟡中 | 否（deploy 後追蹤） |
| C-PQ2 | clsx 型別宣告 — tsc 噪音持續膨脹 | 🟡中 | 否（下輪修復） |
| C-PQ3 | TodaySummary 缺 onKeyDown — a11y 缺陷 | 🟡中 | **建議本輪修復**（3 行程式碼） |
| C-PQ4 | #22 hover padding 評估結果需回報 Key User | 🟢低 | 否（PM 確認即可） |
| C-PQ5 | ThemeArt no-op 根因未實證 — deploy 後需驗證 | 🟡中 | 否（deploy 後追蹤） |
| C-PQ6 | `!important` 可改用高特異性選擇器 | 🟢低 | 否 |
| C-PQ7 | ThemeArt 1016 行 inline SVG 膨脹風險 | 🟢低 | 否（未來擴充時處理） |
| C-PQ8 | TRIP_TIMEZONE 硬編碼擴充性 | 🟡中 | 否（技術債追蹤） |
| C-PQ9 | Firefox/WebKit/Safari 未測試 | 🟢低 | 否（deploy 後快速驗證） |

**本輪無 🔴 高嚴重度項目。** 建議本輪順便修復的只有 C-PQ3（TodaySummary onKeyDown），其餘可在 deploy 後追蹤或列入技術債。
