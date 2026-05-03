# 命名規範（Naming Rules）

此為唯一權威來源。`openspec/config.yaml` naming 區塊、`tp-code-verify`、`tp-ux-verify` 等均參照此文件。

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

| 層級 | 規範 | 說明 |
|------|------|------|
| DB 欄位 | snake_case | `trip_id`, `day_num`, `travel_type`（SQL / migration 用） |
| API handler 內部 | snake_case | 與 DB 欄位對應，`mergePoi`、`buildUpdateClause` 等用 snake_case |
| **API response** | **camelCase** | `json()` 內建 `deepCamel` 遞迴轉換，所有回應自動 snake→camel |
| API request body | snake_case | 寫入 API 仍接受 snake_case（直接對應 DB 欄位） |
| trip identifier | tripId | API 回傳 `tripId`（非裸 `id`）；`SELECT id AS tripId` |

**轉換機制**：`_utils.ts` 的 `json()` 函式內建 `deepCamel`，遞迴轉換所有 response object key。API handler 不需手動轉換。

**防禦性 tripId 禁則**：前端不得出現 `.id || .tripId`，統一用 `.tripId`。

**前端禁止 snake_case**：`src/` 下的所有 `.ts` / `.tsx` 檔案不得有 snake_case 欄位存取（如 `.sort_order`、`.google_rating`），一律用 camelCase（`.sortOrder`、`.googleRating`）。唯一例外是 JSDoc 註解描述 DB 欄位名稱。

---

## DB→前端 資料流

```
DB (snake_case) → API handler (snake_case) → json(deepCamel) → Response (camelCase) → 前端 (camelCase)
```

- `json()` 負責統一轉換，開發者不需手動呼叫 `mapRow` 或 `snakeToCamel`
- 前端 interface / type 全部用 camelCase（如 `sortOrder`、`dayNum`、`googleRating`）
- 前端 `mapDay.ts` 的 `Raw*` interface 用 camelCase（匹配 API response）

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
| DB 欄位 | snake_case | `trip_id`, `day_num` |
| API handler | snake_case | 內部與 DB 欄位對應 |
| **API response** | **camelCase** | `json()` 自動轉（`sortOrder`, `dayNum`） |
| API request body | snake_case | 寫入用（`sort_order`, `travel_type`） |
| 前端 interface | camelCase | `sortOrder`, `googleRating`, `dayNum` |
