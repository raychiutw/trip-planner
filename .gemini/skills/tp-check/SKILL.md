---
name: tp-check
description: 對指定行程逐項檢查品質規則，輸出紅綠燈驗證 report。適用於檢查行程內容是否符合品質標準，或在修改後進行驗證。
---

# tp-check

對指定行程逐項檢查品質規則，輸出紅綠燈驗證 report。

## 核心原則
- 只讀不改，不修改任何資料。
- 使用 `references/trip-quality-rules.md` 作為檢查基準。

## 步驟
1. **讀取資料**：
   - GET `/api/trips/{tripId}` 取得 meta
   - GET `/api/trips/{tripId}/days` 取得天數清單
   - GET `/api/trips/{tripId}/days/{N}` 依序取得每天完整資料
2. **逐項檢查**：對照品質規則驗證 JSON 欄位（`location.googleQuery`、`googleRating`、`source`、`note` 等）。
3. **輸出 Report**：依檢查結果輸出 report。

## JSON 欄位對照

| 欄位 | 說明 |
|------|------|
| `location.googleQuery` | R11 地圖導航 |
| `googleRating` | R12 評分 |
| `meta.countries` | 陣列格式（如 `["JP"]`） |
| `source` | R13 來源標記（`"ai"` 或 `"user"`） |
| `note` | R15 必填備註 |
| `location.naverQuery` | R14 韓國行程 Naver Maps URL |

## Report 模式

### 完整模式
包含 Summary (🟢 passed, 🟡 warnings, 🔴 failed) 及詳細規則狀態表與具體描述。

### 精簡模式
僅輸出總數，例如：`tp-check: 🟢 10  🟡 2  🔴 0`

## 紅綠燈狀態定義
- 🟢 **passed**: 規則完全符合。
- 🟡 **warning**: 有瑕疵但屬 warn 級（如 R11 location 缺失、R12 googleRating 缺失等）。
- 🔴 **failed**: 不符合 strict 級規則。

## 參考資源
- 品質規則：`references/trip-quality-rules.md`
