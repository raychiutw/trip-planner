---
name: tp-check
description: Use when the user wants to validate a trip itinerary against quality rules R0-R15 and receive a red/yellow/green report without modifying any files.
user-invocable: true
---

對指定行程逐項檢查 R0-R15 品質規則，輸出紅綠燈驗證 report。只讀不改，不修改任何檔案。

⚡ 核心原則：不問問題，直接驗證。

## 輸入方式

- 指定 tripId：`/tp-check okinawa-trip-2026-Ray`
- 未指定：讀取 `data/dist/trips.json` 列出所有行程供選擇

## 步驟

1. 讀取 `data/trips-md/{tripId}/` 下的 MD 檔案（meta.md + day-N.md 等）
2. 逐項檢查 R0-R15 品質規則（定義在 `tp-quality-rules` skill 中）
3. 依檢查結果輸出 report（完整模式或精簡模式）

🚫 不修改任何檔案。tp-check 是純驗證工具。

## MD 欄位與 JSON 欄位對照

tp-check 讀取 MD 原始檔案，品質規則以 JSON 結構定義。以下欄位由 build script 自動轉換，**檢查 MD 時使用 MD 欄位名**：

| MD 欄位 | JSON 欄位 | 轉換說明 |
|---------|----------|---------|
| `maps:` | `location.googleQuery` / `appleQuery` | build 自動加 URL 前綴，MD 只需填搜尋文字 |
| `rating:` | `googleRating` | 欄位改名，值不變 |
| `countries: JP` | `countries: ["JP"]` | 字串轉陣列 |
| `autoScrollDates: 2026-07-01, 2026-07-02` | `autoScrollDates: ["2026-07-01", ...]` | 逗號分隔轉陣列 |
| `foodPreferences: 拉麵, 燒肉, 當地特色` | `foodPreferences: ["拉麵", ...]` | 逗號分隔轉陣列 |

**關鍵：** 檢查 R11 時看 `maps:` 欄位是否存在（不檢查 URL 格式，那是 build 的責任）。檢查 R12 時看 `rating:` 欄位。不要因為 MD 中沒有 `googleQuery` 或 `googleRating` 就判 fail。

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
| R11 | 所有實體地點有 `maps:` 欄位 | 1~5 個地點缺 `maps:` | > 5 個地點缺 `maps:` |
| R12 | 所有 POI 有 `rating:` | `source: user` 的 POI 缺 `rating:` | `source: ai` 的 POI 缺 `rating:` |
| R13 | 所有非豁免 POI 有 `source:` | 1~3 個 POI 缺 `source:` | > 3 個 POI 缺 `source:` |
| R14 | 韓國行程所有 POI 有 naverQuery；非韓國行程不檢查 | — | 韓國行程 POI 缺 naverQuery |
| R15 | 所有 POI 有 `note:` 欄位（含 parking infoBox） | 1~3 個缺 `note:` | > 3 個缺 `note:` |

## 嵌入其他 skill 的方式

| Skill | 何時執行 tp-check | 模式 |
|-------|-------------------|------|
| `/tp-check` | 獨立執行 | 完整 |
| `/tp-rebuild` | 修正前 + 修正後 | 完整 x2 |
| `/tp-edit` | 修改完成後 | 精簡 |
| `/tp-request` | 每個 Issue 處理完後 | 精簡 |
| `/tp-deploy` | 不嵌入 | — |
| `/tp-rebuild-all` | 每趟修正後 | 完整 |

## 常見誤判

| 誤判 | 正解 |
|------|------|
| MD 中 `maps:` 不是完整 URL → 判 R11 fail | ❌ `maps:` 填搜尋文字即可，build 自動補 URL |
| MD 中 `rating:` 不是 `googleRating` → 判 R12 fail | ❌ 欄位名是 MD 格式，build 自動改名 |
| MD 中 `countries: JP` 不是陣列 → 判 R0 fail | ❌ MD 用逗號分隔字串，build 自動轉陣列 |
| 購物 entry「含午餐」→ 視為合格餐次 | ❌ 只有 title 含「午餐」/「晚餐」的專門 entry 才算 |
| 5 個 POI 缺 source 但「整體覆蓋率尚可」→ 判 R13 🟢 | ❌ > 3 個缺失即 🔴 |
| parking infoBox 無 note → 忽略 | ❌ R15 明確包含 parking infoBox |

## 品質規則參照

完整 R0-R15 品質規則定義在 `tp-quality-rules` skill 中。
