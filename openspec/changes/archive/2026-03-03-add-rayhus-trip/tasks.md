## 1. 建立行程 JSON

- [x] 1.1 建立 `data/trips/okinawa-trip-2026-RayHus.json`，包含完整的 meta、footer、autoScrollDates、weather、days（6 天）、highlights、suggestions 欄位
- [x] 1.2 Day 1：MM926 抵達（17:50）、前往飯店 Living Inn 旭橋駅前
- [x] 1.3 Day 2：KKday 一日遊（08:00~18:15）— 美麗海水族館、古宇利島、鳳梨公園
- [x] 1.4 Day 3：Klook 一日遊（12:30~21:30）— 波上宮、殘波岬、美國村、東南植物樂園
- [x] 1.5 Day 4：換飯店至 THE NEST NAHA → AEON Mall 來客夢（巴士 60 分鐘）
- [x] 1.6 Day 5：iias 沖繩豐崎（巴士）
- [x] 1.7 Day 6：MM925 返台（11:35→14:20）
- [x] 1.8 填入 highlights（AI行程亮點）：summary + tags
- [x] 1.9 填入 suggestions（AI 行程建議）：將行程空白（Day 1 晚上、Day 3 早上、Day 5 時程、Day 6 返程前、唐吉/魚屋安排）依重要性分為 high/medium/low 卡片

## 2. 更新索引

- [x] 2.1 在 `data/trips.json` 新增 RayHus 行程項目

## 3. 驗證

- [x] 3.1 執行 JSON 驗證測試確認格式正確
- [x] 3.2 執行單元測試確認通過
- [x] 3.3 執行 E2E 測試確認通過
