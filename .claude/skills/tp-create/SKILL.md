---
name: tp-create
description: Use when the user wants to generate a complete new trip itinerary from scratch given a destination, duration, and travel style.
user-invocable: true
---

從零產生符合品質規則的完整行程，透過 D1 API 建立資料。

⚡ 核心原則：不問問題，直接給最佳解法。遇到模糊需求時自行判斷最合理的方案執行，不使用 AskUserQuestion（料理偏好除外）。

## API 設定

API 設定、curl 模板、Windows encoding 注意事項見 tp-shared/references.md

## 輸入方式

- 指定描述：`/tp-create 沖繩五日自駕`
- 未指定：詢問行程目的地、天數、旅行方式等基本資訊

## 步驟（兩階段生成）

### Phase 0：收集行程基本資訊

建立行程前**必須確認**以下資訊（使用者未提供時詢問）：

| 欄位 | 說明 | 範例 |
|------|------|------|
| **owner** | 行程主人名稱（英文，用於 tripId 和 name） | `Ray`、`HuiYun`、`AeronAn` |
| **destination** | 目的地 | `沖繩`、`釜山`、`板橋` |
| **startDate** | 出發日（YYYY-MM-DD） | `2026-07-29` |
| **endDate** | 回程日（YYYY-MM-DD） | `2026-08-02` |
| **self_drive** | 自駕 or 大眾交通 | `true`（自駕）/ `false`（大眾交通） |
| **food_prefs** | 料理偏好（最多 3 類，依優先排序） | `拉麵, 燒肉, 當地特色` |

以下欄位**自動推導**，不需詢問：

| 欄位 | 推導規則 |
|------|----------|
| `id` (tripId) | `{destination}-trip-{year}-{owner}`（destination 用英文） |
| `name` | `{owner} 的{destination}之旅` |
| `title` | `{year} {destination}{天數}日{自駕遊/大眾交通之旅}行程表` |
| `countries` | 依目的地判斷 ISO 3166-1 alpha-2（日本 `JP`、韓國 `KR`、台灣 `TW`） |
| `description` | 行程完成後自動產生 SEO 摘要（含主要景點、天數、特色） |
| `og_description` | 精簡版 description（≤ 100 字，用於 Open Graph meta） |
| `auto_scroll` | 從 startDate 到 endDate 的逗號分隔日期列表 |
| `footer` | JSON 物件（見下方範例） |
| `published` | 預設 `0`（未發布），行程完成驗證通過後改 `1` |
| `is_default` | 預設 `0` |

#### footer 自動產生規則

```json
{
  "title": "{year} {destination}{天數}日{自駕遊/之旅}",
  "dates": "{M/D（星期）} ~ {M/D（星期）}",
  "budget": "",
  "exchangeNote": "{依國家產生}",
  "tagline": "{依國家產生}"
}
```

| 國家 | exchangeNote | tagline |
|------|-------------|---------|
| JP | `匯率以 1 JPY ≈ 0.22 TWD 估算｜實際費用依當時匯率及消費為準` | `めんそーれ 沖繩！ 祝旅途愉快！`（依地區調整） |
| KR | `匯率以 1 KRW ≈ 0.025 TWD 估算｜實際費用依當時匯率及消費為準` | `{韓文歡迎語}！祝旅途愉快！` |
| TW | `""` | `{依地區調整}` |

### Phase 1：產生骨架

1. 確認 Phase 0 所有必填資訊已收集完畢
1b. 韓國行程須為所有 POI location 新增 `naverQuery`（Naver Maps URL）
2. 讀取品質規則（tp-quality-rules skill）
3. 建立行程（`POST /api/trips`，curl 模板見 tp-shared/references.md）：

   Body: `{id, name, owner, title, description, og_description, self_drive, countries, food_prefs, auto_scroll, footer, published:0, startDate, endDate}`

   POST 會自動建立 trips + trip_days + trip_permissions 記錄。回傳 `{ ok: true, tripId, daysCreated }`。
4. 為每一天產生完整內容（JSON 格式），包含：
   - timeline entries（含 type、title、time、description、location、travel、hotels 等）
   - restaurants infoBox（午餐/晚餐 entry 下各 3 家推薦）
   - shopping infoBox（非家飯店 entry 下）
   - 每個 POI 須包含以下必填欄位：
     - `source: "ai"`（tp-create 產生的行程全部由 AI 推薦）
     - `note: ""`（有備註填內容，無備註填空字串，R15）
     - `location.googleQuery`：實體地點填搜尋文字（R11）
     - `googleRating`：Phase 1 先省略，Phase 2 並行查詢補充（R12）
   - POI V2 各 type 必填/建議欄位見 tp-shared/references.md
   - Markdown 支援欄位見 tp-shared/references.md
5. 每天 hotel 須包含 `checkout` 欄位（從 details 退房時間提取，查不到則為空字串 `""`）
6. 骨架中尚無法確認的欄位**留空**（不使用 null）：`googleRating` 省略欄位，其餘欄位用空字串
7. 依序建立每天資料：

   每天 PUT 的 request body **必須**包含以下三個欄位，缺少任一欄位 API 將回傳 400：
   - `date`（YYYY-MM-DD 格式，必填）：當天日期，例如 `"2026-07-01"`
   - `dayOfWeek`（中文星期，必填）：`"一"` / `"二"` / `"三"` / `"四"` / `"五"` / `"六"` / `"日"`
   - `label`（≤ 8 字，必填）：當日主題，例如 `"抵達那霸"` / `"美麗海水族館"`

   使用 `PUT /api/trips/{tripId}/days/{N}`（curl 模板見 tp-shared/references.md）
8. 建立 docs（flights、checklist、backup、suggestions、emergency）：

   使用 `PUT /api/trips/{tripId}/docs/{type}`，Body: `{content:'...'}`

### Phase 2：並行充填（Agent teams）

9. 對每一天啟動一個 Agent（sonnet），並行執行：
   - 查詢缺少 `googleRating` 的地點/餐廳評分
   - googleRating 查詢策略見 tp-shared/references.md（優先 /browse Google Maps）
   - Agent 透過 `PATCH /api/trips/{tripId}/entries/{eid}` 補充各 entry 的評分資訊（Body: `{googleRating:4.5}`）
10. 收集所有 Agent 完成後確認資料完整
11. 確保不引入 null 值（找不到 → `googleRating` 省略）

### Phase 3：驗證

12. 執行 `/tp-check` 完整模式驗證（透過 API 讀取資料驗證）
13. 回報建立完成摘要

## tripId 命名規則

`{destination}-trip-{year}-{owner}`，例如：`okinawa-trip-2026-Ray`

## 注意事項

- 所有資料均透過 API 建立，不建立本地 MD 檔案
- 不執行 git commit / push（資料已直接寫入 D1 database）
- 不執行 npm run build（無 dist 產物需產生）
