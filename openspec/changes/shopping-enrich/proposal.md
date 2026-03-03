## Why

四趟行程的購物資訊品質不一致：Onion 和 RayHus 使用結構化的 `shopping` infoBox（含 category/hours/mustBuy/blogUrl），但 Ray 和 HuiYun 仍使用舊式 `souvenir` type（僅 name/note/location，缺乏結構化欄位）。此外，多數飯店缺少附近超市/超商/唐吉軻德資訊，景點附近的購物點也未標注。需統一格式並補齊資料。

## What Changes

- 廢棄 `souvenir` infoBox type，全部統一為 `shopping` type（`shops[]` 陣列）
- Ray 行程：3 個 souvenir infoBox 轉換為 shopping + 飯店附近購物 infoBox + 來客夢 shopping infoBox + 修復 "?" 前綴
- HuiYun 行程：1 個 souvenir infoBox 轉換 + 3 間飯店全空 subs 補齊（超市/超商/停車場）+ ~6 個購物行程新增 shopping infoBox
- RayHus 行程：確認飯店停車場 + 景點附近購物點檢查
- Onion 行程：mustBuy 補到 3 項 + 景點附近購物點檢查
- 四趟行程共通：景點附近若有超市或唐吉軻德，補 shopping infoBox
- 自駕行程飯店確認停車場資訊（subs 保留停車場，購物搬到 infoBox）
- 超商 shop entry：提供 mustBuy + blogUrl，不提供 titleUrl
- 所有 shop item 不加 titleUrl（官網）
- 更新 render-trip.md skill 的 R7 描述

## Capabilities

### New Capabilities
（無新增 capability）

### Modified Capabilities
- `trip-enrich-rules`：R7 購物景點推薦規則擴充——新增超商、景點附近超市/唐吉軻德；shop 結構確認 mustBuy + blogUrl（無 titleUrl）；廢棄 souvenir type

## Impact

- **JSON 結構**：`data/trips/*.json` 的 souvenir infoBox 全部轉為 shopping type
- **JS**：`app.js` 的 `renderInfoBox()` case 'souvenir' 可保留向下相容或移除（此次不動 JS）
- **資料**：四個行程 JSON 的購物 infoBox 需補齊/轉換/新增
- **Skill**：`.claude/commands/render-trip.md` 的 R7 區塊需更新
- **checklist/backup/suggestions**：不受影響（購物 infoBox 在 timeline content 內，不影響日程結構）
