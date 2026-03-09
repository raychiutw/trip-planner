## 1. 範本更新

- [x] 1.1 `data/examples/day-*.md`：移除 `- web:`、`- url:`、`- blog:` 行，restaurant/shop 表格移除 `blog` 欄

## 2. Build Pipeline

- [x] 2.1 `scripts/trip-build.js`：移除 `ev.titleUrl`、`hotel.url`、`ev.blogUrl`、`hotel.blogUrl` 解析邏輯
- [x] 2.2 `scripts/trip-build.js`：移除 restaurant/shop builder 的 `blogUrl` 產出、restaurant 的 `url` 產出

## 3. 前端渲染

- [x] 3.1 `js/app.js`：移除 `renderBlogLink()` 函式及所有呼叫處（restaurant、shop、timeline event、hotel）
- [x] 3.2 `js/app.js`：移除 `titleUrl` 超連結包裝，景點標題改為純文字
- [x] 3.3 `js/app.js`：移除 `hotel.url` 超連結包裝，飯店名稱改為純文字
- [x] 3.4 `js/app.js`：移除 restaurant `url` 超連結渲染
- [x] 3.5 `js/app.js`：更新 `URL_FIELDS` 陣列，移除 `titleUrl`、`url`、`blogUrl`
- [x] 3.6 `css/style.css`：移除 `.tl-blog`、`.hotel-blog` 等不再使用的 class（若存在）

## 4. 行程資料清理

- [x] 4.1 所有 `data/trips-md/*/day-*.md`：移除 `- web:` 行
- [x] 4.2 所有 `data/trips-md/*/day-*.md`：移除 `- url:` 行（hotel 區段）
- [x] 4.3 所有 `data/trips-md/*/day-*.md`：移除 `- blog:` 行（hotel、timeline event）
- [x] 4.4 所有 `data/trips-md/*/day-*.md`：restaurant/shop 表格移除 `blog` 欄
- [x] 4.5 `npm run build` 重建所有 JSON

## 5. 品質規則與測試

- [x] 5.1 `.claude/commands/trip-quality-rules.md`：更新 R3（移除 blogUrl 必填）、R4（移除 titleUrl/blogUrl）、R5（移除 blogUrl）、移除 R6、R7（移除 shop blogUrl）
- [x] 5.2 `tests/json/schema.test.js`：移除 `titleUrl`、`url`、`blogUrl` 相關驗證
- [x] 5.3 `tests/json/quality.test.js`：移除 blogUrl 相關品質檢查
- [x] 5.4 `tests/unit/render.test.js`：移除 `renderBlogLink` 測試、更新 timeline/hotel/restaurant 渲染測試
- [x] 5.5 `tests/integration/render-pipeline.test.js`：移除 blogUrl/titleUrl 相關 HTML 驗證（確認無殘留）
- [x] 5.6 `npm test` 確認全過（569 tests passed）

## 6. 規格與記憶同步

- [x] 6.1 `openspec/specs/trip-enrich-rules/spec.md`：套用 delta（R3/R4/R5/R6/R7 修改）
- [x] 6.2 `openspec/specs/trip-data-normalization/spec.md`：套用 delta（移除 blogUrl/url/titleUrl）
- [x] 6.3 記憶檔 `rules-md-format.md`：移除 `blog`、`web`、`url` 欄位說明
