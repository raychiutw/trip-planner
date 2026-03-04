## Context

`hotel-render-data-consistency` 完成後，行程 JSON 資料已統一為新格式，但三份文件仍停在舊定義：
- `rules-json-schema.md`：HotelSub 還列兩種格式
- `template.json`：還有 `meta.name`/`meta.themeColor`、subs 空陣列無範例
- `render-trip.md`：R7 沒有列出 category 標準分類

## Goals / Non-Goals

**Goals:**
- 三份文件對齊實際 JSON 格式
- R7 定義 shopping category 7 類標準分類

**Non-Goals:**
- 不改 JS/CSS/HTML
- 不改行程 JSON 資料（已由其他 change 處理）
- 不改測試檔案

## Decisions

### D1：rules-json-schema.md HotelSub 格式

移除「格式一：簡單標籤」（`label/text`），只保留新格式：

```jsonc
{
  "type": "parking",     // 必填："parking"
  "title": "飯店停車場",  // 必填
  "price": "¥500/晚",    // 選填
  "note": "先到先得",     // 選填
  "location": Location    // 選填
}
```

### D2：template.json 更新項目

- 移除 `meta.name`、`meta.themeColor`
- 加入 `meta.tripType: "self-drive"`
- `hotel.subs` 改為含新格式範例（type/title/price/note/location）

### D3：render-trip.md R7 category 定義

在 R7 段落加入一段：

> shop.category 使用標準分類（共 7 類）：超市、超商、唐吉軻德、藥妝、伴手禮、購物中心、Outlet。timeline 景點購物與飯店購物共用同一套分類。

## Risks / Trade-offs

- **文件修改不跑測試** → 無風險，純文字更新
- **render-trip.md 即將被 tp-skill-split 取代** → 先更新 R7 內容，拆 skill 時直接搬過去
