## Context

行程資料中有三類 URL 欄位維護成本高、價值低：
- `titleUrl`（MD: `- web:`）— 景點官網，AI 搜尋常失效
- `url`（MD: `- url:`）— 飯店/餐廳連結，同樣不穩定
- `blogUrl`（MD: `- blog:`）— 繁中網誌推薦，最難維護（每次 rebuild 都要重新搜尋驗證）

使用者已有 Google Maps / Apple Maps 連結可到達目的地，這些額外 URL 實際使用率低。

## Goals / Non-Goals

**Goals:**
- 從 MD 資料、build pipeline、前端渲染、品質規則、測試中完整移除 `titleUrl`、`url`（hotel/restaurant）、`blogUrl`
- 簡化 tp-create / tp-rebuild 流程（不再需要搜尋網誌）

**Non-Goals:**
- 不移除 `reservationUrl`（餐廳訂位有實際操作價值）
- 不移除 `googleQuery`、`appleQuery`、`naverQuery`（地圖導航核心功能）
- 不修改 CSS 佈局（僅移除不再使用的 class）

## Decisions

### 1. MD 欄位移除策略

移除以下 MD 語法：
- `- web: URL` → 不再解析
- `- url: URL`（hotel 區段）→ 不再解析
- `- blog: URL`（hotel、timeline event）→ 不再解析
- restaurant 表格 `blog` 欄 → 從表格移除
- shop 表格 `blog` 欄 → 從表格移除

保留不動：
- restaurant 表格 `reservationUrl` 欄
- 所有 `maps`、`mapcode`、`naver` 欄位

### 2. Build pipeline（trip-build.js）

- 移除 `ev.titleUrl` 解析
- 移除 `hotel.url` 解析
- 移除 `ev.blogUrl`、`hotel.blogUrl` 解析
- 移除 restaurant/shop builder 的 `blogUrl` 欄位產出
- 產出的 JSON 不再包含 `titleUrl`、`url`（hotel）、`blogUrl`

### 3. 前端渲染（app.js）

- 移除 `renderBlogLink()` 函式
- 景點標題：移除 `titleUrl` 超連結包裝，直接顯示純文字標題
- 飯店名稱：移除 `hotel.url` 超連結包裝，直接顯示純文字名稱
- 餐廳/商店：移除 `blogUrl` 相關渲染
- `URL_FIELDS` 驗證陣列：移除 `titleUrl`、`url`、`blogUrl`

### 4. CSS 清理

- 移除 `.tl-blog`、`.hotel-blog` 等不再使用的 class（如果存在）

### 5. 品質規則更新

- R3 餐廳推薦品質：移除 `blogUrl` 必填要求
- R4 景點品質：整條規則大幅簡化（移除 titleUrl、blogUrl 相關 scenario）
- R5 飯店品質：移除 blogUrl 相關 scenario
- R6 搜尋方式：整條規則移除（僅服務 blogUrl 搜尋）
- R7 購物景點推薦：shop 移除 `blogUrl` 要求

### 6. 執行順序

```
1. data/examples/day-*.md        先更新範本
2. scripts/trip-build.js          移除 build 解析
3. js/app.js                      移除渲染邏輯
4. css/style.css                  清除殘留 class
5. data/trips-md/*/day-*.md       7 個行程批次清理
6. npm run build                  重建所有 JSON
7. 品質規則 + 測試                 同步更新
8. npm test                       確認全過
```

## Risks / Trade-offs

- **資訊減少** → 使用者失去一鍵到官網/網誌的便利。但 Google Maps 連結已足夠導航，網誌可自行搜尋。可接受的 trade-off。
- **大量檔案異動** → 7 個行程的所有 day 檔案都會被修改。但修改是純刪除、不涉及邏輯變更，風險低。
- **restaurant.url 移除** → 餐廳官網連結也被移除。但 `reservationUrl`（訂位連結）保留，實際操作不受影響。
