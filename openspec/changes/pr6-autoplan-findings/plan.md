# Plan: PR6 — autoplan A+B Findings

## 執行策略

嚴格 TDD 紅→綠，每 item 兩個 commit：
1. `test(F00N): red — 描述` — 失敗測試
2. `fix(F00N): 描述` 或 `feat(F00N): 描述` — 最小實作

## 執行順序

### 第一波：A 類 Critical Bugs（F001–F004）

這四項是功能性 regression，優先修復，避免讓 B 類 quality work 建立在錯誤基礎上。

```
F001 → F002 → F003 → F004
```

- F001（dark prop）：最獨立，只涉及 TripMapRail + TripPage
- F002（fitDoneRef）：依賴 F001 完成後的 TripMapRail 型別
- F003（mobile type scale）：純 CSS，無依賴
- F004（color-scheme）：純 CSS，無依賴

### 第二波：B 類 Quality（F005–F011）

```
F005 → F006 → F007 → F008 → F009 → F010 → F011
```

- F005（lazy）：只改 TripPage import，最簡單
- F006（integration test）：補強已有測試，無 production code 變更
- F007（scroll fly-to）：需新增 IntersectionObserver 邏輯
- F008（color-blind aid）：新增 `dayPolylineStyle` helper + TripMapRail 更新
- F009（label 改名）：MobileBottomNav 最簡單
- F010（tap target）：DaySection CSS，最簡單
- F011（runtime test）：最複雜的測試補強，放最後

## 每 item 完成後

1. 執行 `npx tsc --noEmit` 確認 0 errors
2. 執行 `npm test` 確認全綠
3. 更新 `progress.jsonl` 加一行

## 最終驗收

- `npx tsc --noEmit` 0 errors
- `npm test` 全綠
- 不 push（後續 PM 處理 PR flow）
