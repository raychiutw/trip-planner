# 命名規範（Naming Rules）

此為唯一權威來源。`openspec/config.yaml` naming 區塊、`tp-code-verify`、`tp-hig` 等均參照此文件。

---

## JS 命名

| 情境 | 規範 | 範例 |
|------|------|------|
| 函式 | camelCase | `renderHotel`, `mapApiDay`, `fetchDay` |
| 本地變數 | camelCase | `tripId`, `currentConfig`, `dayCache` |
| 真常數（不重新賦值） | UPPER_SNAKE_CASE | `DRIVING_WARN_MINUTES`, `TRANSPORT_TYPES` |
| 可變狀態 | camelCase | `trip`, `currentTripId`（不得用 UPPER_CASE） |
| module exports | camelCase | 與函式名一致 |

**可變狀態禁則**：`TRIP`、`CURRENT_TRIP_ID` 等 UPPER_CASE 用於可變狀態是錯誤的，必須改為 camelCase。

---

## CSS 命名

| 情境 | 規範 | 範例 |
|------|------|------|
| class | kebab-case | `day-header`, `tl-event`, `admin-section` |
| custom property | --kebab-case | `--fs-body`, `--radius-md`, `--accent` |

---

## HTML 命名

| 情境 | 規範 | 範例 |
|------|------|------|
| 靜態元素 ID | camelCase | `stickyNav`, `tripContent`, `navPills` |
| 動態 ID（JS 產生） | kebab-case | `day-slot-1`, `hourly-3` |
| data 屬性 | kebab-case | `data-trip-id`, `data-day`, `data-action` |

---

## API 命名

| 情境 | 規範 | 說明 |
|------|------|------|
| DB 欄位 | snake_case | `trip_id`, `day_num`, `travel_type` |
| API response | snake_case | 直接回傳 DB row，不做 camelCase 轉換 |
| trip identifier | tripId | API 統一回傳 `tripId`（非裸 `id`）；`SELECT id AS tripId` |

**防禦性 tripId 禁則**：前端不得出現 `.id || .tripId`，統一用 `.tripId`。

---

## DB→JS 映射（mapRow 規則）

使用 `mapRow()` 統一轉換，不散寫 `if (x.snake) x.camel = x.snake`。

### FIELD_MAP（snake_case → camelCase 重命名）

| DB 欄位 | JS 屬性 |
|---------|---------|
| `body` | `description` |
| `rating` | `googleRating` |
| `must_buy` | `mustBuy` |
| `reservation_url` | `reservationUrl` |
| `travel` (desc) | `travel` (text) |
| `day_of_week` | `dayOfWeek` |
| `self_drive` | `selfDrive` |
| `og_description` | `ogDescription` |

### JSON_FIELDS（JSON string → object，自動 parse）

| DB 欄位 | 說明 |
|---------|------|
| `auto_scroll` | 逗號分隔字串 → array，映射為 `autoScrollDates` |
| `footer_json` | JSON string → object，映射為 `footer` |
| `weather_json` | JSON string → object，映射為 `weather` |
| `parking_json` | JSON string → object，映射為 `parking` |

---

## 速查表

| 情境 | 規範 | 範例 |
|------|------|------|
| JS 函式 | camelCase | `renderHotel`, `mapApiDay` |
| JS 本地變數 | camelCase | `tripId`, `currentConfig` |
| JS 真常數 | UPPER_SNAKE_CASE | `DRIVING_WARN_MINUTES` |
| JS 可變狀態 | camelCase | `trip`, `currentTripId` |
| CSS class | kebab-case | `day-header`, `tl-event` |
| CSS custom property | --kebab-case | `--fs-body`, `--radius-md` |
| HTML 靜態 ID | camelCase | `stickyNav`, `tripContent` |
| HTML 動態 ID | kebab-case | `day-slot-1`, `hourly-3` |
| HTML data 屬性 | kebab-case | `data-trip-id` |
| API DB 欄位 | snake_case | `trip_id`, `day_num` |
| API trip identifier | tripId | `SELECT id AS tripId` |
