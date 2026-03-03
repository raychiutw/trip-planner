## Why

行程主頁最有價值的資訊是 AI 生成的「行程特色分析」與「行程建議」，但目前 suggestions 被放在所有 Day 之後的 info 區塊，使用者需捲到最底才看得到。將這兩張卡牌提升至 Day 1 之前，讓使用者一進頁面就能看到 AI 分析的行程亮點與建議。

## What Changes

- 新增 `highlights` 欄位於 trip JSON，儲存 AI行程亮點（摘要 100-200 字 + 標籤）
- 將既有 `suggestions` 從 infoSections 移除，改在 Day 1 上方渲染
- 新增 `renderHighlights()` 渲染函式
- 渲染順序：AI行程亮點 → AI 行程建議 → Day 1 → Day 2 → ... → 其餘 info sections
- 兩張卡牌為必顯區塊：若 trip JSON 缺少 highlights 或 suggestions 則顯示錯誤提示
- 更新 `buildMenu()` 導航選單：新增「AI行程亮點」項目、「行程建議」改名為「AI 行程建議」
- 更新 `renderInfoPanel()` 桌機資訊面板
- 為所有 trip JSON 檔案生成 highlights 內容

## Capabilities

### New Capabilities
- `ai-highlights-card`: AI行程亮點卡牌 — JSON 資料結構、渲染邏輯、樣式
- `ai-cards-layout`: 兩張 AI 卡牌在 Day 1 上方的排版與順序

### Modified Capabilities
- `suggestion-visual-priority`: suggestions 從 infoSections 搬移至 Day 1 上方，title 改名為「AI 行程建議」
- `unified-menu`: 導航選單新增「AI行程亮點」、「行程建議」改名為「AI 行程建議」

## Impact

- **JSON**: `data/trips/*.json` — 新增 `highlights` 欄位（okinawa-trip-2026-Ray、okinawa-trip-2026-HuiYun、banqiao-trip-2026-Onion）
- **JS**: `js/app.js` — renderTrip、renderHighlights（新）、renderSuggestions（不變）、buildMenu、renderInfoPanel、validateTripData
- **CSS**: `css/style.css` — highlights 卡牌樣式
- **Tests**: 單元測試需新增 highlights 驗證；E2E 測試需驗證卡牌順序
