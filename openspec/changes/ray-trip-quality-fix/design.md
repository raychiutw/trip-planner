## Context

Ray 的沖繩之旅行程 JSON（`data/trips/okinawa-trip-2026-Ray.json`）存在 3 處品質缺漏：
- 2 家餐廳缺 `blogUrl`（R3）
- 1 間飯店缺 `url`/blogUrl（R5）

本次為純資料補齊，不涉及程式碼或結構變更。

## Goals / Non-Goals

**Goals:**
- 依 R3/R5/R6 規則補齊 Ray 行程的 `blogUrl` / `url` 欄位
- 所有 blogUrl 以 Google 搜尋繁中推薦網誌取得

**Non-Goals:**
- 不修改 JS/CSS/HTML
- 不補齊其他行程（HuiYun/Onion/RayHus 另案處理）
- 不變動 JSON 結構（僅填值）

## Decisions

1. **直接編輯 JSON 欄位值**：三處缺漏都是已有結構但欄位值為空或遺漏，直接用 WebSearch 搜尋繁中網誌 URL 後填入即可。
2. **搜尋策略依 R6**：Google「{名稱} 沖繩 推薦」，優先選 pixnet、mimigo 等台灣旅遊部落格。
3. **飯店欄位用 `url`**：Ray 行程的 hotel 物件既有慣例是 `url` 欄位（非 `blogUrl`），保持一致。

## Risks / Trade-offs

- [blogUrl 連結失效] → 選擇知名部落格平台（pixnet 等）降低風險
- [搜尋結果不理想] → 若找不到繁中文章則留空，不填入非繁中連結
