## Why

Codebase 中有多處英文命名與中文語意不搭或不一致：`transit` 易與公共運輸混淆、`ev` 與 DOM event 撞名、`desc` 與 `description` 同概念不同拼、`subs` 縮寫語意不明且 spec 已標廢除。一次性清理提升可讀性。

## What Changes

- **BREAKING**：JSON 欄位 `transit` → `travel`（所有行程 + template）
- **BREAKING**：JSON 欄位 `desc` → `description`（餐廳物件，所有行程 + template）
- **BREAKING**：移除 `hotel.subs`，停車場資料遷移至 `hotel.infoBoxes[type=parking]`（Ray、HuiYun 兩趟行程 + template）
- JS 迴圈變數 `ev` → `entry`（app.js）
- CSS class `.tl-transit` → `.tl-travel`
- 測試、品質規則、OpenSpec specs 同步更新

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `trip-json-validation`：`transit` → `travel`、`desc` → `description`、移除 `subs` schema 相關參照
- `trip-enrich-rules`：R11/R12 skip 條件中 `transit` → `travel`

## Impact

- **JSON**：`data/trips/*.json`（5 檔）、`data/examples/template.json`
- **JS**：`js/app.js`（ev→entry、ev.transit→entry.travel、r.desc→r.description、hotel.subs 渲染移除）
- **CSS**：`css/style.css`（.tl-transit→.tl-travel）
- **測試**：`tests/json/schema.test.js`、`tests/unit/render.test.js`、`tests/integration/render-pipeline.test.js`
- **規則**：`.claude/commands/trip-quality-rules.md`
- **Specs**：`openspec/specs/trip-json-validation/spec.md`、`openspec/specs/trip-enrich-rules/spec.md`
- backup JSON 不改（歷史快照）、openspec archive 不改
