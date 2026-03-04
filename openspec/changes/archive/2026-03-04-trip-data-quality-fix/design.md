## Context

四個行程 JSON 審計後發現的機械性品質問題，不涉及外部搜尋、不改動程式碼，純資料修正。

## Goals / Non-Goals

**Goals:**
- 修正所有 `reservation: null` 為 `"不需訂位"`
- 移除空字串 `breakfast.note: ""`
- HuiYun 停車場 subs 補 `price` 欄位
- 修正 R1 餐廳排序使其對齊 foodPreferences

**Non-Goals:**
- 不搜尋補齊 blogUrl（景點 / 飯店）
- 不處理 RayHus 的 lat/lon null（需外部地理資料）
- 不處理 RayHus Day 6 placeholder hotel（需使用者決定）
- 不處理 HuiYun Day 6 還車後行程衝突（需使用者決定）

## Decisions

### D1 reservation: null 統一替換

全部替換為 `"不需訂位"`。因為這些餐廳確實不需要訂位（拉麵店、牛排店、速食等）。

### D2 空 breakfast.note 處理

移除 `"note": ""` 欄位，只保留 `{ "included": true }` 或 `{ "included": null }`。breakfast.note 為選填，空字串無意義。

### D3 HuiYun 停車場 price

從既有 note 欄位提取停車費用資訊。若 note 已包含費用描述（如「免費停車場」），提取為 price。若無費用資訊，標註 `"price": "免費"` 或 `"price": "費用未確認"`。

### D4 R1 餐廳排序

按照各行程 `meta.foodPreferences` 重新排列 restaurants 陣列。第 1 家對應偏好 0、第 2 家對應偏好 1、第 3 家對應偏好 2。若某餐廳 category 不完全匹配偏好文字，以最接近的類別對應。

## Risks / Trade-offs

- [Risk] R1 排序修正需逐一確認 category 與 foodPreferences 的對應 → 以 category 欄位文字判斷，不修改 category 本身
- [Risk] HuiYun 停車場有些可能確實免費 → 保守標註，不假設收費
