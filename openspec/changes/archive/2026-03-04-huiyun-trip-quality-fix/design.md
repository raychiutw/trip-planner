## Context

HuiYun 的沖繩七日遊（`data/trips/okinawa-trip-2026-HuiYun.json`）品質缺漏較多：
- R3：多個 restaurants infoBox 僅 1 家（Day 2/4/5/6），需補到 3 家
- R3：Day 5 晚餐「爐端燒 Uguisu」缺 blogUrl
- R2：部分日程可能缺午餐/晚餐 entry
- transit：Day 1 飛行段缺 type 欄位
- R7：Day 6 購物 infoBox 僅 1 項，需補充

## Goals / Non-Goals

**Goals:**
- 依 R2/R3/R6/R7 規則全面補齊 HuiYun 行程的品質欄位
- 餐廳推薦以 HuiYun 行程當時位置附近、適合用餐時段的店家為主
- 所有 blogUrl 依 R6 搜尋取得繁中網誌

**Non-Goals:**
- 不修改 JS/CSS/HTML
- 不補齊其他行程
- 不調整既有已填妥的餐廳或景點資料
- 不修正 Day 6 時間軸排序問題（屬結構性問題，另案處理）

## Decisions

1. **餐廳補齊策略**：每個僅 1 家的 restaurants infoBox 補到 3 家。新增餐廳依 R1 料理偏好排序（HuiYun 行程偏好尚未明確定義，以沖繩在地料理為主）。
2. **飛行段 transit type**：使用 `"flight"` 作為 type 值，與其他交通工具（car/train/bus）一致的命名風格。若既有行程無 flight type 先例，則查看 Ray 行程慣例。
3. **購物 infoBox 補強**：Day 6 伴手禮推薦從 1 項擴充到至少 3 項 shop，每項含 mustBuy。
4. **R2 餐次判斷**：Day 1（晚間抵達）不補午餐；Day 3（殘波岬一日行程，非團體）需確認午晚餐；Day 7（回程日）依班機時間判斷。

## Risks / Trade-offs

- [餐廳推薦品質] → 以 Google 搜尋確認營業中且評價良好的店家
- [blogUrl 連結可能過期] → 優先選大型部落格平台
- [飛行段 type 值不確定] → 需確認既有 JSON 是否有 flight 先例
