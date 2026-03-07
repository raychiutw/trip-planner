## Context

前端已改為多檔載入（`data/dist/`），但 skills 仍操作 `data/trips/*.json` 再 split → build。需要統一為 MD 作為唯一 source of truth，移除完整 JSON 與冗餘流程。

現有資料流：
```
data/trips/*.json → trip-split.js → data/trips-md/ → trip-build.js → data/dist/
```

目標資料流：
```
data/trips-md/ → trip-build.js → data/dist/
                                  └── trips.json（自動產生）
```

## Goals / Non-Goals

**Goals:**
- MD 檔案群成為唯一 source of truth
- 移除完整 JSON、手動 registry、split 腳本、round-trip 測試
- build.js 全部重建 + 自動產生 trips.json
- 所有 skills 改為操作 MD
- setting.js / edit.js 改讀 dist/trips.json

**Non-Goals:**
- 增量 build（每次全部重建即可）
- 改變 MD 的 frontmatter 格式（僅新增 name/owner）
- 改變前端多檔載入機制（已完成）

## Decisions

### D1：meta.md 新增 name + owner
在 frontmatter 加兩個欄位，trip-build.js 輸出到 meta.json。
```yaml
---
name: Ray 的沖繩之旅
owner: Ray
title: 2026 沖繩五日自駕遊行程表
...
---
```
對映關係取自現有 `data/trips.json`。

### D2：build.js 取代 build-all.js
- 拿掉 split 步驟，直接掃 `data/trips-md/*/` 跑 trip-build.js
- 最後掃 `data/dist/*/meta.json` 彙整產生 `data/dist/trips.json`
- registry 格式：`[{ slug, name, dates, owner }, ...]`
  - `slug` 從目錄名取得
  - `name`/`owner` 從 meta.json
  - `dates` 從 meta.json 的 footer.dates

### D3：setting.js / edit.js 改讀 dist
- `fetch('data/dist/trips.json')` 取代 `fetch('data/trips.json')`
- renderTripList 不再需要 `t.file` 路徑轉換，直接用 `t.slug`

### D4：app.js 清理
- 移除 `TRIP_FILE` 全域變數（前端不再參照完整 JSON）
- `fileToSlug` 移除 `data/trips/` 分支，只保留 `data/dist/` 格式

### D5：Skills 操作 MD
所有 tp-* skills 改為直接讀寫 `data/trips-md/{slug}/` 下的 MD 檔案。Claude 原生就能解析 YAML frontmatter + Markdown table，不需額外解析器。操作完後跑 `npm run build`。

### D6：tp-check 改為檢查 MD
品質規則檢查對象從完整 JSON 改為讀取 MD frontmatter 驗證。

### D7：刪除清單
| 檔案/目錄 | 理由 |
|-----------|------|
| `data/trips/*.json` | 被 MD 取代 |
| `data/trips.json` | 被 auto registry 取代 |
| `data/backup/` | 改用 git 追蹤 MD |
| `scripts/trip-split.js` | 不再有完整 JSON 要拆 |
| `scripts/diff-roundtrip.js` | round-trip 無意義 |
| `scripts/build-all.js` | 被 build.js 取代 |
| `tests/unit/trip-roundtrip.test.js` | 不再需要 |
| `tests/json/registry.test.js` | 改為驗證 dist/trips.json |
| `poc.html` | 概念驗證用完即丟 |

## Risks / Trade-offs

- **Skills 改動大** → 8 個 skills 全部要改路徑，但都是 prompt 文字修改，不涉及程式邏輯
- **schema.test.js 驗證對象改變** → 改為讀取 dist JSON 驗證，邏輯不變
- **data/examples/template.json 是否保留** → 保留，作為 tp-create 的結構範本（產出的是 MD，但參考的是 JSON 結構）
