## Why

目前系統有三個行程檔（Ray、HuiYun、Onion），需新增第四位旅伴 RayHus 的沖繩六日遊行程。行程資料來源為 docx 檔案，包含完整的航班、飯店、一日遊、購物行程資訊。

## What Changes

- 新增 `data/trips/okinawa-trip-2026-RayHus.json` 行程檔案，包含：
  - 六日行程（2026/3/6 ~ 3/11）：抵達→KKday 一日遊→Klook 一日遊→AEON Mall→iias 豐崎→返台
  - 兩間飯店：Living Inn 旭橋駅前（Day 1-3）、THE NEST NAHA（Day 4-5）
  - 非自駕行程（單軌電車 + 巴士 + 一日遊巴士）
  - highlights（AI行程亮點）與 suggestions（AI 行程建議）
  - weather 天氣資料（那霸為主）
- 更新 `data/trips.json` 索引，新增 RayHus 行程項目
- themeColor 使用 `#E07850`（珊瑚橘）

## Capabilities

### New Capabilities

（無 — 純資料新增，不涉及新功能）

### Modified Capabilities

（無 — 遵循現有 JSON schema，不改變結構或行為）

## Impact

- `data/trips/okinawa-trip-2026-RayHus.json` — 新增檔案
- `data/trips.json` — 新增索引項目
- 不影響 js/css/html，不影響既有行程
