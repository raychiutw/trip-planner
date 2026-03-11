## Why

`titleUrl`（景點官網）、`url`（飯店/餐廳連結）、`blogUrl`（繁中推薦網誌）三類 URL 欄位難以維護：AI 搜尋到的連結經常失效或不準確，每次 rebuild 都要重新驗證，投入大量時間卻無法保證品質。使用者實際上可以透過 Google Maps 連結或自行搜尋取得這些資訊，移除後可大幅簡化資料結構與 tp-create/tp-rebuild 流程。

## What Changes

- **移除 MD 欄位**：`- web:`（→ titleUrl）、`- url:`（→ url）、`- blog:`（→ blogUrl）從所有 day-*.md 移除
- **移除 MD 表格欄位**：restaurant 表格的 `blog` 欄、shop 表格的 `blog` 欄
- **移除 build 邏輯**：trip-build.js 中解析 `web`、`url`、`blog` 的程式碼
- **移除渲染邏輯**：app.js 中 `renderBlogLink()`、`titleUrl` 超連結、`hotel.url` 超連結、restaurant/shop 的 `blogUrl` 渲染
- **移除 CSS**：`blogUrl` 相關樣式（如 `.tl-blog`、`.hotel-blog`）
- **更新品質規則**：trip-quality-rules.md 中 R4 blogUrl 相關規則
- **更新範本**：`data/examples/day-*.md` 同步移除
- **更新測試**：schema/quality/render 測試移除相關驗證
- **保留不動**：`reservationUrl`、`googleQuery`、`appleQuery`、`naverQuery`
- checklist/backup/suggestions 不受影響（這些欄位不存在於 checklist/backup/suggestions）

## Capabilities

### New Capabilities

（無新增功能）

### Modified Capabilities

- `trip-enrich-rules`：移除 R4 blogUrl/titleUrl 相關規則，移除 R3 餐廳 `blogUrl` 必填要求，移除 R5 shop `blogUrl` 要求
- `trip-data-normalization`：JSON 結構移除 `titleUrl`、`url`（hotel/restaurant）、`blogUrl` 欄位

## Impact

- **資料檔**：`data/trips-md/*/day-*.md`（7 個行程所有 day 檔案）
- **範本檔**：`data/examples/day-*.md`
- **Build**：`scripts/trip-build.js`
- **前端**：`js/app.js`、`css/style.css`
- **品質規則**：`.claude/commands/trip-quality-rules.md`
- **測試**：`tests/json/schema.test.js`、`tests/json/quality.test.js`、`tests/unit/render.test.js`、`tests/integration/render-pipeline.test.js`
- **記憶檔**：`rules-md-format.md` 同步更新
