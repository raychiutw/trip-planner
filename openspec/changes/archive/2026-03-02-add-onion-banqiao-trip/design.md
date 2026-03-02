## Context

現有行程 JSON schema 已完善（meta/footer/autoScrollDates/weather/days），新增測試行程只需照格式填入資料。板橋 lat/lon: 25.0146, 121.4672。

## Goals / Non-Goals

**Goals:**
- 產生完整 15 天行程 JSON，結構與現有沖繩行程一致
- 每天固定住宿：家（新北板橋區合宜一路25號四樓之3）
- 每天 1-2 個板橋周邊景點作為 placeholder
- 交通全為開車（type: "car"）

**Non-Goals:**
- 不需真實詳細行程規劃（這是測試資料）
- 不需 mapcode（板橋景點無 mapcode）
- 不需 infoBoxes / restaurant 區塊（簡化）

## Decisions

### 1. 行程日期
2026/4/1（三）~ 4/15（二），共 15 天。autoScrollDates 對應 2026-04-01 ~ 2026-04-15。

### 2. 住宿結構
每天 hotel 固定：
```json
{
  "name": "家",
  "details": ["新北板橋區合宜一路25號四樓之3"]
}
```
不含 url / subs（家不需要停車場、超市資訊）。

### 3. 景點 placeholder
每天 2 個景點，使用板橋/新北實際地標名稱但資料為簡化版：
- Day 1-3: 板橋區（林本源園邸、板橋435藝文特區、板橋車站周邊）
- Day 4-6: 新莊/三重（新月橋、大都會公園、新莊體育場）
- Day 7-9: 中和/永和（四號公園、烘爐地、樂華夜市）
- Day 10-12: 土城/樹林（桐花公園、大安圳步道、山佳車站）
- Day 13-15: 淡水/八里（淡水老街、漁人碼頭、八里左岸）

### 4. Weather 區塊
所有天用板橋 lat/lon (25.0146, 121.4672)，label 用每天的區域名稱。

### 5. 檔案命名
`data/trips/banqiao-trip-2026-Onion.json`，slug: `banqiao-trip-2026-Onion`

## Risks / Trade-offs

- 測試行程 15 天較長，天氣 API 可能只回傳 7 天預報 → 無影響，weather 區塊僅定義 lat/lon，API 回傳幾天就顯示幾天
- 景點名稱為真實地點但資訊簡化 → 可接受，這是測試資料
