## Context

四趟行程的購物資訊存在兩套不一致的結構：`shopping`（Onion/RayHus，有 category/hours/mustBuy/blogUrl）和 `souvenir`（Ray/HuiYun，僅 name/note/location）。Ray 的飯店 subs 有購物文字但未結構化，HuiYun 的飯店 subs 全空。景點附近的超市/唐吉軻德資訊也未標注。

## Goals / Non-Goals

**Goals:**
- 統一所有購物 infoBox 為 `shopping` type
- 飯店附近購物資訊改用 shopping infoBox（subs 僅保留停車場等非購物項）
- 四趟行程景點附近超市/唐吉軻德補 shopping infoBox
- 超商 shop entry 含 mustBuy + blogUrl
- 更新 render-trip.md skill R7

**Non-Goals:**
- 不改 JS/CSS（`renderInfoBox` 的 souvenir case 保留向下相容）
- shop item 不加 titleUrl
- 不動 Onion/RayHus 既有的 shopping infoBox（僅補缺）

## Decisions

### D1：廢棄 souvenir，統一 shopping

**選擇**：Ray/HuiYun 的 `souvenir` infoBox 全部轉為 `shopping` type

```json
// Before (souvenir)
{ "type": "souvenir", "items": [{ "name": "...", "note": "..." }] }

// After (shopping)
{ "type": "shopping", "title": "...", "shops": [
  { "category": "...", "name": "...", "hours": "...", "mustBuy": [...], "blogUrl": "..." }
]}
```

**理由**：`renderShop()` 已支援 category/hours/mustBuy/blogUrl/location，功能遠比 souvenir 渲染器完整。統一後維護成本降低。

### D2：飯店 subs 購物 → shopping infoBox

**選擇**：飯店 subs 中的超市/超商/唐吉軻德文字搬到飯店 timeline entry 的 shopping infoBox，subs 只保留停車場

**理由**：structured data 比純文字更好渲染、更好維護。

### D3：超商 shop entry 結構

**選擇**：超商 entry 與其他 shop 結構一致，含 mustBuy + blogUrl，不含 titleUrl

```json
{
  "category": "超商",
  "name": "ファミリーマート 北谷美浜店",
  "hours": "24H",
  "mustBuy": ["沖繩限定飯糰", "Blue Seal 冰淇淋", "泡盛小瓶"],
  "blogUrl": "https://..."
}
```

**理由**：日本超商有豐富的地區限定商品，mustBuy 和 blogUrl 有實用價值。

### D4：景點附近超市/唐吉軻德判斷標準

**選擇**：景點步行 5~10 分鐘內有超市或唐吉軻德時，在該景點 timeline entry 加 shopping infoBox。購物商場（AEON/iias/PARCO CITY 等）本身就是購物景點，加完整的 shopping infoBox。

**理由**：不是每個景點都需要購物資訊，僅在附近確實有購物點時才加。

### D5：自駕停車場

**選擇**：自駕行程的飯店 subs 確認有停車場資訊（費用 + 地點），無則補上

**理由**：自駕旅客的基本需求。

### D6：修改範圍

**選擇**：只改 `data/trips/*.json` 和 `.claude/commands/render-trip.md`，不改 JS/CSS

**理由**：
- `renderShop()` 已支援所有需要的欄位
- souvenir case 保留向下相容（未來可考慮移除）
- 避免觸動 JS 導致測試風險

## Risks / Trade-offs

- **[搜尋量大]** → 每個景點都要確認附近有無超市/唐吉軻德，搜尋成本高。用 agent teams 平行處理四趟行程。
- **[超商資料時效性]** → 日本超商開關店頻繁，名稱和位置可能變動。接受此風險，資料以搜尋時為準。
- **[souvenir 向下相容]** → 保留 JS 中的 souvenir case 但不再有資料使用它。未來可在另一個 change 中清理。
