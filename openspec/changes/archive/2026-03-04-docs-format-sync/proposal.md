## Why

`hotel-render-data-consistency` 統一了 hotel.subs 新格式、移除 `meta.themeColor`/`meta.name`、定義 shopping category 7 類，但周邊文件（rules-json-schema.md、template.json、render-trip.md）仍停留在舊定義。文件與實際 JSON 格式不一致會導致 `/render-trip`（或未來的 `/tp-rebuild`）產出不合格的行程資料。

## What Changes

1. **rules-json-schema.md** — HotelSub 移除舊格式（格式一 `label/text`），只保留新格式（`type/title/price/note/location`）
2. **template.json** — 移除 `meta.name`、`meta.themeColor`；hotel.subs 改新格式範例；加 `meta.tripType`
3. **render-trip.md** — R7 加入 shopping category 7 類標準分類定義（超市、超商、唐吉軻德、藥妝、伴手禮、購物中心、Outlet）

## Capabilities

### New Capabilities
（無新增）

### Modified Capabilities
- `trip-enrich-rules`: R7 新增 shopping category 標準分類定義（7 類），timeline 購物與飯店購物共用

## Impact

- **文件**：`rules-json-schema.md`（memory）、`data/examples/template.json`、`.claude/commands/render-trip.md`
- **JS/CSS/HTML**：無變更
- **JSON 資料**：無變更（資料面已由 `hotel-render-data-consistency` 處理）
- **測試**：無變更（文件修改不跑測試）
- **checklist/backup/suggestions**：無連動影響
