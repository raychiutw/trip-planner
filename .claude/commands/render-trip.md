處理旅伴送出的行程修改請求，自動套用到行程 JSON 並部署。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion。

步驟：
1. git pull origin master
2. gh issue list --label trip-edit --state open --json number,title,body
3. 無 open Issue → 回報「沒有待處理的請求」並結束
4. 依序處理每個 Issue：
   a. 解析 Issue body JSON → 取得 owner, tripSlug, text
   b. 讀取 data/trips/{tripSlug}.json
   c. 依自然語言 text 修改行程 JSON（遵循 CLAUDE.md 規範）
   d. 同步更新 checklist、backup、suggestions
   e. 確認 transit 分鐘數
   f. 執行 git diff --name-only：
      → 只有 data/trips/{tripSlug}.json → OK
      → 有其他檔案被改 → git checkout 還原非白名單檔案
   g. npm test
   h. 通過 → commit push + gh issue comment "✅ 已處理：{摘要}" + gh issue close
   i. 失敗 → git checkout . + gh issue comment "❌ 處理失敗：{錯誤}" + gh issue close

✅ 允許修改的檔案（正面表列，僅此一項）：
   data/trips/{tripSlug}.json

🚫 其他所有檔案一律不得修改，包括但不限於：
   js/*, css/*, index.html, edit.html, data/trips.json, tests/*, CLAUDE.md

## 行程品質規則（R1-R7）

產生或修改行程 JSON 時，自動遵守以下品質規則：

### R1 料理偏好
首次為某行程產生餐廳推薦前，詢問使用者料理偏好（最多 3 類，依優先排序）。第 1 家餐廳對應偏好 1、第 2 家對應偏好 2、第 3 家對應偏好 3。同一趟行程已知偏好不重複詢問。

### R2 餐次完整性
每日 timeline 須包含午餐和晚餐。缺少時插入「餐廳未定」entry 並附 3 家推薦。一日遊團體行程（KKday/Klook 等）不補午餐，晚餐依到達地點。返台日或深夜抵達日依時間判斷。

### R3 餐廳推薦品質
每個 restaurants infoBox 補到 3 家。每家必填 hours（營業時間）、reservation（訂位資訊）、blogUrl（繁中網誌）。營業時間須與用餐時間吻合（不推薦 17:00 開的店當午餐）。

### R4 景點品質
titleUrl 放官網（找不到則不放）。新增 blogUrl 放繁中推薦網誌。infoBoxes 確認含營業時間，且與到訪時間吻合。

### R5 飯店品質
hotel 物件含 blogUrl，放繁中推薦網誌。

### R6 搜尋方式
所有 blogUrl 以 Google「{名稱} {地區} 推薦」搜尋，取第一篇繁體中文文章。優先選 pixnet、mimigo、kafu 等台灣旅遊部落格。

### R7 購物景點推薦
統一使用 `infoBox type=shopping`（不使用 souvenir type）。飯店附近超市/超商/唐吉軻德以 shopping infoBox 結構化顯示（subs 僅保留停車場等非購物項）。超商（步行 5 分鐘內）含 mustBuy + blogUrl。獨立購物行程（來客夢/iias/Outlet/PARCO CITY）同樣附 shopping infoBox。景點附近步行 5~10 分鐘有超市或唐吉軻德時，在該景點 entry 加 shopping infoBox。每個 shop 含 category、name、hours、mustBuy（至少 3 項）、blogUrl。shop 不含 titleUrl。自駕行程飯店 subs 須有停車場資訊。
