---
name: tp-check
description: Use when validating a trip itinerary against quality rules R0-R18 without modifying files.
user-invocable: true
---

對指定行程逐項檢查 R0-R18 品質規則，輸出紅綠燈驗證 report。只讀不改，不修改任何資料。

⚡ 核心原則：不問問題，直接驗證。

## API 設定

- **Base URL**: `https://trip-planner-dby.pages.dev`
- **認證**: 讀取操作為公開存取，無需認證

## 輸入方式

- 指定 tripId：`/tp-check okinawa-trip-2026-Ray`
- 未指定：呼叫 `GET /api/trips` 列出所有行程供選擇

## 步驟

1. 讀取行程資料：
   ```bash
   # 讀取 meta
   curl -s "https://trip-planner-dby.pages.dev/api/trips/{tripId}"
   # 讀取所有天概要（取得天數清單）
   curl -s "https://trip-planner-dby.pages.dev/api/trips/{tripId}/days"
   # 依序讀取每天完整資料
   curl -s "https://trip-planner-dby.pages.dev/api/trips/{tripId}/days/{N}"
   ```
2. 逐項檢查 R0-R18 品質規則（API 回傳 JSON，直接驗證 JSON 欄位）
3. 依檢查結果輸出 report（完整模式或精簡模式）

🚫 不修改任何資料。tp-check 是純驗證工具。

## JSON 欄位對照

API 回傳 JSON 格式，直接驗證以下欄位：

| 欄位 | 說明 |
|------|------|
| `location.googleQuery` | R11 地圖導航（原 MD 的 `maps:` 欄位） |
| `googleRating` | R12 評分（原 MD 的 `rating:` 欄位） |
| `meta.countries` | 陣列格式（如 `["JP"]`） |
| `meta.foodPreferences` | 陣列格式 |
| `source` | R13 來源標記（`"ai"` 或 `"user"`） |
| `note` | R15 必填備註 |
| `location.naverQuery` | R14 韓國行程 Naver Maps URL |

## Report 模式

### 完整模式（standalone 或 before/after-fix）

```
══════════════════════════════════════════════
  tp-check Report: {tripId}
  {YYYY-MM-DD HH:mm:ss}
══════════════════════════════════════════════

  Summary:  🟢 N passed  🟡 N warnings  🔴 N failed

──────────────────────────────────────────────
  Rule          Status   Detail
──────────────────────────────────────────────
  R0  JSON結構   🟢
  R1  偏好       🟢
  R2  餐次       🟢
  R3  餐廳品質   🟡     Day 2 午餐只有 2 家推薦
  R4  景點品質   🟢
  R7  購物       🟢
  R8  早餐       🟢
  R10 加油站     🟢
  R11 地圖導航   🟡     12 個景點缺 location
  R12 評分       🔴     28 個地點缺 googleRating
  R13 來源標記   🟢
  R14 國家感知   🟢
  R15 必填note   🟢
  R16 飯店maps   🟡     2 個飯店缺 maps/address
  R17 POI導航    🟢
  R18 飯店phone  🟡     1 個飯店缺 phone
──────────────────────────────────────────────

  🟡 Warnings (N):
  ├── RX: {具體描述}
  └── RY: {具體描述}

  🔴 Failures (N):
  └── RZ: {具體描述}

══════════════════════════════════════════════
```

### 精簡模式（after-edit，嵌入其他 skill 尾部）

```
tp-check: 🟢 10  🟡 2  🔴 0
```

## R2 合格餐次 entry 判定

以下才算「該餐次已安排」：
- timeline entry 的 title 明確包含「午餐」或「晚餐」字樣（如「恩納午餐」「機場晚餐」）
- 一日遊團體行程 entry title 含「午餐（團體行程已含）」（R2 豁免，不附 restaurants infoBox）

以下**不算**合格餐次 entry：
- 其他 entry title 中附帶「含午餐」字樣（如「MEGA唐吉軻德（含午餐）」）→ 這是購物行程，不是正式餐次安排
- description 中提到食物但 title 不含餐次關鍵字
- restaurants infoBox 出現在非餐次 entry 下（如景點附帶推薦，屬加分但不計入餐次）

## 紅綠燈狀態定義

| 狀態 | 符號 | 判定條件 |
|------|------|----------|
| passed | 🟢 | 規則完全符合 |
| warning | 🟡 | 有瑕疵但屬 warn 級，或部分缺失 |
| failed | 🔴 | 不符合 strict 級規則 |

### 各規則嚴重度閾值

| 規則 | 🟢 passed | 🟡 warning | 🔴 failed |
|------|-----------|------------|-----------|
| R0 | 結構完全正確 | — | 任一結構違規 |
| R1 | foodPreferences 存在且餐廳順序對應 | — | 缺 foodPreferences 或順序錯誤 |
| R2 | 所有天數餐次齊全 | — | 任一天缺少應有餐次 |
| R3 | 所有 restaurants infoBox 達 3 家且資料完整 | 部分 infoBox < 3 家，或 category 錯標 | 餐廳缺 hours/reservation |
| R4 | 所有景點有營業時間且吻合 | 開放場所（公共海灘、商圈）無正式 hours | 景點到訪時間在營業時間外 |
| R7 | 所有非家飯店有 shopping(≥3) + parking | 部分 shop 缺 mustBuy 或數量不足 | 飯店完全無 shopping infoBox |
| R8 | 所有 hotel 有 breakfast 欄位 | — | 任一 hotel 缺 breakfast |
| R10 | 自駕行程還車 event 有 gasStation infoBox | — | 自駕行程缺 gasStation |
| R11 | 所有實體地點有 `location.googleQuery` | 1~5 個地點缺 `location.googleQuery` | > 5 個地點缺 `location.googleQuery` |
| R12 | 所有 POI 有 `googleRating` | `source: user` 的 POI 缺 `googleRating` | `source: ai` 的 POI 缺 `googleRating` |
| R13 | 所有非豁免 POI 有 `source` | 1~3 個 POI 缺 `source` | > 3 個 POI 缺 `source` |
| R14 | 韓國行程所有 POI 有 naverQuery；非韓國行程不檢查 | — | 韓國行程 POI 缺 naverQuery |
| R15 | 所有 POI 有 `note` 欄位（含 parking infoBox） | 1~3 個缺 `note` | > 3 個缺 `note` |
| R16 | 所有 hotel POI 有 `maps` + `address` | 1+ 個 hotel 缺 `maps` 或 `address` | — |
| R17 | 所有 POI 至少有 `maps` 或 `lat`+`lng` | — | 任一 POI 兩者皆缺 |
| R18 | 所有 hotel POI 有 `phone` | 1+ 個 hotel 缺 `phone` | — |

## 嵌入其他 skill 的方式

| Skill | 何時執行 tp-check | 模式 |
|-------|-------------------|------|
| `/tp-check` | 獨立執行 | 完整 |
| `/tp-rebuild` | 修正前 + 修正後 | 完整 x2 |
| `/tp-edit` | 修改完成後 | 精簡 |
| `/tp-request` | 每個請求處理完後 | 精簡 |
| `/tp-rebuild-all` | 每趟修正後 | 完整 |

## 常見誤判

| 誤判 | 正解 |
|------|------|
| JSON 中 `location.googleQuery` 不是完整 URL → 判 R11 fail | ❌ `googleQuery` 填搜尋文字即可 |
| JSON 中 `source` 欄位不存在但「整體覆蓋率尚可」→ 判 R13 🟢 | ❌ > 3 個缺失即 🔴 |
| parking infoBox 無 note → 忽略 | ❌ R15 明確包含 parking infoBox |
