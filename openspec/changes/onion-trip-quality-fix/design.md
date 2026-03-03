## Context

Onion 的板橋十五日在地行程（`data/trips/banqiao-trip-2026-Onion.json`）為國內新北市行程，住家非飯店。目前每天僅 2 個 timeline entry，無任何餐廳/購物 infoBox，景點無連結。行程跨 5 個區域（板橋、新莊/三重、中和/永和、土城/樹林、淡水/八里），每區 3 天。

## Goals / Non-Goals

**Goals:**
- 依 R2/R3/R4/R6/R7 為每日補上午餐和晚餐推薦
- 景點補上 titleUrl 和 blogUrl
- 各區域補上在地購物/市場推薦

**Non-Goals:**
- 不補飯店 blogUrl（住家，R5 不適用）
- 不新增 emergency 區塊（國內行程不需要）
- 不增加 timeline entry 數量（僅在既有 entry 上補 infoBox）
- 不修正天氣座標問題（屬另案）

## Decisions

1. **餐廳推薦以各區在地名店為主**：板橋（板橋車站/府中商圈）、新莊/三重（新莊廟街/三重碧華街）、中和/永和（永和豆漿街/中和環球）、土城/樹林（土城日月光/樹林興仁夜市）、淡水/八里（淡水老街/八里左岸）。
2. **午餐晚餐 infoBox 掛在現有 timeline entry**：第 1 個 entry 掛午餐、第 2 個 entry 掛晚餐，不新增額外 timeline entry。
3. **景點 titleUrl 策略**：國內景點多有官方 FB 或 Google Maps 頁面，優先找官網，無官網則不放。
4. **購物 infoBox**：每個區域至少 1 個購物推薦（夜市、百貨、市場等）。

## Risks / Trade-offs

- [15 天 × 2 餐 = 30 組餐廳推薦量大] → 同區域 3 天可部分共用推薦池，避免重複
- [在地小店營業資訊難查] → 盡量以 Google Maps 可查到的店家為主
