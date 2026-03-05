## Context

行程 JSON 的 timeline event、restaurant、shop 已有 `googleRating` 欄位（數字 1.0-5.0），但 `app.js` 的三個渲染函式完全沒有讀取或顯示這個值。品質規則 R12 目前為 warn 級，部分 POI 仍缺少 rating 資料。

## Goals / Non-Goals

**Goals:**
- 所有 POI（景點、餐廳、商店）在頁面上顯示 `★ 4.5` 格式的 Google 評分
- R12 升級為 strict 級，缺少 googleRating 視為測試失敗
- 補齊所有行程 JSON 中缺少的 googleRating

**Non-Goals:**
- 不顯示評分來源標示（如 "Google"）
- 不做評分排序或篩選功能
- 不改變 schema 驗證（googleRating 在 schema 層仍為選填）

## Decisions

### D1：rating 顯示位置

**景點（renderTimelineEvent）**：在 `tl-title` 後方、blogUrl 之前顯示 `★ 4.5`。

理由：rating 是景點名稱的附加資訊，放在標題行最自然。

**餐廳（renderRestaurant）**：在名稱行（category + name）之後、description 之前顯示。

理由：rating 幫助使用者快速比較同一餐次的多家餐廳。

**商店（renderShop）**：在名稱行之後顯示。

理由：與餐廳一致的模式。

### D2：顯示格式

`<span class="rating">★ 4.5</span>`

- 使用 HTML 實體 `★`（★），不用 inline SVG（因為是裝飾性質，非功能性 icon）
- 數字保留一位小數（JSON 中已是數字型別）
- 若 googleRating 不存在或非數字，不顯示（不顯示空星星）

### D3：CSS 樣式

新增 `.rating` class：
- 顏色：使用 `var(--clr-accent)`（金色系），醒目但不過份
- 字級：`var(--fs-sm)`，作為輔助資訊不搶主體
- 無需獨立行，inline 顯示

### D4：R12 品質規則升級

- `trip-quality-rules.md`：R12 從 SHOULD 改為 SHALL，從 warn 改為 strict
- `trip-enrich-rules/spec.md`：R12 scenarios 中 SHOULD → SHALL、warn → fail
- 不改 `trip-json-validation/spec.md` 的 schema 層（googleRating 在 schema 仍為選填，品質層強制）

### D5：補齊資料策略

用 `/tp-rebuild-all` 重掃所有行程，逐一補上缺少的 googleRating。此 skill 已有品質規則掃描邏輯，升級 R12 後自動涵蓋。

## Risks / Trade-offs

- [rating 數字過時] → Google 評分會變動，但行程規劃用途不需即時準確，靜態值足夠
- [視覺雜訊] → 每個 POI 都加 rating 可能讓版面更擁擠 → 用 `--fs-sm` + 低調色彩降低干擾
