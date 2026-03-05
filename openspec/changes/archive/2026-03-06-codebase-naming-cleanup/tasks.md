## 1. JSON 資料：transit → travel

- [x] 1.1 Node.js 腳本批次替換所有 `data/trips/*.json` 的 `"transit"` 欄位 → `"travel"`
- [x] 1.2 替換 `data/examples/template.json` 的 `"transit"` → `"travel"`

## 2. JSON 資料：desc → description

- [x] 2.1 Node.js 腳本批次替換所有 `data/trips/*.json` 的餐廳 `"desc"` 欄位 → `"description"`
- [x] 2.2 替換 `data/examples/template.json` 的 `"desc"` → `"description"`

## 3. JSON 資料：subs 遷移至 hotel.infoBoxes

- [x] 3.1 Ray 行程：將 4 筆 `hotel.subs[type=parking]` 遷移至 `hotel.infoBoxes[type=parking]`，刪除 `subs`
- [x] 3.2 HuiYun 行程：將 6 筆 `hotel.subs[type=parking]` 遷移至 `hotel.infoBoxes[type=parking]`，刪除 `subs`
- [x] 3.3 移除 `data/examples/template.json` 中的 `subs` 欄位

## 4. JS：ev → entry + transit → travel + desc → description + subs 移除

- [x] 4.1 `js/app.js` renderTimeline：`ev` → `entry`（forEach 迴圈變數及所有 `ev.` 存取）
- [x] 4.2 `js/app.js` renderTimeline：`ev.transit` → `entry.travel`
- [x] 4.3 `js/app.js` renderDrivingStats：`ev` → `entry`、`ev.transit` → `entry.travel`
- [x] 4.4 `js/app.js` renderRestaurant：`r.desc` → `r.description`
- [x] 4.5 `js/app.js` renderHotel：移除 `hotel.subs` 渲染邏輯（parking 已在 infoBoxes 渲染）
- [x] 4.6 `js/app.js` validateTripData / checkBusinessHours：`ev` → `entry`、`.transit` → `.travel`

## 5. CSS

- [x] 5.1 `css/style.css`：`.tl-transit` → `.tl-travel`

## 6. 測試

- [x] 6.1 `tests/json/schema.test.js`：`transit` → `travel`、`desc` → `description`、移除 `subs` 相關測試
- [x] 6.2 `tests/unit/render.test.js`：`transit` → `travel`、`ev` 相關 mock data 更新
- [x] 6.3 `tests/integration/render-pipeline.test.js`：`transit` → `travel`

## 7. 品質規則與 Specs

- [x] 7.1 `.claude/commands/trip-quality-rules.md`：`transit` → `travel`、`desc` → `description`、移除 `subs` 提及
- [x] 7.2 `openspec/specs/trip-json-validation/spec.md`：同步更新
- [x] 7.3 `openspec/specs/trip-enrich-rules/spec.md`：同步更新

## 8. 驗證

- [x] 8.1 全域 grep 確認無殘留（排除 CSS `transition`、archive、backup）
- [x] 8.2 `npm test` 全部通過
