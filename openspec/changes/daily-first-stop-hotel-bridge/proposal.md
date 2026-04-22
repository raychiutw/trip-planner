## Why

目前行程頁把「住宿資訊」「每日交通統計」各自獨立顯示成 card，切割了一天的連續感；而行程資料結構也沒把「昨晚睡哪、今天從哪裡出發」寫成 timeline 的一部分，導致旅伴看行程時必須跨區塊推敲「今天幾點從飯店出發」。

把前一日住宿飯店寫成第二天 timeline 的第一個 stop（check-out），讓每天從「退房 → 當日行程 → 再入住」形成連續敘事；同時移除獨立的「住宿資訊」「每日交通統計」card，簡化版面、讓 timeline 成為一日唯一時序主軸。

## What Changes

- **新增規則 R19（每日首 timeline entry）**
  - Day 1 首 entry SHALL 為抵達點（機場 / 車站 / 碼頭）
  - Day N（N ≥ 2）首 entry SHALL 為 Day N-1 住宿 POI 的同 POI check-out entry
  - 最後一天首 entry 為前日飯店 check-out；尾端不設 hotel（沿用 R0）
- **修訂 R2（餐次完整性）**：早餐不強制；午餐 + 晚餐必填維持不變
- **修訂 R8（早餐欄位）**：breakfast 語意不變；明確「同飯店早餐不重複產生 timeline entry，由 hotel.breakfast 表達」
- **擴充 tp-shared travel 語意**：涵蓋「checkout 首站」情境
- **tp-create / tp-rebuild / tp-check / tp-edit skill** 生成、重整、驗證、編輯邏輯套 R19
- **React UI 移除「住宿資訊」「每日交通統計」兩個 card**
  - `DaySection.tsx` 移除 `<Hotel>` 與 `<DayDrivingStatsCard>` 區塊
  - `TripPage.tsx` 移除 `tripDrivingStats` 計算與傳遞
  - `OverflowMenu.tsx` / `TripSheetContent.tsx` 移除「交通統計」action
  - `tripExport.ts` 移除住宿段落、退房時間、CSV 住宿欄
  - `Hotel.tsx` / `DrivingStats.tsx` / `drivingStats.ts` 確認無其他呼叫後刪除
- **BREAKING — 既有 7 個行程資料 migrate**：每日 timeline 必須加入 leading entry，travel 重算
- **刪除 capability `transport-stats-always-open`**：UI 區塊不存在了，對應 spec 作廢

## Capabilities

### New Capabilities

- `daily-first-stop`: 定義每日 timeline 首 entry 規則（R19），涵蓋 Day 1 抵達點、Day N≥2 前日飯店 check-out、最後一天行為；定義前日 check-in + 次日 check-out 同 POI 兩個 entry 的語意、travel 計算方式、edge case（換飯店、連住、入住時間跨日）

### Modified Capabilities

- `trip-quality-rules-source`: R 規則清單新增 R19；修訂 R2（早餐不強制）、R8（breakfast 語意不重複 timeline entry）的敘述細節
- `transport-stats-always-open`: 整份 spec 作廢並刪除（UI 上「每日交通統計」「全旅程交通統計」card 移除後，此 spec 描述的 render/toggle 行為已無對應實作）

## Impact

**Skill 檔案**（`.claude/skills/` 底下，進 PR）：
- `tp-quality-rules/SKILL.md` — 新增 R19、修訂 R2 / R8
- `tp-shared/references/modify-steps.md` — travel 語意擴充
- `tp-create/SKILL.md`、`tp-rebuild/SKILL.md`、`tp-check/SKILL.md`、`tp-edit/SKILL.md` — 行為邏輯套 R19

**React UI**（`src/`，進 PR）：
- `src/components/trip/DaySection.tsx`（移除 Hotel + DayDrivingStatsCard block）
- `src/pages/TripPage.tsx`（移除 tripDrivingStats 計算與傳遞）
- `src/components/trip/OverflowMenu.tsx`、`src/components/trip/TripSheetContent.tsx`（移除交通統計 entry）
- `src/lib/tripExport.ts`（移除住宿段落、退房時間）
- `src/components/trip/Hotel.tsx`、`src/components/trip/DrivingStats.tsx`、`src/lib/drivingStats.ts`（確認後刪除）

**測試**（進 PR）：
- 新增 R19 規則的 unit tests
- 更新既有 DaySection、TripPage、tripExport 測試（對應 card 拿掉 / 住宿欄移除）
- E2E 驗證 timeline 首 entry 渲染

**OpenSpec specs**（進 PR）：
- 新增 `specs/daily-first-stop/spec.md`
- 修改 `specs/trip-quality-rules-source/spec.md`（delta）
- 刪除 `specs/transport-stats-always-open/spec.md`

**行程資料**（走 D1 API，不進 PR，驗收項）：
- 7 個行程 migrate：`okinawa-trip-2026-Ray` / `okinawa-trip-2026-HuiYun` / `okinawa-trip-2026-RayHus` / `okinawa-trip-2026-AeronAn` / `banqiao-trip-2026-Onion` / `busan-trip-2026-CeliaDemyKathy` / `kyoto-trip-2026-MimiChu`
- 每個行程用 `/tp-rebuild` 套新規則，`/tp-check` 全綠

**相依 / 風險**：
- 既有 `trip-quality-rules-source` spec 說「最後一天不得包含 hotel」仍成立（last day 的 `hotel` 欄位不變），R19 只規範 timeline 首 entry，兩規則正交、不衝突
- tripExport CSV 欄位變更會影響既有匯出檔相容性；但匯出為唯讀輸出、無下游自動化，視為可接受
- 7 行程 migrate 期間有短暫「資料混合」狀態（舊行程有首 entry、新行程還沒）；僅本人使用，可接受
