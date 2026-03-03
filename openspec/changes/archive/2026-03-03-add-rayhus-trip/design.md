## Context

目前有三個行程檔：Ray（沖繩五日自駕）、HuiYun（沖繩七日遊）、Onion（板橋散策）。需從 docx 建立第四個行程 — RayHus 的沖繩六日遊。

資料來源：`2026沖繩旅遊.docx`，內容摘要：

| 日期 | 行程 | 住宿 |
|------|------|------|
| 3/6（五） | MM926 台北15:20→沖繩17:50 | Living Inn 旭橋駅前 |
| 3/7（六） | KKday 一日遊：美麗海水族館、古宇利島、鳳梨公園 08:00~18:15 | Living Inn 旭橋駅前 |
| 3/8（日） | Klook 一日遊：波上宮、殘波岬、美國村、東南植物樂園 12:30~21:30 | Living Inn 旭橋駅前 |
| 3/9（一） | 換飯店 → AEON Mall 來客夢（巴士 60 分鐘）~19:00 回 | THE NEST NAHA |
| 3/10（二） | iias 沖繩豐崎（巴士） | THE NEST NAHA |
| 3/11（三） | MM925 沖繩11:35→台北14:20 | — |

其他備註：唐吉壺川店、魚屋直營食堂 魚まる（未安排到特定日期）

## Goals / Non-Goals

**Goals:**
- 建立完整的 `okinawa-trip-2026-RayHus.json`，符合現有 JSON schema
- 包含 meta、footer、autoScrollDates、weather、days、highlights、suggestions
- 更新 `trips.json` 索引

**Non-Goals:**
- 不填充一日遊行程的細節（跟團行程以概要表示）
- 不改動 js/css/html
- 不新增功能

## Decisions

### 1. 行程空白處理方式

Day 1 晚上、Day 3 早上、Day 5 詳細時程、Day 6 返程前等空白，不硬填虛構內容，改為放入 suggestions 的 high/medium/low 建議卡片。

### 2. 一日遊時間軸

KKday/Klook 一日遊以單一 timeline event 表示（集合→返回），內含 infoBox 列出行程景點。不拆成多個獨立景點，因為是跟團行程。

### 3. themeColor `#E07850`（珊瑚橘）

暖色系，與 Ray 海藍、HuiYun 青綠、Onion 灰棕皆不撞色。

### 4. 非自駕交通

timeline 中的 transit 使用 `type: "bus"` 和 `type: "train"`（單軌電車），不含自駕相關的 mapcode 和導航資訊。

### 5. weather 位置

六天都在那霸 ± 中部範圍，以那霸（26.2066, 127.6476）為主要 weather location。Day 2 KKday 一日遊加入本部（美麗海）位置。

## Risks / Trade-offs

- [風險] docx 資訊不含詳細時程（出發/回程時間部分缺漏）→ 以 suggestions 提醒補充
- [風險] 巴士班次/時刻可能變動 → transit.text 註明「約 XX 分鐘」而非精確時刻
