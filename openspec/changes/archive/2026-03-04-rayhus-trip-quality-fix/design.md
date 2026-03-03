## Context

RayHus 的沖繩六日輕旅遊（`data/trips/okinawa-trip-2026-RayHus.json`）為非自駕、公車/電車行程，3/6 即將出發。品質缺漏在四趟行程中最嚴重：R2-R7 幾乎全部不達標。

行程結構：
- Day 1：抵達那霸（晚間）
- Day 2：KKday 一日遊（團體行程）
- Day 3：Klook 一日遊（團體行程）
- Day 4：換飯店、來客夢購物
- Day 5：iias 豐崎購物
- Day 6：返台

## Goals / Non-Goals

**Goals:**
- 全面補齊 R2-R7 所有品質欄位
- 餐廳推薦以那霸市區（旭橋/國際通/美榮橋周邊）為主（非自駕行程活動範圍集中）
- 購物推薦以來客夢和 iias 豐崎為重點

**Non-Goals:**
- 不修改 JS/CSS/HTML
- 不修改行程結構或時間安排
- 不補齊其他行程

## Decisions

1. **一日遊團（Day 2/3）餐廳策略**：依 R2，一日遊不補午餐，但晚餐須依團結束後回到那霸的位置推薦。Day 2 已有晚餐 infoBox，Day 3 缺晚餐需補。
2. **Day 4/5/6 午餐策略**：Day 4 在來客夢有美食街，補午餐推薦；Day 5 在 iias 豐崎，補午餐推薦；Day 6 返台日依班機時間判斷（早班機則不補午餐）。
3. **飯店 url 欄位**：與 Ray 行程一致，使用 `url` 欄位存放 blogUrl。
4. **emergency 區塊**：參照 Ray 行程的 emergency 結構，補上那霸市急診醫院、駐日代表處等資訊。
5. **購物 infoBox 結構**：來客夢和 iias 為大型商場，各補 shopping infoBox 含主要店舖與 mustBuy。

## Risks / Trade-offs

- [工作量最大] → 優先完成餐廳和飯店 blogUrl 等核心欄位，購物和 emergency 次之
- [非自駕行程餐廳範圍有限] → 推薦集中在那霸市區電車/步行可達的店家
