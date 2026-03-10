全面重整單一行程 MD 檔案，依 R1-R12 品質規則逐項檢查並修正。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion。

## 輸入方式

- 指定 tripId：`/tp-rebuild okinawa-trip-2026-Ray`
- 未指定：讀取 `data/dist/trips.json` 列出所有行程供選擇

## 步驟

1. 讀取 `data/trips-md/{tripId}/` 下的所有 MD 檔案
2. **tp-check（before-fix）**：執行完整模式 report，顯示修正前的品質狀態
3. 逐項檢查 R1-R12 品質規則，修正不合格的 MD 內容
4. 同步更新 checklist.md、backup.md、suggestions.md
5. 確認 travel 分鐘數
6. 執行 `npm run build` 更新 dist
7. 執行 `git diff --name-only`：
   → 只有 `data/trips-md/{tripId}/**` + `data/dist/**` → OK
   → 有其他檔案被改 → `git checkout` 還原非白名單檔案
8. `npm test`
9. **tp-check（after-fix）**：執行完整模式 report，確認修正結果
10. 不自動 commit（由使用者決定）

## 重整範圍

檢查現有行程 MD 的每個欄位是否符合 R1-R12，修正不符規則的部分。
**不改 timeline 順序、不新增/移除景點**，只確保現有內容符合品質規則。

僅允許編輯：
  data/trips-md/{tripId}/**

以下為 build 產物，由 npm run build 自動產生，嚴禁手動編輯：
  data/dist/**

## 行程品質規則（R1-R10）

產生或修改行程 MD 時，自動遵守以下品質規則：

### R1 料理偏好
首次為某行程產生餐廳推薦前，詢問使用者料理偏好（最多 3 類，依優先排序）。第 1 家餐廳對應偏好 1、第 2 家對應偏好 2、第 3 家對應偏好 3。同一趟行程已知偏好不重複詢問。

### R2 餐次完整性（航程感知）
每日 timeline 須包含午餐和晚餐。缺少時插入「餐廳未定」entry 並附 3 家推薦。一日遊團體行程（KKday/Klook 等）SHALL 插入午餐 timeline entry（title 為「午餐（團體行程已含）」），不附 restaurants infoBox 推薦。晚餐依到達地點推薦。航程到達日與出發日依航班時間判斷：到達日以到達時間為準（< 11:30 需午餐+晚餐、11:30~17:00 需晚餐、≥ 17:00 晚餐可選）；出發日以出發時間為準（< 11:30 不需午晚餐、11:30~17:00 需午餐、≥ 17:00 需午餐+晚餐）。無 flights 資料時每日皆須午晚餐。

### R3 餐廳推薦品質
每個 restaurants infoBox 補到 3 家。每家必填 hours（營業時間）、reservation（訂位資訊）。營業時間須與用餐時間吻合（不推薦 17:00 開的店當午餐）。

### R4 景點品質
infoBoxes 確認含營業時間，且與到訪時間吻合。

### R7 購物景點推薦
統一使用 `infoBox type=shopping`（不使用 souvenir type）。飯店附近超市/超商/唐吉軻德以 shopping infoBox 結構化顯示。超商（步行 5 分鐘內）含 mustBuy。獨立購物行程（來客夢/iias/Outlet/PARCO CITY）同樣附 shopping infoBox。景點附近步行 5~10 分鐘有超市或唐吉軻德時，在該景點 entry 加 shopping infoBox。每個 shop 含 category、name、hours、mustBuy（至少 3 項）。自駕行程飯店 infoBoxes 須有停車場資訊。

shop.category 使用標準分類（共 7 類，timeline 景點購物與飯店購物共用）：超市、超商、唐吉軻德、藥妝、伴手禮、購物中心、Outlet。

#### 飯店購物 infoBox checklist（兩階段）

**階段 1：驗證既有**
- 所有 shopping infoBox 的 shop.category 是否為 7 類標準分類之一
- 每個 shop 是否含 category/name/hours/mustBuy(≥3)
- 是否有 souvenir type 殘留需改為 shopping

**階段 2：生成缺漏**
- 逐日檢查：hotel 物件是否有 infoBoxes 陣列？
- 若無 infoBoxes 或無 type=shopping → 新建 shopping infoBox
- 搜尋飯店名稱 + 附近超市/超商/唐吉軻德，補到 3+ shops
- shopping infoBox 放在 hotel.infoBoxes，不放在 timeline entry

### R8 早餐欄位
每日 hotel 物件須包含 `breakfast` 欄位。使用者指定飯店含早餐時：`{ "included": true, "note": "早餐說明" }`。自行解決：`{ "included": false }`。未指定：`{ "included": null }`（顯示「資料未提供」）。若查得到飯店最晚退房時間，以 `hotel.checkout` 記錄（如 `"11:00"`）。使用者安排的入退房時間在 timeline events 中，hotel 不重複。

### R10 還車加油站
自駕行程（`meta.tripType` 為 `"self-drive"` 或 `"mixed"`）產生或修改還車 timeline event 時，SHALL 附上最近的加油站資訊。以 `gasStation` infoBox 結構化呈現（含 name、address、hours、service、phone，選填 location）。優先推薦フルサービス（人工加油站），標註 `service: "フルサービス（人工）"`；若附近僅有自助加油站，標註 `service: "セルフ（自助）"`。搜尋方式：Google「{還車地點} 附近 人工加油站」。
